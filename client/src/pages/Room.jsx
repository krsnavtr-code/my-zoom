import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import useWebRTC from '../hooks/useWebRTC';
import Video from '../components/Video';
import ProtectedRoute from '../components/ProtectedRoute';

const Room = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [userName, setUserName] = useState('');

  const {
    localStream,
    peers,
    audioEnabled,
    videoEnabled,
    userVideoRef,
    toggleAudio,
    toggleVideo,
    leaveRoom,
  } = useWebRTC(roomId, userId);

  useEffect(() => {
    // Get user data from localStorage
    const userData = localStorage.getItem('user');
    if (userData) {
      const user = JSON.parse(userData);
      setUserName(user.name);
      setUserId(user.id || uuidv4());
    } else {
      // Generate anonymous user ID if not logged in
      setUserId(uuidv4());
      setUserName('Guest');
    }
  }, []);

  const handleLeave = () => {
    leaveRoom();
    navigate('/dashboard');
  };

  const getGridClass = (count) => {
    if (count === 1) return 'grid-cols-1';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 9) return 'grid-cols-3';
    if (count <= 16) return 'grid-cols-4';
    return 'grid-cols-5';
  };

  const participantCount = Object.keys(peers).length + 1; // +1 for local user

  if (!localStream) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Connecting to room...</p>
          <p className="text-gray-400 text-sm mt-2">Please allow camera and microphone access</p>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-900 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 text-white px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-lg font-semibold">ZoomClone</h1>
            <span className="text-gray-400">|</span>
            <span className="text-sm">Room: {roomId}</span>
            <span className="text-gray-400">|</span>
            <span className="text-sm">{participantCount} participants</span>
          </div>
          <button
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            Leave
          </button>
        </header>

        {/* Video Grid */}
        <main className="flex-1 p-4 overflow-auto">
          <div className={`grid ${getGridClass(participantCount)} gap-4 max-w-7xl mx-auto`}>
            {/* Local Video */}
            <div className="relative">
              <Video
                stream={localStream}
                muted={true}
                name={`${userName} (You)`}
              />
              {!videoEnabled && (
                <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-2xl font-bold">
                      {userName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Remote Videos */}
            {Object.entries(peers).map(([peerId, stream]) => (
              <div key={peerId} className="relative">
                <Video stream={stream} name={`User ${peerId.slice(0, 8)}`} />
              </div>
            ))}
          </div>
        </main>

        {/* Control Bar */}
        <footer className="bg-gray-800 text-white px-4 py-4">
          <div className="flex justify-center items-center space-x-4">
            {/* Mute/Unmute */}
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full transition-colors ${
                audioEnabled
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  ? 'bg-gray-700 hover:bg-gray-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={videoEnabled ? 'Stop Video' : 'Start Video'}
            >
              {videoEnabled ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                  />
                </svg>
              )}
            </button>

            {/* Screen Share (Placeholder) */}
            <button
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Share Screen"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </button>

            {/* Chat (Placeholder) */}
            <button
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Chat"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </button>

            {/* Participants (Placeholder) */}
            <button
              className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
              title="Participants"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    </ProtectedRoute>
  );
};

export default Room;
