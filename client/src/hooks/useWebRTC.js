import { useState, useEffect, useRef } from "react";
import SimplePeer from "simple-peer";
import { io } from "socket.io-client";
import { API_URL } from "../config";

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
  const socketRef = useRef(externalSocket);
  const userVideoRef = useRef(null);
  const peersRef = useRef({});
  const peerNamesRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const qualityCheckIntervalRef = useRef(null);

  useEffect(() => {
    // Only initialize socket if not provided externally
    if (!externalSocket) {
      socketRef.current = io(API_URL, {
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });
    }

    // Don't initialize if socket is null
    if (!socketRef.current) {
      console.error("Socket is null, cannot initialize WebRTC");
      return;
    }

    // Set up socket listeners BEFORE joining room
    socketRef.current.on("room-users", (existingUsers) => {
      console.log("Existing users in room:", existingUsers);
      // Delay peer connections to ensure stream is fully ready
      setTimeout(() => {
        existingUsers.forEach((existingUserId) => {
          if (localStreamRef.current) {
            connectToPeer(existingUserId, localStreamRef.current, false);
          }
        });
      }, 100);
    });

    // Listen for user names (to get names of existing users)
    socketRef.current.on("user-names", (userNames) => {
      console.log("Received user names:", userNames);
      peerNamesRef.current = { ...peerNamesRef.current, ...userNames };
      setPeerNames((prev) => ({ ...prev, ...userNames }));
    });

    // Listen for other users joining
    socketRef.current.on(
      "user-connected",
      ({ userId: callerId, userName: callerName }) => {
        console.log("User connected:", callerId, callerName);
        // Store peer name
        peerNamesRef.current[callerId] = callerName;
        setPeerNames((prev) => ({ ...prev, [callerId]: callerName }));
        if (localStreamRef.current) {
          connectToPeer(callerId, localStreamRef.current, true);
        }
      },
    );

    // Listen for incoming calls
    socketRef.current.on("call-user", ({ signal, callerId }) => {
      console.log("Received call from:", callerId);
      let peer = peersRef.current[callerId];
      if (!peer) {
        console.log(
          "Peer connection not found for caller, creating one as receiver",
        );
        if (localStreamRef.current) {
          peer = connectToPeer(callerId, localStreamRef.current, false);
        } else {
          console.error(
            "Cannot create peer connection: local stream not ready",
          );
          return;
        }
      }
      if (peer) {
        peer.signal(signal);
      }
    });

    // Listen for call accepted
    socketRef.current.on("call-accepted", ({ signal, callId }) => {
      console.log("Call accepted by:", callId);
      if (peersRef.current[callId]) {
        peersRef.current[callId].signal(signal);
      } else {
        console.error("Peer not found for call:", callId);
      }
    });

    // Listen for ICE candidates (not needed with trickle: true, but kept for compatibility)
    socketRef.current.on("ice-candidate", ({ candidate, from }) => {
      if (peersRef.current[from]) {
        try {
          peersRef.current[from].addIceCandidate(
            new RTCIceCandidate(candidate),
          );
        } catch (err) {
          console.error("Error adding ICE candidate:", err);
        }
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
      console.log("User disconnected:", disconnectedUserId);
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
        setPeerNames((prev) => {
          const newNames = { ...prev };
          delete newNames[disconnectedUserId];
          return newNames;
        });
        delete peerNamesRef.current[disconnectedUserId];
      }
    });

    // Get local media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log("Got local stream");
        // Ensure stream is ready before setting state
        if (stream.getTracks().length > 0) {
          setLocalStream(stream);
          localStreamRef.current = stream;
          if (userVideoRef.current) {
            userVideoRef.current.srcObject = stream;
          }

          // Join room with user name after stream is ready and listeners are set up
          socketRef.current.emit("join-room", roomId, userId, userName);
        } else {
          console.error("Stream has no tracks");
        }
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
      });

    return () => {
      // Cleanup
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};

      // Cleanup socket listeners to prevent duplicates
      if (socketRef.current) {
        socketRef.current.off("room-users");
        socketRef.current.off("user-names");
        socketRef.current.off("user-connected");
        socketRef.current.off("call-user");
        socketRef.current.off("call-accepted");
        socketRef.current.off("ice-candidate");
        socketRef.current.off("user-audio-toggled");
        socketRef.current.off("user-video-toggled");
        socketRef.current.off("user-screen-share-toggled");
        socketRef.current.off("user-disconnected");
      }

      // Only disconnect socket if we created it
      if (!externalSocket) {
        socketRef.current?.disconnect();
      }
    };
  }, [roomId, userId, userName, externalSocket]);

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

    if (peersRef.current[peerId]) {
      console.log("Peer connection already exists for user:", peerId);
      return peersRef.current[peerId];
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
        if (isInitiator) {
          socketRef.current.emit("call-user", {
            userToCall: peerId,
            signalData: signal,
            from: userId,
          });
        } else {
          socketRef.current.emit("call-accepted", {
            signal: signal,
            callId: peerId,
          });
        }
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
      return peer;
    } catch (err) {
      console.error("Error creating peer connection:", err);
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
