import { useState, useEffect, useRef } from "react";
import SimplePeer from "simple-peer";
import { io } from "socket.io-client";

const useWebRTC = (roomId, userId) => {
  const [peers, setPeers] = useState({});
  const [localStream, setLocalStream] = useState(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const socketRef = useRef(null);
  const userVideoRef = useRef(null);
  const peersRef = useRef({});

  useEffect(() => {
    // Initialize Socket.io connection
    socketRef.current = io("http://localhost:5000");

    // Get local media stream
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        setLocalStream(stream);
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }

        // Join room
        socketRef.current.emit("join-room", roomId, userId);

        // Listen for other users
        socketRef.current.on("user-connected", (callerId) => {
          const peer = new SimplePeer({
            initiator: true,
            trickle: false,
            stream: stream,
          });

          peer.on("signal", (signal) => {
            socketRef.current.emit("call-user", {
              userToCall: callerId,
              signalData: signal,
              from: userId,
            });
          });

          peer.on("stream", (userStream) => {
            setPeers((prev) => ({
              ...prev,
              [callerId]: userStream,
            }));
          });

          peer.on("error", (err) => {
            console.error("Peer connection error:", err);
          });

          peersRef.current[callerId] = peer;
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

        // Listen for user disconnected
        socketRef.current.on("user-disconnected", (userId) => {
          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
            setPeers((prev) => {
              const newPeers = { ...prev };
              delete newPeers[userId];
              return newPeers;
            });
          }
        });
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
      });

    return () => {
      // Cleanup
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      socketRef.current?.disconnect();
    };
  }, [roomId, userId]);

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const leaveRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    Object.values(peersRef.current).forEach((peer) => peer.destroy());
    socketRef.current?.emit("leave-room", roomId, userId);
    socketRef.current?.disconnect();
  };

  return {
    localStream,
    peers,
    audioEnabled,
    videoEnabled,
    userVideoRef,
    toggleAudio,
    toggleVideo,
    leaveRoom,
  };
};

export default useWebRTC;
