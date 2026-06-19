import { useState, useEffect, useRef } from "react";
import SimplePeer from "simple-peer";
import { io } from "socket.io-client";

const useWebRTC = (roomId, userId, userName) => {
  const [peers, setPeers] = useState({});
  const [peerStates, setPeerStates] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [connectionQuality, setConnectionQuality] = useState("good");
  const socketRef = useRef(null);
  const userVideoRef = useRef(null);
  const peersRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const qualityCheckIntervalRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.io connection with reconnection
    socketRef.current = io(import.meta.env.VITE_API_URL, {
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    // Get local media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        // Ensure stream is ready before setting state
        if (stream.getTracks().length > 0) {
          setLocalStream(stream);
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
          }

          // Join room with user name after stream is ready
          socketRef.current.emit("join-room", roomId, userId, userName);

          // Listen for existing users in room
          socketRef.current.on("room-users", (existingUsers) => {
            // Delay peer connections to ensure stream is fully ready
            setTimeout(() => {
              existingUsers.forEach((existingUserId) => {
                connectToPeer(existingUserId, stream, false);
              });
            }, 100);
          });

          // Listen for other users joining
          socketRef.current.on(
            "user-connected",
            ({ userId: callerId, userName: callerName }) => {
              connectToPeer(callerId, stream, true);
            },
          );
        } else {
          console.error("Stream has no tracks");
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
      });

    // Listen for incoming calls
    socketRef.current.on("call-user", ({ signal, callerId }) => {
      if (peersRef.current[callerId]) {
        peersRef.current[callerId].signal(signal);
      }
    });

    // Listen for call accepted
    socketRef.current.on("call-accepted", ({ signal, callId }) => {
      if (peersRef.current[callId]) {
        peersRef.current[callId].signal(signal);
      }
    });

    // Listen for ICE candidates
    socketRef.current.on("ice-candidate", ({ candidate, from }) => {
      if (peersRef.current[from]) {
        peersRef.current[from].addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    // Listen for user audio toggle
    socketRef.current.on(
      "user-audio-toggled",
      ({ userId: toggledUserId, audioEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [toggledUserId]: {
            ...prev[toggledUserId],
            audioEnabled: isEnabled,
          },
        }));
      },
    );

    // Listen for user video toggle
    socketRef.current.on(
      "user-video-toggled",
      ({ userId: toggledUserId, videoEnabled: isEnabled }) => {
        setPeerStates((prev) => ({
          ...prev,
          [toggledUserId]: {
            ...prev[toggledUserId],
            videoEnabled: isEnabled,
          },
        }));
      },
    );

    // Listen for user screen share toggle
    socketRef.current.on(
      "user-screen-share-toggled",
      ({ userId: sharerId, isScreenSharing: isSharing }) => {
        setPeerStates((prev) => ({
          ...prev,
          [sharerId]: { ...prev[sharerId], isScreenSharing: isSharing },
        }));
      },
    );

    // Listen for user disconnected
    socketRef.current.on("user-disconnected", (disconnectedUserId) => {
      if (peersRef.current[disconnectedUserId]) {
        peersRef.current[disconnectedUserId].destroy();
        delete peersRef.current[disconnectedUserId];
        setPeers((prev) => {
          const newPeers = { ...prev };
          delete newPeers[disconnectedUserId];
          return newPeers;
        });
        setPeerStates((prev) => {
          const newStates = { ...prev };
          delete newStates[disconnectedUserId];
          return newStates;
        });
      }
    });

    return () => {
      // Cleanup
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      socketRef.current?.disconnect();
    };
  }, [roomId, userId, userName]);

  const connectToPeer = (peerId, stream, isInitiator) => {
    if (!stream) {
      console.error("Cannot connect to peer: stream is undefined");
      return;
    }

    if (!stream.getTracks || stream.getTracks().length === 0) {
      console.error("Cannot connect to peer: stream has no tracks");
      return;
    }

    // Check if stream is a valid MediaStream
    if (!(stream instanceof MediaStream)) {
      console.error("Cannot connect to peer: stream is not a MediaStream");
      return;
    }

    // Check if stream is active
    if (stream.active === false) {
      console.error("Cannot connect to peer: stream is not active");
      return;
    }

    try {
      const peer = new SimplePeer({
        initiator: isInitiator,
        trickle: true,
        stream: stream,
        config: {
          iceServers: [
            { urls: "stun:stun.l.google.com:19302" },
            { urls: "stun:stun1.l.google.com:19302" },
            { urls: "stun:stun2.l.google.com:19302" },
          ],
        },
      });

      peer.on("signal", (signal) => {
        socketRef.current.emit("call-user", {
          userToCall: peerId,
          signalData: signal,
          from: userId,
        });
      });

      peer.on("stream", (userStream) => {
        setPeers((prev) => ({
          ...prev,
          [peerId]: userStream,
        }));
        setPeerStates((prev) => ({
          ...prev,
          [peerId]: { audioEnabled: true, videoEnabled: true },
        }));
      });

      peer.on("ice-candidate", (candidate) => {
        socketRef.current.emit("ice-candidate", {
          candidate,
          to: peerId,
        });
      });

      peer.on("error", (err) => {
        console.error("Peer connection error:", err);
      });

      peer.on("close", () => {
        if (peersRef.current[peerId]) {
          delete peersRef.current[peerId];
          setPeers((prev) => {
            const newPeers = { ...prev };
            delete newPeers[peerId];
            return newPeers;
          });
        }
      });

      // Monitor connection quality
      peer.on("connect", () => {
        setConnectionQuality("good");
      });

      // Monitor ICE connection state via RTCPeerConnection
      if (peer._pc) {
        peer._pc.addEventListener("iceconnectionstatechange", () => {
          const iceState = peer._pc.iceConnectionState;
          if (
            iceState === "disconnected" ||
            iceState === "failed" ||
            iceState === "closed"
          ) {
            setConnectionQuality("poor");
          } else if (iceState === "connected" || iceState === "completed") {
            setConnectionQuality("good");
          }
        });
      }

      peersRef.current[peerId] = peer;
    } catch (err) {
      console.error("Error creating peer connection:", err);
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const newState = audioTrack.enabled;
        setAudioEnabled(newState);
        // Broadcast to other users
        socketRef.current?.emit("toggle-audio", {
          roomId,
          userId,
          audioEnabled: newState,
        });
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        const newState = videoTrack.enabled;
        setVideoEnabled(newState);
        // Broadcast to other users
        socketRef.current?.emit("toggle-video", {
          roomId,
          userId,
          videoEnabled: newState,
        });
      }
    }
  };

  const leaveRoom = () => {
    // Stop all tracks
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => track.stop());
    }

    // Destroy all peers and cleanup references
    Object.values(peersRef.current).forEach((peer) => {
      if (peer && typeof peer.destroy === "function") {
        peer.destroy();
      }
    });
    peersRef.current = {};
    setPeers({});
    setPeerStates({});

    // Stop recording if active
    if (isRecording) {
      stopRecording();
    }

    // Clear quality check interval
    if (qualityCheckIntervalRef.current) {
      clearInterval(qualityCheckIntervalRef.current);
    }

    // Disconnect socket
    socketRef.current?.emit("leave-room", roomId, userId);
    socketRef.current?.disconnect();
    socketRef.current = null;

    // Cleanup refs
    setLocalStream(null);
    setScreenStream(null);
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

  return {
    localStream,
    screenStream,
    peers,
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
