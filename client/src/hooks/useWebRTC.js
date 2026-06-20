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

        // Step 1: Join the room
        externalSocket.emit("join-room", roomId, userId, userName);
      })
      .catch((err) => {
        console.error("🔴 Camera/Mic Error:", err);
      });

    externalSocket.on("room-users", (existingUsers) => {
      console.log("👥 2. Received users in room:", existingUsers);

      // Step 2: Naya user sabse pehle as a 'Receiver' (Initiator: false) tayyar hota hai
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

      // Step 3: Receiver ready hone ke baad purane users ko announce karta hai ki "Mujhe Call Karo!"
      console.log("📢 3. Ready to receive calls. Informing others...");
      externalSocket.emit("ready-for-calls", roomId, userId, userName);
    });

    // Step 4: Purane users ko ye sunai dega aur wo Call (Initiator: true) karenge
    externalSocket.on(
      "user-ready",
      ({ userId: callerId, userName: callerName }) => {
        console.log(
          `👋 4. New user ${callerName} is ready! Initiating call to them...`,
        );
        peerNamesRef.current[callerId] = callerName;
        setPeerNames((prev) => ({ ...prev, [callerId]: callerName }));

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

    externalSocket.on("ice-candidate", ({ candidate, from }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].addIceCandidate(new RTCIceCandidate(candidate));
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
      externalSocket.off("ice-candidate");
      externalSocket.off("user-disconnected");
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
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
          ],
        },
      });

      peer.on("signal", (signal) => {
        console.log(`📡 Sending signal to ${peerId} (Type: ${signal.type})`);
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
      alert(`Vite/SimplePeer Error: ${err.message}. Open console for details.`);
    }
  };

  const toggleAudio = async () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        if (audioTrack.enabled) {
          // Disable and stop the track to release hardware
          audioTrack.enabled = false;
          audioTrack.stop();
          setAudioEnabled(false);
        } else {
          // Re-enable by requesting new audio track
          try {
            const newAudioStream = await navigator.mediaDevices.getUserMedia({
              audio: true,
            });
            const newAudioTrack = newAudioStream.getAudioTracks()[0];

            // Replace the old track with the new one
            localStream.removeTrack(audioTrack);
            localStream.addTrack(newAudioTrack);

            // Update video element with new stream
            if (userVideoRef.current) {
              userVideoRef.current.srcObject = localStream;
            }

            // Replace track in all peer connections
            Object.values(peersRef.current).forEach((peer) => {
              if (peer._pc) {
                const sender = peer._pc
                  .getSenders()
                  .find((s) => s.track.kind === "audio");
                if (sender) {
                  sender.replaceTrack(newAudioTrack);
                }
              }
            });

            setAudioEnabled(true);
          } catch (err) {
            console.error("Error re-enabling audio:", err);
          }
        }

        // Broadcast to other users
        socketRef.current?.emit("toggle-audio", {
          roomId,
          userId,
          audioEnabled: !audioEnabled,
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        if (videoTrack.enabled) {
          // Disable and stop the track to release hardware
          videoTrack.enabled = false;
          videoTrack.stop();

          // Replace with null in all peer connections to fully release
          Object.values(peersRef.current).forEach((peer) => {
            if (peer._pc) {
              const sender = peer._pc
                .getSenders()
                .find((s) => s.track.kind === "video");
              if (sender) {
                sender.replaceTrack(null);
              }
            }
          });

          setVideoEnabled(false);
        } else {
          // Re-enable by requesting new video track
          try {
            const newVideoStream = await navigator.mediaDevices.getUserMedia({
              video: true,
            });
            const newVideoTrack = newVideoStream.getVideoTracks()[0];

            // Replace the old track with the new one in local stream
            localStream.removeTrack(videoTrack);
            localStream.addTrack(newVideoTrack);

            // Update video element with new stream
            if (userVideoRef.current) {
              userVideoRef.current.srcObject = localStream;
            }

            // Replace track in all peer connections
            Object.values(peersRef.current).forEach((peer) => {
              if (peer._pc) {
                const sender = peer._pc
                  .getSenders()
                  .find((s) => s.track.kind === "video");
                if (sender) {
                  sender.replaceTrack(newVideoTrack);
                }
              }
            });

            setVideoEnabled(true);
          } catch (err) {
            console.error("Error re-enabling video:", err);
          }
        }

        // Broadcast to other users
        socketRef.current?.emit("toggle-video", {
          roomId,
          userId,
          videoEnabled: !videoEnabled,
        });
      }
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true,
      });

      setScreenStream(stream);
      setIsScreenSharing(true);

      // Replace video track in all peer connections
      const videoTrack = stream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        const sender = peer._pc
          .getSenders()
          .find((s) => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Handle user stopping screen share
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Error starting screen share:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    // Restore camera video track
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      Object.values(peersRef.current).forEach((peer) => {
        const sender = peer._pc
          .getSenders()
          .find((s) => s.track.kind === "video");
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });
    }

    setScreenStream(null);
    setIsScreenSharing(false);
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
      // Broadcast screen share state
      socketRef.current?.emit("toggle-screen-share", {
        roomId,
        userId,
        isScreenSharing: false,
      });
    } else {
      startScreenShare();
      // Broadcast screen share state
      socketRef.current?.emit("toggle-screen-share", {
        roomId,
        userId,
        isScreenSharing: true,
      });
    }
  };

  const startRecording = () => {
    if (!localStream) return;

    // Create a canvas to mix all streams
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");

    // Create a stream from the canvas
    const canvasStream = canvas.captureStream(30);

    // Add audio tracks from local stream
    if (localStream.getAudioTracks().length > 0) {
      canvasStream.addTrack(localStream.getAudioTracks()[0]);
    }

    // Set up MediaRecorder
    mediaRecorderRef.current = new MediaRecorder(canvasStream, {
      mimeType: "video/webm;codecs=vp9",
    });

    recordedChunksRef.current = [];

    mediaRecorderRef.current.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
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

    // Start timer
    setRecordingTime(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);

    setIsRecording(true);
  };

  const stopRecording = () => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.stop();
    }

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const leaveRoom = () => {
    if (localStream) localStream.getTracks().forEach((track) => track.stop());
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    setPeers({});
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
