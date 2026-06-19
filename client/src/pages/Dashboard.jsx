import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [meetingType, setMeetingType] = useState("instant"); // 'instant' or 'scheduled'
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [meetingDuration, setMeetingDuration] = useState(60);
  const [meetingPassword, setMeetingPassword] = useState("");
  const [createdMeetingId, setCreatedMeetingId] = useState("");
  const [createdMeetingLink, setCreatedMeetingLink] = useState("");
  const [showIdCopied, setShowIdCopied] = useState(false);
  const [showLinkCopied, setShowLinkCopied] = useState(false);
  const navigate = useNavigate();

  // Generate 12-digit meeting ID
  const generateMeetingId = () => {
    const digits = "0123456789";
    let meetingId = "";
    for (let i = 0; i < 12; i++) {
      meetingId += digits.charAt(Math.floor(Math.random() * digits.length));
    }
    return meetingId;
  };

  useEffect(() => {
    // Get user from localStorage
    const userData = localStorage.getItem("user");
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  const handleCreateMeeting = () => {
    setShowMeetingModal(true);
  };

  const handleStartMeeting = () => {
    const newMeetingId = generateMeetingId();
    const meetingLink = `${window.location.origin}/room/${newMeetingId}`;

    if (meetingType === "instant") {
      navigate(`/room/${newMeetingId}`);
    } else {
      // For scheduled meetings, show the link and copy it
      setCreatedMeetingId(newMeetingId);
      setCreatedMeetingLink(meetingLink);
      setShowIdCopied(false);
      setShowLinkCopied(false);
      // Copy ID to clipboard
      navigator.clipboard.writeText(newMeetingId);
      setShowIdCopied(true);
      setTimeout(() => setShowIdCopied(false), 3000);
    }
  };

  const handleCopyId = () => {
    navigator.clipboard.writeText(createdMeetingId);
    setShowIdCopied(true);
    setTimeout(() => setShowIdCopied(false), 3000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(createdMeetingLink);
    setShowLinkCopied(true);
    setTimeout(() => setShowLinkCopied(false), 3000);
  };

  const handleJoinCreatedMeeting = () => {
    navigate(`/join/${createdMeetingId}`);
  };

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (roomId.trim()) {
      navigate(`/join/${roomId.trim()}`);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 relative overflow-hidden font-sans flex flex-col">
      {/* Futuristic Background Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Floating Glass Header */}
      <header className="relative z-10 w-full max-w-5xl mx-auto mt-4 px-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-6 py-2.5 flex justify-between items-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-md flex items-center justify-center shadow-[0_0_10px_rgba(6,182,212,0.5)]">
              <svg
                className="w-5 h-5 text-white"
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
            </div>
            <span className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
              ZoomClone
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-cyan-400 font-medium tracking-wide">
              OPERATOR: {user?.name || "GUEST"}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 bg-red-500/10 border border-red-500/30 text-red-400 rounded-full hover:bg-red-500/20 hover:border-red-500 hover:shadow-[0_0_10px_rgba(239,68,68,0.3)] text-xs font-semibold transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 py-10 flex flex-col items-center">
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white mb-2 tracking-tight">
            Welcome back,{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              {user?.name}
            </span>
          </h1>
          <p className="text-sm text-slate-400">
            Command center online. Awaiting protocol initiation.
          </p>
        </div>

        {/* Compact Meeting Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl w-full mx-auto">
          {/* Create Node Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] hover:border-cyan-500/50 transition-all group flex flex-col justify-between">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-cyan-500/10 border border-cyan-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                <svg
                  className="w-7 h-7 text-cyan-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                Initialize Node
              </h2>
              <p className="text-xs text-slate-400">
                Establish a new secure transmission channel.
              </p>
            </div>
            <button
              onClick={handleCreateMeeting}
              className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
            >
              Create Session
            </button>
          </div>

          {/* Join Node Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)] hover:border-fuchsia-500/50 transition-all group flex flex-col justify-between">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-fuchsia-500/10 border border-fuchsia-500/30 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(217,70,239,0.2)]">
                <svg
                  className="w-7 h-7 text-fuchsia-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-1">
                Link to Target
              </h2>
              <p className="text-xs text-slate-400">
                Enter meeting ID to join active session.
              </p>
            </div>
            <form onSubmit={handleJoinMeeting} className="space-y-3">
              <input
                type="text"
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                placeholder="Enter meeting ID..."
                className="w-full bg-black/50 px-4 py-2.5 border border-slate-700 rounded-xl focus:ring-1 focus:ring-fuchsia-500 focus:border-fuchsia-500 outline-none text-fuchsia-50 placeholder-slate-600 text-sm transition-all text-center"
                required
              />
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white py-2.5 rounded-xl hover:from-fuchsia-500 hover:to-purple-500 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(217,70,239,0.4)]"
              >
                Join Meeting
              </button>
            </form>
          </div>
        </div>

        {/* Meeting Modal */}
        {showMeetingModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans">
            <div className="bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-sm w-full max-h-[90vh] overflow-y-auto relative">
              {/* Modal Inner Grid Background */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none rounded-2xl" />

              <div className="p-6 relative z-10">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                  <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
                    Initialize Channel
                  </h2>
                  <button
                    onClick={() => {
                      setShowMeetingModal(false);
                      setCreatedMeetingId("");
                      setCreatedMeetingLink("");
                      setMeetingType("instant");
                    }}
                    className="text-slate-500 hover:text-cyan-400 transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                {!createdMeetingLink ? (
                  <>
                    {/* Meeting Type Selection */}
                    <div className="mb-5">
                      <label className="block text-[11px] uppercase tracking-wider font-medium text-slate-400 mb-2">
                        Connection Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => setMeetingType("instant")}
                          className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            meetingType === "instant"
                              ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                              : "bg-black/50 border-white/10 hover:border-white/30"
                          }`}
                        >
                          <svg
                            className={`w-5 h-5 ${meetingType === "instant" ? "text-cyan-400" : "text-slate-500"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M13 10V3L4 14h7v7l9-11h-7z"
                            />
                          </svg>
                          <span
                            className={`text-xs font-semibold ${meetingType === "instant" ? "text-cyan-50" : "text-slate-400"}`}
                          >
                            Instant
                          </span>
                        </button>

                        <button
                          onClick={() => setMeetingType("scheduled")}
                          className={`p-3 rounded-xl border transition-all flex flex-col items-center justify-center gap-2 ${
                            meetingType === "scheduled"
                              ? "bg-cyan-500/10 border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                              : "bg-black/50 border-white/10 hover:border-white/30"
                          }`}
                        >
                          <svg
                            className={`w-5 h-5 ${meetingType === "scheduled" ? "text-cyan-400" : "text-slate-500"}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                          <span
                            className={`text-xs font-semibold ${meetingType === "scheduled" ? "text-cyan-50" : "text-slate-400"}`}
                          >
                            Schedule
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* Scheduled Meeting Options */}
                    {meetingType === "scheduled" && (
                      <div className="space-y-3 mb-6 bg-white/5 p-4 rounded-xl border border-white/5">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-400 mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={scheduledDate}
                              onChange={(e) => setScheduledDate(e.target.value)}
                              className="w-full bg-black/50 px-3 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 text-xs transition-all [color-scheme:dark]"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-400 mb-1">
                              Time
                            </label>
                            <input
                              type="time"
                              value={scheduledTime}
                              onChange={(e) => setScheduledTime(e.target.value)}
                              className="w-full bg-black/50 px-3 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 text-xs transition-all [color-scheme:dark]"
                              required
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-400 mb-1">
                            Duration
                          </label>
                          <select
                            value={meetingDuration}
                            onChange={(e) =>
                              setMeetingDuration(parseInt(e.target.value))
                            }
                            className="w-full bg-black/50 px-3 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 text-xs transition-all [&>option]:bg-[#0a0a0f]"
                          >
                            <option value={15}>15 minutes</option>
                            <option value={30}>30 minutes</option>
                            <option value={45}>45 minutes</option>
                            <option value={60}>1 hour</option>
                            <option value={90}>1.5 hours</option>
                            <option value={120}>2 hours</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-400 mb-1">
                            Security Key (Optional)
                          </label>
                          <input
                            type="password"
                            value={meetingPassword}
                            onChange={(e) => setMeetingPassword(e.target.value)}
                            placeholder="Enter custom passphrase"
                            className="w-full bg-black/50 px-3 py-2 border border-slate-700 rounded-lg focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 placeholder-slate-600 text-xs transition-all"
                          />
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => {
                          setShowMeetingModal(false);
                          setCreatedMeetingId("");
                          setCreatedMeetingLink("");
                          setMeetingType("instant");
                        }}
                        className="w-1/3 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 hover:text-white text-sm font-medium transition-colors"
                      >
                        Abort
                      </button>
                      <button
                        onClick={handleStartMeeting}
                        disabled={
                          meetingType === "scheduled" &&
                          (!scheduledDate || !scheduledTime)
                        }
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                      >
                        {meetingType === "instant"
                          ? "Deploy Session"
                          : "Schedule Transmission"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Success State */}
                    <div className="text-center mb-6">
                      <div className="w-12 h-12 bg-cyan-500/20 border border-cyan-500/50 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                        <svg
                          className="w-6 h-6 text-cyan-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                      <h3 className="text-lg font-bold text-white mb-1">
                        Channel Established
                      </h3>
                      <p className="text-xs text-slate-400">
                        Share credentials to allow network entry.
                      </p>
                    </div>

                    {/* ID & Link Display */}
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1">
                          Sequence ID
                        </label>
                        <div className="flex items-center justify-between bg-black/60 border border-slate-700 rounded-lg p-2 pl-3">
                          <input
                            type="text"
                            value={createdMeetingId}
                            readOnly
                            className="bg-transparent text-cyan-400 font-mono text-sm font-bold outline-none w-full"
                          />
                          <button
                            onClick={handleCopyId}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-cyan-400 border border-white/10 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 min-w-[75px] justify-center"
                          >
                            {showIdCopied ? (
                              <>
                                <svg
                                  className="w-3.5 h-3.5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                Copied
                              </>
                            ) : (
                              "Copy ID"
                            )}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase tracking-wider font-medium text-slate-500 mb-1">
                          Direct Uplink
                        </label>
                        <div className="flex items-center justify-between bg-black/60 border border-slate-700 rounded-lg p-2 pl-3">
                          <input
                            type="text"
                            value={createdMeetingLink}
                            readOnly
                            className="bg-transparent text-slate-300 font-mono text-xs outline-none w-full truncate mr-2"
                          />
                          <button
                            onClick={handleCopyLink}
                            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 min-w-[75px] justify-center"
                          >
                            {showLinkCopied ? (
                              <>
                                <svg
                                  className="w-3.5 h-3.5 text-cyan-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                                Copied
                              </>
                            ) : (
                              "Copy"
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Scheduled Details Review */}
                    {meetingType === "scheduled" && (
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 mb-6">
                        <h4 className="text-xs font-semibold text-cyan-400 mb-2 uppercase tracking-wide">
                          Transmission Parameters
                        </h4>
                        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                          <p>
                            <span className="text-slate-500">Date:</span>{" "}
                            {new Date(scheduledDate).toLocaleDateString()}
                          </p>
                          <p>
                            <span className="text-slate-500">Time:</span>{" "}
                            {scheduledTime}
                          </p>
                          <p>
                            <span className="text-slate-500">Duration:</span>{" "}
                            {meetingDuration}m
                          </p>
                          {meetingPassword && (
                            <p>
                              <span className="text-slate-500">Key:</span>{" "}
                              {meetingPassword}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setShowMeetingModal(false);
                          setCreatedMeetingId("");
                          setCreatedMeetingLink("");
                          setMeetingType("instant");
                        }}
                        className="w-1/3 px-4 py-2 bg-white/5 border border-white/10 text-slate-300 rounded-xl hover:bg-white/10 hover:text-white text-sm font-medium transition-colors"
                      >
                        Close
                      </button>
                      <button
                        onClick={handleJoinCreatedMeeting}
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-fuchsia-600 to-purple-600 text-white rounded-xl font-semibold text-sm hover:from-fuchsia-500 hover:to-purple-500 transition-all shadow-[0_0_15px_rgba(217,70,239,0.4)]"
                      >
                        Intercept Now
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Compact Recent Meetings Section */}
        <div className="mt-10 max-w-3xl w-full mx-auto">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3 px-2">
            Transmission History
          </h3>
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 text-center shadow-lg">
            <svg
              className="w-8 h-8 text-slate-600 mx-auto mb-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-slate-400 text-sm">
              No recent network traces found
            </p>
            <p className="text-slate-600 text-[11px] mt-1">
              Archived sessions will index here automatically
            </p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
