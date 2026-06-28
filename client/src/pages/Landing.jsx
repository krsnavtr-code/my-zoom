import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";

const Landing = () => {
  const navigate = useNavigate();
  const [meetingId, setMeetingId] = useState("");

  const handleJoinMeeting = (e) => {
    e.preventDefault();
    if (meetingId.trim()) {
      navigate(`/join/${meetingId.trim()}`);
    }
  };

  const handleCreateMeeting = () => {
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 flex flex-col font-sans relative overflow-hidden">
      {/* Futuristic Background Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-900/20 blur-[120px] rounded-full pointer-events-none" />

      {/* Floating Glass Header */}
      <header className="relative z-10 w-full max-w-4xl mx-auto mt-4 px-4">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-full px-6 py-3 flex justify-between items-center shadow-[0_0_15px_rgba(0,0,0,0.5)]">
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
              Connect ClassRoom
            </span>
          </div>
          <div className="flex space-x-3 text-sm">
            <Link
              to="/login"
              className="px-4 py-1.5 text-slate-300 hover:text-cyan-400 font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/signup"
              className="px-4 py-1.5 bg-white/10 border border-white/10 text-white rounded-full hover:bg-white/20 hover:border-cyan-500/50 transition-all"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </header>

      {/* Compact Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full text-center">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 tracking-tighter">
            Connect anywhere,
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-fuchsia-500 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              in real-time.
            </span>
          </h1>
          <p className="text-sm sm:text-base text-slate-400 mb-8 max-w-lg mx-auto">
            High-fidelity video transmission. Encrypted, fast, and lightweight.
          </p>

          {/* Cyberpunk Join Form */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 mb-8 max-w-md mx-auto shadow-2xl">
            <p className="mb-3 text-slate-300">Enter Meeting ID to Join</p>
            <form onSubmit={handleJoinMeeting} className="flex gap-2">
              <input
                type="text"
                value={meetingId}
                onChange={(e) => setMeetingId(e.target.value)}
                placeholder="Enter meeting ID..."
                className="flex-1 bg-black/50 px-4 py-2 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 placeholder-slate-500 text-sm transition-all"
                required
              />
              <button
                type="submit"
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl hover:from-cyan-500 hover:to-blue-500 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)]"
              >
                Join Meeting
              </button>
            </form>
          </div>

          {/* Compact Action Buttons */}
          <div className="flex justify-center gap-3">
            <button
              onClick={handleCreateMeeting}
              className="px-6 py-2 bg-white/10 border border-fuchsia-500/30 text-white rounded-xl hover:bg-fuchsia-500/20 hover:border-fuchsia-500 hover:shadow-[0_0_15px_rgba(217,70,239,0.4)] font-medium text-sm transition-all"
            >
              Click here to Schedule or Create Instant meeting
            </button>
          </div>
        </div>

        {/* Minimalist Feature Row */}
        <div className="mt-12 flex flex-wrap justify-center gap-4 max-w-3xl">
          {[
            {
              icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
              text: "4K Transmission",
            },
            {
              icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
              text: "Quantum Encryption",
            },
            { icon: "M13 10V3L4 14h7v7l9-11h-7z", text: "Zero Latency" },
          ].map((feature, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 bg-white/5 border border-white/5 px-4 py-2 rounded-full backdrop-blur-sm"
            >
              <svg
                className="w-4 h-4 text-cyan-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={feature.icon}
                />
              </svg>
              <span className="text-xs font-medium text-slate-300">
                {feature.text}
              </span>
            </div>
          ))}
        </div>
      </main>

      {/* Tiny Footer */}
      <footer className="relative z-10 py-4 text-center text-xs text-slate-600 border-t border-white/5 bg-black/20">
        <p>&copy; 2026 Connect ClassRoom. Protocol active.</p>
      </footer>
    </div>
  );
};

export default Landing;
