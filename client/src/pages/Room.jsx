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
        addNotification(`${joinedUserName} joined the meeting`, "success");
      },
    );

    // Listen for user left
    socketRef.current.on("user-disconnected", (leftUserId) => {
      addNotification("A participant left the meeting", "info");
    });

    // Listen for hand raised
    socketRef.current.on(
      "user-hand-raised",
      ({ userId: handUserId, isRaised }) => {
        if (handUserId === userId) {
          setHandRaised(isRaised);
        }
        if (isRaised) {
          addNotification("A participant raised their hand", "info");
        }
      },
    );

    // Listen for kicked
    socketRef.current.on("kicked-from-room", () => {
      addNotification("You have been removed from the meeting", "error");
      setTimeout(() => {
        leaveRoom();
        navigate("/dashboard");
      }, 2000);
    });

    // Listen for force mute
    socketRef.current.on("force-mute", () => {
      if (audioEnabled) {
        toggleAudio();
        addNotification("Host muted your microphone", "info");
      }
    });

    // Listen for meeting locked
    socketRef.current.on("meeting-locked", ({ isLocked }) => {
      if (meetingSettings) {
        setMeetingSettings({ ...meetingSettings, isLocked });
      }
      addNotification(
        isLocked ? "Meeting is now locked" : "Meeting is now unlocked",
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
    addNotification("All participants have been muted", "success");
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
    navigate("/");
  };

  const getGridClass = (count) => {
    if (count === 1) return "grid-cols-1";
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to room...</p>
          <p className="text-gray-400 text-sm mt-2">
            Please allow camera and microphone access
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        {notifications.map((notification) => (
          <div
            key={notification.id}
            className={`px-4 py-3 rounded-lg shadow-lg text-white text-sm animate-slide-in ${
              notification.type === "success"
                ? "bg-green-600"
                : notification.type === "error"
                  ? "bg-red-600"
                  : "bg-blue-600"
            }`}
          >
            {notification.message}
          </div>
        ))}
      </div>
      {/* Header */}
      <header className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h1 className="text-lg font-semibold">ZoomClone</h1>
          <span className="text-gray-400">|</span>
          <span className="text-sm">Room: {roomId}</span>
          <span className="text-gray-400">|</span>
          <span className="text-sm">{participantCount} participants</span>
          {isHost && (
            <span className="bg-yellow-600 text-xs px-2 py-1 rounded">
              Host
            </span>
          )}
          {meetingSettings?.isLocked && (
            <span className="bg-red-600 text-xs px-2 py-1 rounded flex items-center space-x-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Locked</span>
            </span>
          )}
          <span
            className={`text-xs px-2 py-1 rounded flex items-center space-x-1 ${
              connectionQuality === "good" ? "bg-green-600" : "bg-yellow-600"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${connectionQuality === "good" ? "bg-white" : "bg-white animate-pulse"}`}
            />
            <span>{connectionQuality === "good" ? "Good" : "Poor"}</span>
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {isHost && (
            <>
              <button
                onClick={handleLockMeeting}
                className={`p-2 rounded-lg transition-colors ${
                  meetingSettings?.isLocked
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-gray-700 hover:bg-gray-600"
                }`}
                title={
                  meetingSettings?.isLocked ? "Unlock Meeting" : "Lock Meeting"
                }
              >
                <svg
                  className="w-5 h-5"
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
                className="p-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors"
                title="Mute All"
              >
                <svg
                  className="w-5 h-5"
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
            className={`p-2 rounded-lg transition-colors ${
              isRecording
                ? "bg-red-600 hover:bg-red-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={isRecording ? "Stop Recording" : "Start Recording"}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
            </svg>
          </button>
          {isRecording && (
            <div className="flex items-center space-x-2 bg-red-600 px-3 py-1 rounded">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-mono">
                {formatRecordingTime(recordingTime)}
              </span>
            </div>
          )}
          <button
            onClick={handleRaiseHand}
            className={`p-2 rounded-lg transition-colors ${
              handRaised
                ? "bg-yellow-600 hover:bg-yellow-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={handRaised ? "Lower Hand" : "Raise Hand"}
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Leave
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Grid Area */}
        <main
          className={`flex-1 p-4 overflow-auto transition-all duration-300 ${showSidebar ? "mr-80" : ""}`}
        >
          <div
            className={`grid ${getGridClass(participantCount)} gap-4 max-w-7xl mx-auto`}
          >
            {/* All Videos */}
            {allParticipants.map((participant) => {
              const state = participant.isLocal
                ? { isScreenSharing }
                : peerStates[participant.id] || { isScreenSharing: false };

              return (
                <div key={participant.id} className="relative">
                  <Video
                    stream={participant.stream}
                    muted={participant.isLocal}
                    name={participant.name}
                    isScreenSharing={state.isScreenSharing}
                  />
                  {!videoEnabled && participant.isLocal && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                        <span className="text-white text-2xl font-bold">
                          {userName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* Sidebar */}
        {showSidebar && (
          <aside className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* Sidebar Tabs */}
            <div className="flex border-b border-gray-700">
              <button
                onClick={() => setSidebarTab("participants")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  sidebarTab === "participants"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Participants ({participantCount})
              </button>
              <button
                onClick={() => setSidebarTab("chat")}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  sidebarTab === "chat"
                    ? "text-blue-400 border-b-2 border-blue-400"
                    : "text-gray-400 hover:text-gray-300"
                }`}
              >
                Chat
              </button>
            </div>

            {/* Sidebar Content */}
            <div className="flex-1 overflow-auto p-4">
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

      {/* Control Bar */}
      <footer className="bg-gray-800 text-white px-4 py-4">
        <div className="flex justify-center items-center space-x-4">
          {/* Mute/Unmute */}
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full transition-colors ${
              audioEnabled
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={audioEnabled ? "Mute" : "Unmute"}
          >
            {audioEnabled ? (
              <svg
                className="w-6 h-6"
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
                className="w-6 h-6"
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
            className={`p-4 rounded-full transition-colors ${
              videoEnabled
                ? "bg-gray-700 hover:bg-gray-600"
                : "bg-red-600 hover:bg-red-700"
            }`}
            title={videoEnabled ? "Stop Video" : "Start Video"}
          >
            {videoEnabled ? (
              <svg
                className="w-6 h-6"
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
                className="w-6 h-6"
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

          {/* Screen Share */}
          <button
            onClick={toggleScreenShare}
            className={`p-4 rounded-full transition-colors ${
              isScreenSharing
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title={isScreenSharing ? "Stop Sharing" : "Share Screen"}
          >
            <svg
              className="w-6 h-6"
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
              setShowSidebar(!showSidebar);
              setSidebarTab("chat");
            }}
            className={`p-4 rounded-full transition-colors ${
              showSidebar && sidebarTab === "chat"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Chat"
          >
            <svg
              className="w-6 h-6"
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
              setShowSidebar(!showSidebar);
              setSidebarTab("participants");
            }}
            className={`p-4 rounded-full transition-colors ${
              showSidebar && sidebarTab === "participants"
                ? "bg-blue-600 hover:bg-blue-700"
                : "bg-gray-700 hover:bg-gray-600"
            }`}
            title="Participants"
          >
            <svg
              className="w-6 h-6"
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
          </button>
        </div>
      </footer>
    </div>
  );
};

export default Room;
