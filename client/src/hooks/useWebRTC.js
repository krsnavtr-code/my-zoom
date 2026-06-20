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

    externalSocket.on("connect", () => {
      console.log("🔌 Socket Connected to Backend! ID:", externalSocket.id);
    });
    externalSocket.on("connect_error", (err) => {
      console.error("🚨 Socket Connection ERROR:", err.message);
    });

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (!isMounted) return;
        console.log(
          `🟢 1. Stream ready. Emitting join-room -> Room:${roomId}, User:${userId}`,
        );

        setLocalStream(stream);
        localStreamRef.current = stream;
        if (userVideoRef.current) userVideoRef.current.srcObject = stream;

        externalSocket.emit("join-room", roomId, userId, userName);
      })
      .catch((err) => {
        console.error("🔴 Camera/Mic Error:", err);
      });

    externalSocket.on("room-users", (existingUsers) => {
      console.log("👥 2. Received users in room:", existingUsers);
      existingUsers.forEach((existingUserId) => {
        if (localStreamRef.current) {
          connectToPeer(
            existingUserId,
            localStreamRef.current,
            false,
            externalSocket,
          );
        }
      });
      console.log("📢 3. Ready to receive calls. Informing others...");
      externalSocket.emit("ready-for-calls", roomId, userId, userName);
    });

    externalSocket.on(
      "user-ready",
      ({ userId: callerId, userName: callerName }) => {
        console.log(
          `👋 4. New user ${callerName} is ready! Initiating call to them...`,
        );
        peerNamesRef.current[callerId] = callerName;
        setPeerNames((prev) => ({ ...prev, [callerId]: callerName }));

        if (peersRef.current[callerId]) {
          console.log(
            "♻️ Destroying old ghost connection for reloaded user...",
          );
          peersRef.current[callerId].destroy();
          delete peersRef.current[callerId];
        }

        if (localStreamRef.current) {
          connectToPeer(callerId, localStreamRef.current, true, externalSocket);
        }
      },
    );

    externalSocket.on("call-user", ({ signal, callerId }) => {
      console.log("📞 5. Incoming call signal from:", callerId);
      let peer = peersRef.current[callerId];
      if (!peer && localStreamRef.current) {
        peer = connectToPeer(
          callerId,
          localStreamRef.current,
          false,
          externalSocket,
        );
      }
      if (peer) {
        peer.signal(signal);
      }
    });

    externalSocket.on("call-accepted", ({ signal, callId }) => {
      console.log("✅ 6. Call accepted signal from:", callId);
      if (peersRef.current[callId]) {
        peersRef.current[callId].signal(signal);
      }
    });

    externalSocket.on("user-disconnected", (disconnectedUserId) => {
      console.log("❌ User disconnected:", disconnectedUserId);
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

    // Toggle Receivers
    externalSocket.on(
      "user-audio-toggled",
      ({ userId: toggledUserId, audioEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [toggledUserId]: { ...prev[toggledUserId], audioEnabled: isEnabled },
        }));
      },
    );

    externalSocket.on(
      "user-video-toggled",
      ({ userId: toggledUserId, videoEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [toggledUserId]: { ...prev[toggledUserId], videoEnabled: isEnabled },
        }));
      },
    );

    externalSocket.on(
      "user-screen-share-toggled",
      ({ userId: sharerId, isScreenSharing: isSharing }) => {
        setPeerStates((prev) => ({
          ...prev,
          [sharerId]: { ...prev[sharerId], isScreenSharing: isSharing },
        }));
      },
    );

    return () => {
      isMounted = false;
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};

      externalSocket.off("room-users");
      externalSocket.off("user-ready");
      externalSocket.off("call-user");
      externalSocket.off("call-accepted");
      externalSocket.off("user-disconnected");
      externalSocket.off("user-audio-toggled");
      externalSocket.off("user-video-toggled");
      externalSocket.off("user-screen-share-toggled");
    };
  }, [roomId, userId, userName, externalSocket]);

  const connectToPeer = (peerId, stream, isInitiator, socket) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    console.log(`🔗 Creating peer for ${peerId} (Initiator: ${isInitiator})`);

    try {
      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream: stream,
        config: { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] },
      });

      peer.on("signal", (signal) => {
        if (isInitiator) {
          socket.emit("call-user", {
            userToCall: peerId,
            signalData: signal,
            from: userId,
          });
        } else {
          socket.emit("call-accepted", { signal: signal, callId: peerId });
        }
      });

      peer.on("stream", (userStream) => {
        console.log(`📺 Received remote video stream from ${peerId}!`);
        setPeers((prev) => ({ ...prev, [peerId]: userStream }));
        setPeerStates((prev) => ({
          ...prev,
          [peerId]: { audioEnabled: true, videoEnabled: true },
        }));
      });

      peer.on("error", (err) => console.error("Peer Error:", err));
      peersRef.current[peerId] = peer;
      return peer;
    } catch (err) {
      console.error("🔴 SimplePeer Crash:", err);
    }
  };

  // --- AUDIO LOGIC ---
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

  // --- VIDEO LOGIC (BUG FIXED) ---
  const toggleVideo = async () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];

    if (videoEnabled && videoTrack) {
      // Band karne k liye track.enabled false karte hain, null se replace nahi karte
      videoTrack.enabled = false;
      videoTrack.stop(); // Camera light band karne ke liye
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

        if (videoTrack) {
          localStream.removeTrack(videoTrack);
        }
        localStream.addTrack(newVideoTrack);

        if (userVideoRef.current) {
          userVideoRef.current.srcObject = localStream;
        }

        Object.values(peersRef.current).forEach((peer) => {
          if (peer._pc) {
            // Null error ko handle karne ke liye s.track && lagaya gaya hai
            const sender = peer._pc
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) {
              sender.replaceTrack(newVideoTrack);
            }
          }
        });

        setVideoEnabled(true);
        externalSocket?.emit("toggle-video", {
          roomId,
          userId,
          videoEnabled: true,
        });
      } catch (err) {
        console.error("Error re-enabling video:", err);
      }
    }
  };

  // --- SCREEN SHARE LOGIC ---
  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });
      setScreenStream(stream);
      setIsScreenSharing(true);

      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        if (peer._pc) {
          const sender = peer._pc
            .getSenders()
            .find((s) => s.track && s.track.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        }
      });

      videoTrack.onended = () => {
        stopScreenShare();
        externalSocket?.emit("toggle-screen-share", {
          roomId,
          userId,
          isScreenSharing: false,
        });
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        Object.values(peersRef.current).forEach((peer) => {
          if (peer._pc) {
            const sender = peer._pc
              .getSenders()
              .find((s) => s.track && s.track.kind === "video");
            if (sender) sender.replaceTrack(videoTrack);
          }
        });
      }
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
      externalSocket?.emit("toggle-screen-share", {
        roomId,
        userId,
        isScreenSharing: false,
      });
    } else {
      startScreenShare().then(() => {
        externalSocket?.emit("toggle-screen-share", {
          roomId,
          userId,
          isScreenSharing: true,
        });
      });
    }
  };

  // --- RECORDING LOGIC ---
  const startRecording = () => {
    if (!localStream) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const canvasStream = canvas.captureStream(30);
    if (localStream.getAudioTracks().length > 0) {
      canvasStream.addTrack(localStream.getAudioTracks()[0]);
    }
    mediaRecorderRef.current = new MediaRecorder(canvasStream, {
      mimeType: "video/webm;codecs=vp9",
    });
    recordedChunksRef.current = [];
    mediaRecorderRef.current.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `recording-${roomId}-${Date.now()}.webm`;
      a.click();
      URL.revokeObjectURL(url);
    };
    mediaRecorderRef.current.start();
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(
      () => setRecordingTime((prev) => prev + 1),
      1000,
    );
    setIsRecording(true);
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    setIsRecording(false);
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
  };
};

export default useWebRTC;
