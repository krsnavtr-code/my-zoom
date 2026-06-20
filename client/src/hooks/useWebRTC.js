import { useState, useEffect, useRef } from "react";
import SimplePeer from "simple-peer";

const useWebRTC = (roomId, userId, userName, externalSocket) => {
  const [peers, setPeers] = useState({});
  const [peerNames, setPeerNames] = useState({});
  const [peerStates, setPeerStates] = useState({});

  const [localStream, setLocalStream] = useState(null);
  const localStreamRef = useRef(null);

  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const screenStreamRef = useRef(null);
  const isScreenSharingRef = useRef(false);

  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState("good");

  const userVideoRef = useRef(null);
  const peersRef = useRef({});
  const peerNamesRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);

  useEffect(() => {
    if (!externalSocket || !userId) return;

    let isMounted = true;

    externalSocket.on("connect", () => console.log("🔌 Socket Connected!"));
    externalSocket.on("connect_error", (err) =>
      console.error("🚨 Error:", err.message),
    );

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!isMounted) return;
        setLocalStream(stream);
        localStreamRef.current = stream;
        if (userVideoRef.current) userVideoRef.current.srcObject = stream;

        externalSocket.emit("join-room", roomId, userId, userName);
      })
      .catch((err) => console.error("🔴 Camera/Mic Error:", err));

    externalSocket.on("room-users", (existingUsers) => {
      existingUsers.forEach((existingUserId) => {
        if (localStreamRef.current)
          connectToPeer(
            existingUserId,
            localStreamRef.current,
            false,
            externalSocket,
          );
      });
      externalSocket.emit("ready-for-calls", roomId, userId, userName);
    });

    externalSocket.on(
      "user-ready",
      ({ userId: callerId, userName: callerName }) => {
        peerNamesRef.current[callerId] = callerName;
        setPeerNames((prev) => ({ ...prev, [callerId]: callerName }));

        if (peersRef.current[callerId]) {
          peersRef.current[callerId].destroy();
          delete peersRef.current[callerId];
        }
        if (localStreamRef.current) {
          connectToPeer(callerId, localStreamRef.current, true, externalSocket);
        }

        // 🟢 FIX 2: Agar main pehle se Screen Share kar raha hu aur koi naya user aaya/reload hua,
        // toh main sabko wapas yaad dilaunga ki meri screen on hai (UI update ke liye).
        if (isScreenSharingRef.current && screenStreamRef.current) {
          externalSocket.emit("toggle-screen-share", {
            roomId,
            userId,
            isScreenSharing: true,
            streamId: screenStreamRef.current.id,
          });
        }
      },
    );

    externalSocket.on("call-user", ({ signal, callerId }) => {
      let peer = peersRef.current[callerId];
      if (!peer && localStreamRef.current) {
        peer = connectToPeer(
          callerId,
          localStreamRef.current,
          false,
          externalSocket,
        );
      }
      if (peer) peer.signal(signal);
    });

    externalSocket.on("call-accepted", ({ signal, callId }) => {
      if (peersRef.current[callId]) peersRef.current[callId].signal(signal);
    });

    externalSocket.on("user-disconnected", (disconnectedUserId) => {
      if (peersRef.current[disconnectedUserId]) {
        peersRef.current[disconnectedUserId].destroy();
        delete peersRef.current[disconnectedUserId];
        setPeers((prev) => {
          const newPeers = { ...prev };
          delete newPeers[disconnectedUserId];
          return newPeers;
        });
      }
    });

    externalSocket.on(
      "user-audio-toggled",
      ({ userId: tId, audioEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [tId]: { ...prev[tId], audioEnabled: isEnabled },
        }));
      },
    );
    externalSocket.on(
      "user-video-toggled",
      ({ userId: tId, videoEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [tId]: { ...prev[tId], videoEnabled: isEnabled },
        }));
      },
    );

    externalSocket.on(
      "user-screen-share-toggled",
      ({ userId: sharerId, isScreenSharing: isSharing, streamId }) => {
        setPeerStates((prev) => ({
          ...prev,
          [sharerId]: {
            ...prev[sharerId],
            isScreenSharing: isSharing,
            screenStreamId: streamId,
          },
        }));
      },
    );

    return () => {
      isMounted = false;
      if (localStreamRef.current)
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      Object.values(peersRef.current).forEach((p) => p.destroy());
      peersRef.current = {};
      externalSocket.removeAllListeners();
    };
  }, [roomId, userId, userName, externalSocket]);

  const connectToPeer = (peerId, stream, isInitiator, socket) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];

    // 🟢 FIX 3: Naye/Reloaded user ko dono stream (Camera + Screen) ek sath bhejni padegi
    const streamsToSend = [stream]; // Isme camera hai
    if (isScreenSharingRef.current && screenStreamRef.current) {
      streamsToSend.push(screenStreamRef.current); // Isme screen daal di
    }

    try {
      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        streams: streamsToSend, // 'stream' ki jagah 'streams' array bheja
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });

      peer.on("signal", (signal) => {
        if (isInitiator)
          socket.emit("call-user", {
            userToCall: peerId,
            signalData: signal,
            from: userId,
          });
        else socket.emit("call-accepted", { signal: signal, callId: peerId });
      });

      peer.on("stream", (userStream) => {
        setPeers((prev) => {
          const existingStreams = prev[peerId] || [];
          if (existingStreams.some((s) => s.id === userStream.id)) return prev;
          return { ...prev, [peerId]: [...existingStreams, userStream] };
        });
        setPeerStates((prev) => {
          if (prev[peerId]) return prev;
          return {
            ...prev,
            [peerId]: {
              audioEnabled: true,
              videoEnabled: true,
              isScreenSharing: false,
            },
          };
        });
      });

      peersRef.current[peerId] = peer;
      return peer;
    } catch (err) {
      console.error("Error:", err);
    }
  };

  const toggleAudio = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setAudioEnabled(audioTrack.enabled);
      externalSocket?.emit("toggle-audio", {
        roomId,
        userId,
        audioEnabled: audioTrack.enabled,
      });
    }
  };

  const toggleVideo = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoEnabled && videoTrack) {
      videoTrack.enabled = false;
      videoTrack.stop();
      setVideoEnabled(false);
      externalSocket?.emit("toggle-video", {
        roomId,
        userId,
        videoEnabled: false,
      });
    } else {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (videoTrack) localStream.removeTrack(videoTrack);
        localStream.addTrack(newVideoTrack);
        if (userVideoRef.current) userVideoRef.current.srcObject = localStream;

        Object.values(peersRef.current).forEach((peer) => {
          if (peer._pc) {
            const sender = peer._pc
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) sender.replaceTrack(newVideoTrack);
          }
        });
        setVideoEnabled(true);
        externalSocket?.emit("toggle-video", {
          roomId,
          userId,
          videoEnabled: true,
        });
      } catch (err) {}
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: "always",
          displaySurface: "monitor",
          logicalSurface: true,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 15, max: 30 },
        },
        audio: true,
      });

      setScreenStream(stream);
      screenStreamRef.current = stream; // 🟢 Tracker Update

      setIsScreenSharing(true);
      isScreenSharingRef.current = true; // 🟢 Tracker Update

      externalSocket?.emit("toggle-screen-share", {
        roomId,
        userId,
        isScreenSharing: true,
        streamId: stream.id,
      });

      Object.values(peersRef.current).forEach((peer) => {
        if (peer && !peer.destroyed) peer.addStream(stream);
      });

      stream.getVideoTracks()[0].onended = () => stopScreenShare(stream);
    } catch (err) {
      console.error(err);
    }
  };

  const stopScreenShare = (passedStream) => {
    const streamToStop = passedStream || screenStream;
    if (streamToStop) {
      streamToStop.getTracks().forEach((track) => track.stop());
      Object.values(peersRef.current).forEach((peer) => {
        if (peer && !peer.destroyed) {
          try {
            peer.removeStream(streamToStop);
          } catch (e) {}
        }
      });
      setScreenStream(null);
      screenStreamRef.current = null; // 🟢 Tracker Update
    }
    setIsScreenSharing(false);
    isScreenSharingRef.current = false; // 🟢 Tracker Update
    externalSocket?.emit("toggle-screen-share", {
      roomId,
      userId,
      isScreenSharing: false,
    });
  };

  const toggleScreenShare = () => {
    isScreenSharing ? stopScreenShare() : startScreenShare();
  };

  const startRecording = () => {
    /* Recording logic placeholder */
  };
  const stopRecording = () => {
    /* Recording logic placeholder */
  };
  const toggleRecording = () => {
    isRecording ? stopRecording() : startRecording();
  };

  const leaveRoom = () => {
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    if (screenStream) screenStream.getTracks().forEach((track) => track.stop());
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    peersRef.current = {};
    setPeers({});
    setPeerStates({});
    setLocalStream(null);
  };

  return {
    localStream,
    screenStream,
    peers,
    peerNames,
    peerStates,
    audioEnabled,
    videoEnabled,
    isScreenSharing,
    isRecording,
    recordingTime,
    connectionQuality,
    userVideoRef,
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleRecording,
    leaveRoom,
    startScreenShare,
    stopScreenShare,
  };
};

export default useWebRTC;
