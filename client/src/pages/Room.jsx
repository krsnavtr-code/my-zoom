import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { io } from "socket.io-client";
import axios from "axios";
import useWebRTC from "../hooks/useWebRTC";
import Video from "../components/Video";
import Chat from "../components/Chat";
import Participants from "../components/Participants";

const Room = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [participantId, setParticipantId] = useState("");
  const [showSidebar, setShowSidebar] = useState(false);
  const [sidebarTab, setSidebarTab] = useState("participants"); // 'participants' or 'chat'
  const [activeSpeaker, setActiveSpeaker] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [meetingSettings, setMeetingSettings] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const socketRef = useRef(null);

  const {
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
  } = useWebRTC(roomId, userId, userName);

  useEffect(() => {
    // Get participant data from localStorage (guest users)
    const participantData = localStorage.getItem("participant");
    if (participantData) {
      const participant = JSON.parse(participantData);
      setUserName(participant.name);
      setUserId(participant.participantId || uuidv4());
      setParticipantId(participant.participantId);
    } else {
      // Fallback to user data if logged in
      const userData = localStorage.getItem("user");
      if (userData) {
        const user = JSON.parse(userData);
        setUserName(user.name);
        setUserId(user.id || uuidv4());
      } else {
        // Generate anonymous user ID if not logged in
        setUserId(uuidv4());
        setUserName("Guest");
      }
    }

    // Socket for notifications
    socketRef.current = io(import.meta.env.VITE_API_URL);

    // Listen for meeting settings
    socketRef.current.on("meeting-settings", (settings) => {
      setMeetingSettings(settings);
      setIsHost(settings.hostId === userId);
    });

    // Listen for user joined
    socketRef.current.on(
      "user-connected",
      ({ userId: joinedUserId, userName: joinedUserName }) => {
        addNotification(
          `Node ${joinedUserName} connected to network.`,
          "success",
        );
      },
    );

    // Listen for user left
    socketRef.current.on("user-disconnected", (leftUserId) => {
      addNotification("A node has disconnected from the grid.", "info");
    });

    // Listen for hand raised
    socketRef.current.on(
      "user-hand-raised",
      ({ userId: handUserId, isRaised }) => {
        if (handUserId === userId) {
          setHandRaised(isRaised);
        }
        if (isRaised) {
          addNotification("A participant is requesting uplink.", "info");
        }
      },
    );

    // Listen for kicked
    socketRef.current.on("kicked-from-room", () => {
      addNotification("Connection terminated by host.", "error");
      setTimeout(() => {
        leaveRoom();
        navigate("/dashboard");
      }, 2000);
    });

    // Listen for force mute
    socketRef.current.on("force-mute", () => {
      if (audioEnabled) {
        toggleAudio();
        addNotification("Host has overridden audio transmission.", "info");
      }
    });

    // Listen for meeting locked
    socketRef.current.on("meeting-locked", ({ isLocked }) => {
      if (meetingSettings) {
        setMeetingSettings({ ...meetingSettings, isLocked });
      }
      addNotification(
        isLocked ? "Network encrypted and locked." : "Network unlocked.",
        "info",
      );
    });

    // Keyboard shortcuts
    const handleKeyDown = (e) => {
      // Only trigger if not typing in an input field
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") {
        return;
      }

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
      socketRef.current?.disconnect();
    };
  }, [toggleAudio, toggleVideo, toggleScreenShare]);

  const addNotification = (message, type = "info") => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, message, type }]);
    // Auto-dismiss after 3 seconds
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
    socketRef.current?.emit("mute-all", {
      roomId,
      hostId: userId,
    });
    addNotification("Global mute protocol engaged.", "success");
  };

  const formatRecordingTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleLeave = async () => {
    // Update participant leave time in database
    if (participantId) {
      try {
        await axios.put(
          `${import.meta.env.VITE_API_URL}/api/meeting/participant/${participantId}/leave`,
        );
      } catch (error) {
        console.error("Error updating leave time:", error);
      }
    }

    // Clear participant data from localStorage
    localStorage.removeItem("participant");

    leaveRoom();

    // Navigate to dashboard if user is logged in, otherwise to landing page
    const userData = localStorage.getItem("user");
    if (userData) {
      navigate("/dashboard");
    } else {
      navigate("/");
    }
  };

  const getGridClass = (count) => {
    if (count === 1) return "grid-cols-1 max-w-4xl mx-auto h-full pb-10";
    if (count <= 4) return "grid-cols-2";
    if (count <= 9) return "grid-cols-3";
    if (count <= 16) return "grid-cols-4";
    return "grid-cols-5";
  };

  const participantCount = Object.keys(peers).length + 1; // +1 for local user

  // Get all participants including local user
  const allParticipants = [
    {
      id: userId,
      name: `${userName} (You)`,
      stream: localStream,
      isLocal: true,
    },
    ...Object.entries(peers).map(([peerId, stream]) => ({
      id: peerId,
      name: `User ${peerId.slice(0, 8)}`,
      stream: stream,
      isLocal: false,
    })),
  ];

  if (!localStream) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center relative overflow-hidden font-sans">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="text-center relative z-10">
          <div className="w-16 h-16 border-4 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-6 shadow-[0_0_30px_rgba(6,182,212,0.5)]"></div>
          <p className="text-cyan-400 font-bold tracking-widest uppercase text-sm mb-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
            Establishing Link...
          </p>
          <p className="text-slate-500 text-xs">
            Awaiting hardware permissions for audiovisual matrix.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col relative overflow-hidden font-sans text-slate-300">
      {/* Background Grid & Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-0 left-1/4 w-[50%] h-[30%] bg-cyan-900/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Toast Notifications */}
      <div className="fixed top-20 right-4 z-50 space-y-3">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-3 rounded-xl backdrop-blur-xl border text-xs font-semibold animate-slide-in shadow-[0_0_20px_rgba(0,0,0,0.5)] flex items-center gap-2 ${
              notification.type === "success"
                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                : notification.type === "error"
                  ? "bg-red-500/10 border-red-500/30 text-red-400"
                  : "bg-white/5 border-white/10 text-slate-300"
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${notification.type === "success" ? "bg-cyan-400" : notification.type === "error" ? "bg-red-400" : "bg-slate-300"} animate-pulse`}
            />
            {notification.message}
          </div>
        ))}
      </div>

      {/* Floating Header */}
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

            {isHost && (
              <span className="bg-fuchsia-500/10 border border-fuchsia-500/30 text-fuchsia-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(217,70,239,0.2)]">
                Admin
              </span>
            )}

            {meetingSettings?.isLocked && (
              <span className="bg-red-500/10 border border-red-500/30 text-red-400 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center space-x-1 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span>Secured</span>
              </span>
            )}

            <span
              className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center space-x-1.5 border ${
                connectionQuality === "good"
                  ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                  : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]"
              }`}
            >
              <div
                className={`w-1.5 h-1.5 rounded-full ${connectionQuality === "good" ? "bg-cyan-400" : "bg-yellow-400 animate-pulse"}`}
              />
              <span>{connectionQuality === "good" ? "Stable" : "Weak"}</span>
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {isHost && (
              <>
                <button
                  onClick={handleLockMeeting}
                  className={`p-2 rounded-xl transition-all border ${
                    meetingSettings?.isLocked
                      ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white"
                  }`}
                  title={
                    meetingSettings?.isLocked
                      ? "Unlock Network"
                      : "Lock Network"
                  }
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleMuteAll}
                  className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                  title="Global Mute"
                >
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </>
            )}
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-xl transition-all border ${
                isRecording
                  ? "bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white"
              }`}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
              </svg>
            </button>

            {isRecording && (
              <div className="flex items-center space-x-2 bg-red-500/20 border border-red-500/30 px-3 py-1.5 rounded-lg shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                <span className="text-red-400 text-xs font-mono font-bold tracking-wider">
                  {formatRecordingTime(recordingTime)}
                </span>
              </div>
            )}

            <button
              onClick={handleRaiseHand}
              className={`p-2 rounded-xl transition-all border ${
                handRaised
                  ? "bg-yellow-500/20 border-yellow-500/50 text-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.3)]"
                  : "bg-white/5 border-white/10 hover:bg-white/10 text-slate-400 hover:text-white"
              }`}
              title={handRaised ? "Lower Hand" : "Raise Hand"}
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
              </svg>
            </button>

            <button
              onClick={handleLeave}
              className="ml-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/50 text-red-400 px-4 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
            >
              Abort
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative z-10 px-4">
        {/* Video Grid Area */}
        <main
          className={`flex-1 overflow-auto transition-all duration-300 ${showSidebar ? "pr-4" : ""}`}
        >
          <div
            className={`grid ${getGridClass(participantCount)} gap-4 w-full h-full content-center`}
          >
            {/* All Videos */}
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

                  {/* Neon border glow for active speaker - assume handled conditionally if implemented, but adding subtle overlay here */}
                  <div className="absolute inset-0 border-2 border-transparent group-hover:border-cyan-500/30 rounded-2xl transition-colors pointer-events-none" />

                  {/* Audio disabled fallback */}
                  {!videoEnabled && participant.isLocal && (
                    <div className="absolute inset-0 bg-[#0a0a0f] flex items-center justify-center">
                      <div className="w-20 h-20 bg-gradient-to-tr from-cyan-600/30 to-blue-600/30 border border-cyan-500/50 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.3)]">
                        <span className="text-cyan-400 text-3xl font-bold font-mono">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Name Tag */}
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1 rounded-lg text-xs font-medium text-slate-200">
                    {participant.name}
                  </div>
                </div>
              );
            })}
          </div>
        </main>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-80 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.8)] h-[calc(100vh-160px)]">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-white/10 bg-white/5">
              <button
                onClick={() => setSidebarTab("participants")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                  sidebarTab === "participants"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                Nodes ({participantCount})
              </button>
              <button
                onClick={() => setSidebarTab("chat")}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all ${
                  sidebarTab === "chat"
                    ? "text-cyan-400 border-b-2 border-cyan-400 bg-cyan-500/5"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
              >
                Comms
              </button>
            </div>

            {/* Sidebar Content */}
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
                <Chat roomId={roomId} userId={userId} userName={userName} />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Floating Control Bar */}
      <footer className="relative z-30 pb-6 pt-2 flex justify-center pointer-events-none">
        <div className="bg-black/60 backdrop-blur-2xl border border-white/10 rounded-full px-8 py-3 flex justify-center items-center space-x-4 shadow-[0_0_50px_rgba(0,0,0,0.8)] pointer-events-auto">
          {/* Mute/Unmute */}
          <button
            onClick={toggleAudio}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${
              audioEnabled
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10"
                : "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500/20"
            }`}
            title={audioEnabled ? "Mute" : "Unmute"}
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

          {/* Video On/Off */}
          <button
            onClick={toggleVideo}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${
              videoEnabled
                ? "bg-white/5 border-white/10 text-white hover:bg-white/10"
                : "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.3)] hover:bg-red-500/20"
            }`}
            title={videoEnabled ? "Stop Feed" : "Start Feed"}
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

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${
              isScreenSharing
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
            title={isScreenSharing ? "Stop Broadcast" : "Broadcast Screen"}
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
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
          </button>

          {/* Chat Toggle */}
          <button
            onClick={() => {
              if (showSidebar && sidebarTab === "chat") {
                setShowSidebar(false);
              } else {
                setShowSidebar(true);
                setSidebarTab("chat");
              }
            }}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border ${
              showSidebar && sidebarTab === "chat"
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
            title="Comms"
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

          {/* Participants Toggle */}
          <button
            onClick={() => {
              if (showSidebar && sidebarTab === "participants") {
                setShowSidebar(false);
              } else {
                setShowSidebar(true);
                setSidebarTab("participants");
              }
            }}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all border relative ${
              showSidebar && sidebarTab === "participants"
                ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)]"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white"
            }`}
            title="Nodes"
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
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            {/* Small participant counter badge */}
            <span className="absolute -top-1 -right-1 bg-cyan-500 text-[10px] font-bold text-black w-4 h-4 flex items-center justify-center rounded-full border border-black">
              {participantCount}
            </span>
          </button>
        </div>
      </footer>

      {/* Optional Custom Scrollbar CSS (Global or Scoped) */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.6);
        }
      `,
        }}
      />
    </div>
  );
};

export default Room;
