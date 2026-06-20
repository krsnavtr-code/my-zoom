import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { io } from "socket.io-client";
import axios from "axios";
import { API_URL } from "../config";
import useWebRTC from "../hooks/useWebRTC";
import Video from "../components/Video";
import Chat from "../components/Chat";
import Participants from "../components/Participants";
import Modal from "../components/Modal";

const Room = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();

  // 🟢 FIX: Initialize states synchronously so WebRTC doesn't restart halfway
  const [userId] = useState(() => {
    const p = localStorage.getItem("participant");
    if (p) return JSON.parse(p).participantId;
    const u = localStorage.getItem("user");
    if (u) return JSON.parse(u).id;
    return uuidv4();
  });

  const [userName] = useState(() => {
    const p = localStorage.getItem("participant");
    if (p) return JSON.parse(p).name;
    const u = localStorage.getItem("user");
    if (u) return JSON.parse(u).name;
    return "Guest";
  });

  const [participantId] = useState(() => {
    const p = localStorage.getItem("participant");
    return p ? JSON.parse(p).participantId : "";
  });

  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("participants");
  const [notifications, setNotifications] = useState([]);
  const [meetingSettings, setMeetingSettings] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [meetingStatus, setMeetingStatus] = useState(null);

  const [modal, setModal] = useState({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  // 🟢 FIX: Create Socket ONLY ONCE here
  const socketRef = useRef(null);
  const [socketReady, setSocketReady] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      const participantData = localStorage.getItem("participant");
      const userData = localStorage.getItem("user");

      if (!participantData && !userData) {
        navigate(`/join/${roomId}`);
        return;
      }

      try {
        const response = await axios.get(
          `${API_URL}/api/meeting/status/${roomId}`,
        );
        setMeetingStatus(response.data.status);

        if (response.data.status === "ended") {
          setModal({
            isOpen: true,
            title: "Meeting Ended",
            message: "This meeting has already ended. You cannot join it.",
            type: "error",
          });
        }
      } catch (error) {
        console.error("Error checking meeting status:", error);
      }
    };
    checkAccess();
  }, [roomId, navigate]);

  // Connect socket safely
  useEffect(() => {
    if (meetingStatus === "ended") return;
    if (!socketRef.current) {
      socketRef.current = io(API_URL);
      setSocketReady(true);
    }
  }, [meetingStatus]);

  const {
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
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    toggleRecording,
    leaveRoom,
  } = useWebRTC(
    roomId,
    userId,
    userName,
    socketReady && meetingStatus !== "ended" ? socketRef.current : null,
  );

  useEffect(() => {
    if (!socketReady || !socketRef.current) return;
    if (meetingStatus === "ended") return;

    socketRef.current.on("meeting-settings", (settings) => {
      setMeetingSettings(settings);
      setIsHost(settings.hostId === userId);
    });

    socketRef.current.on("user-connected", ({ userName: joinedUserName }) => {
      addNotification(`Node ${joinedUserName} connected.`, "success");
    });

    socketRef.current.on("user-disconnected", () => {
      addNotification("A node has disconnected.", "info");
    });

    socketRef.current.on(
      "user-hand-raised",
      ({ userId: handUserId, isRaised }) => {
        if (handUserId === userId) setHandRaised(isRaised);
        if (isRaised)
          addNotification("A participant is requesting uplink.", "info");
      },
    );

    socketRef.current.on("kicked-from-room", () => {
      addNotification("Connection terminated by host.", "error");
      setTimeout(() => {
        leaveRoom();
        navigate("/dashboard");
      }, 2000);
    });

    socketRef.current.on("force-mute", () => {
      if (audioEnabled) {
        toggleAudio();
        addNotification("Host has overridden audio.", "info");
      }
    });

    socketRef.current.on("meeting-locked", ({ isLocked }) => {
      if (meetingSettings) setMeetingSettings({ ...meetingSettings, isLocked });
      addNotification(
        isLocked ? "Network locked." : "Network unlocked.",
        "info",
      );
    });

    socketRef.current.on("meeting-ended", ({ reason }) => {
      if (reason === "already_ended") {
        setModal({
          isOpen: true,
          title: "Meeting Ended",
          message: "This meeting has already ended.",
          type: "error",
        });
        setTimeout(() => {
          leaveRoom();
          navigate("/dashboard");
        }, 3000);
      }
    });

    socketRef.current.emit("get-message-history", roomId);
    socketRef.current.on("message-history", (history) =>
      setChatMessages(history),
    );
    socketRef.current.on("receive-message", (messageData) =>
      setChatMessages((prev) => [...prev, messageData]),
    );

    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      switch (e.key.toLowerCase()) {
        case "m":
          toggleAudio();
          break;
        case "v":
          toggleVideo();
          break;
        case "s":
          toggleScreenShare();
          break;
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (socketRef.current) {
        socketRef.current.off("meeting-settings");
        socketRef.current.off("user-connected");
        socketRef.current.off("user-disconnected");
        socketRef.current.off("user-hand-raised");
        socketRef.current.off("kicked-from-room");
        socketRef.current.off("force-mute");
        socketRef.current.off("meeting-locked");
        socketRef.current.off("meeting-ended");
        socketRef.current.off("message-history");
        socketRef.current.off("receive-message");
      }
    };
  }, [
    toggleAudio,
    toggleVideo,
    toggleScreenShare,
    userId,
    meetingSettings,
    roomId,
    socketReady,
  ]);

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 3000);
  };

  const handleRaiseHand = () => {
    socketRef.current?.emit("raise-hand", {
      roomId,
      userId,
      isRaised: !handRaised,
    });
    setHandRaised(!handRaised);
  };

  const handleLockMeeting = () => {
    if (!meetingSettings) return;
    socketRef.current?.emit("lock-meeting", {
      roomId,
      hostId: userId,
      isLocked: !meetingSettings.isLocked,
    });
  };

  const handleMuteAll = () => {
    if (!isHost) return;
    socketRef.current?.emit("mute-all", { roomId, hostId: userId });
    addNotification("Global mute protocol engaged.", "success");
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSendMessage = (messageData) => {
    socketRef.current?.emit("send-message", messageData);
    setChatMessages((prev) => [
      ...prev,
      { ...messageData, id: Date.now(), timestamp: new Date().toISOString() },
    ]);
  };

  const handleLeave = async () => {
    if (participantId) {
      try {
        await axios.put(
          `${API_URL}/api/meeting/participant/${participantId}/leave`,
        );
      } catch (error) {
        console.error("Error updating leave time:", error);
      }
    }
    localStorage.removeItem("participant");
    leaveRoom();
    navigate(localStorage.getItem("user") ? "/dashboard" : "/");
  };

  const getGridClass = (count) => {
    if (count === 1) return "grid-cols-1 max-w-4xl mx-auto h-full pb-10";
    if (count <= 4) return "grid-cols-2";
    if (count <= 9) return "grid-cols-3";
    if (count <= 16) return "grid-cols-4";
    return "grid-cols-5";
  };

  const participantCount = Object.keys(peers).length + 1;

  const allParticipants = [
    {
      id: userId,
      name: `${userName} (You)`,
      stream: localStream,
      isLocal: true,
    },
    ...Object.entries(peers).map(([peerId, stream]) => ({
      id: peerId,
      name: peerNames[peerId] || `User ${peerId.slice(0, 8)}`,
      stream: stream,
      isLocal: false,
    })),
  ];

  if (meetingStatus === "ended") {
    return (
      <div className="min-h-screen bg-[#050508] text-white font-sans">
        <Modal
          isOpen={modal.isOpen}
          onClose={() => setModal({ ...modal, isOpen: false })}
          onConfirm={() => navigate("/dashboard")}
          title={modal.title}
          message={modal.message}
          type={modal.type}
          confirmText="Return to Dashboard"
        />
      </div>
    );
  }

  if (!localStream) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-6 shadow-[0_0_30px_rgba(6,182,212,0.5)]"></div>
          <p className="text-cyan-400 font-bold tracking-widest uppercase text-sm mb-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
            Establishing Link...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col relative overflow-hidden font-sans text-slate-300">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[50%] h-[30%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-3 rounded-xl backdrop-blur-xl border text-xs font-semibold animate-slide-in shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 ${notification.type === "success" ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : notification.type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-white/5 border-white/10 text-slate-300"}`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${notification.type === "success" ? "bg-cyan-400" : "bg-slate-300"} animate-pulse`}
            />
            {notification.message}
          </div>
        ))}
      </div>

      <header className="relative z-20 px-4 py-4 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-center pointer-events-auto bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl px-6 py-3 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
          <div className="flex items-center space-x-4">
            <h1 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
              ZoomClone
            </h1>
            <span className="text-white/20">|</span>
            <span className="text-xs font-mono text-slate-400">
              ID: {roomId}
            </span>
            <span className="text-white/20">|</span>
            <span className="text-xs text-slate-400 flex items-center gap-1.5">
              <svg
                className="w-4 h-4 text-cyan-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              {participantCount}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLeave}
              className="ml-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            >
              Abort
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden relative z-10 px-4">
        <main
          className={`flex-1 overflow-auto transition-all duration-300 ${showSidebar ? "pr-4" : ""}`}
        >
          <div
            className={`grid ${getGridClass(participantCount)} gap-4 w-full h-full content-center`}
          >
            {allParticipants.map((participant) => {
              const state = participant.isLocal
                ? { isScreenSharing }
                : peerStates[participant.id] || { isScreenSharing: false };
              return (
                <div
                  key={participant.id}
                  className="relative w-full aspect-video rounded-2xl overflow-hidden border border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] bg-black/50 group"
                >
                  <Video
                    stream={participant.stream}
                    muted={participant.isLocal}
                    name={participant.name}
                    isScreenSharing={state.isScreenSharing}
                  />
                  {!videoEnabled && participant.isLocal && (
                    <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center">
                      <div className="w-20 h-20 bg-gradient-to-tr from-cyan-600/30 to-blue-600/30 border border-cyan-500/50 rounded-full flex items-center justify-center">
                        <span className="text-cyan-400 text-3xl font-bold font-mono">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-xs font-medium text-slate-200">
                    {participant.name}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {showSidebar && (
          <aside className="w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] h-[calc(100vh-160px)]">
            <div className="flex border-b border-white/10 bg-white/5">
              <button
                onClick={() => setSidebarTab("participants")}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${sidebarTab === "participants" ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              >
                Nodes
              </button>
              <button
                onClick={() => setSidebarTab("chat")}
                className={`flex-1 py-3 text-xs font-bold uppercase transition-all ${sidebarTab === "chat" ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5" : "text-slate-500 hover:text-slate-300 hover:bg-white/5"}`}
              >
                Comms
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 custom-scrollbar">
              {sidebarTab === "participants" ? (
                <Participants
                  participants={allParticipants}
                  peerStates={peerStates}
                  audioEnabled={audioEnabled}
                  videoEnabled={videoEnabled}
                  currentUserId={userId}
                />
              ) : (
                <Chat
                  roomId={roomId}
                  userId={userId}
                  userName={userName}
                  messages={chatMessages}
                  onSendMessage={handleSendMessage}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      <footer className="relative z-30 pb-6 pt-2 flex justify-center pointer-events-none">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full px-8 py-3 flex justify-center items-center space-x-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto">
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${audioEnabled ? "bg-white/5 border-white/10 text-white" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
          >
            {audioEnabled ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            )}
          </button>

          <button
            onClick={toggleVideo}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${videoEnabled ? "bg-white/5 border-white/10 text-white" : "bg-red-500/10 border-red-500/30 text-red-400"}`}
          >
            {videoEnabled ? (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
            )}
          </button>
          <div className="w-px h-8 bg-white/10 mx-2"></div>

          <button
            onClick={() => {
              setShowSidebar(!showSidebar);
              setSidebarTab("chat");
            }}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${showSidebar && sidebarTab === "chat" ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "bg-white/5 border-white/10 text-slate-300"}`}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Room;
