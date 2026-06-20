import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { API_URL } from "../config";

const JoinForm = () => {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isCheckingExisting, setIsCheckingExisting] = useState(true);

  // Generate device fingerprint
  const generateDeviceFingerprint = () => {
    const userAgent = navigator.userAgent;
    const screenResolution = `${window.screen.width}x${window.screen.height}`;
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const language = navigator.language;
    const platform = navigator.platform;

    // Create a simple hash from these values
    const fingerprintString = `${userAgent}|${screenResolution}|${timezone}|${language}|${platform}`;
    let hash = 0;
    for (let i = 0; i < fingerprintString.length; i++) {
      const char = fingerprintString.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  };

  // Detect browser and OS
  const detectBrowserAndOS = () => {
    const userAgent = navigator.userAgent;
    let browser = "Unknown";
    let os = "Unknown";

    // Browser detection
    if (userAgent.includes("Firefox")) browser = "Firefox";
    else if (userAgent.includes("Chrome")) browser = "Chrome";
    else if (userAgent.includes("Safari")) browser = "Safari";
    else if (userAgent.includes("Edge")) browser = "Edge";
    else if (userAgent.includes("Opera")) browser = "Opera";

    // OS detection
    if (userAgent.includes("Windows")) os = "Windows";
    else if (userAgent.includes("Mac")) os = "MacOS";
    else if (userAgent.includes("Linux")) os = "Linux";
    else if (userAgent.includes("Android")) os = "Android";
    else if (userAgent.includes("iOS")) os = "iOS";

    return { browser, os };
  };

  useEffect(() => {
    // Check if user is already logged in
    const userData = localStorage.getItem("user");
    if (userData) {
      const user = JSON.parse(userData);
      // Auto-join with existing user data
      autoJoinWithUser(user);
    } else {
      setIsCheckingAuth(false);
      // Check for existing participant by device fingerprint
      checkExistingParticipant();
    }
  }, [roomId]);

  const checkExistingParticipant = async () => {
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const response = await axios.post(
        `${API_URL}/api/meeting/participant/check`,
        { deviceFingerprint },
      );

      if (response.data.exists && response.data.participant) {
        // Auto-fill form with existing data
        setFormData({
          name: response.data.participant.name,
          email: response.data.participant.email,
          phone: response.data.participant.phone,
        });
      }
    } catch (error) {
      console.error("Error checking existing participant:", error);
    } finally {
      setIsCheckingExisting(false);
    }
  };

  const autoJoinWithUser = async (user) => {
    setLoading(true);
    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const { browser, os } = detectBrowserAndOS();

      // Save participant to database with user's info
      const response = await axios.post(`${API_URL}/api/meeting/participant`, {
        meetingId: roomId,
        name: user.name,
        email: user.email,
        phone: user.phone || "0000000000", // Default if phone not available
        deviceFingerprint,
        browser,
        os,
      });

      // Store participant info in localStorage
      localStorage.setItem(
        "participant",
        JSON.stringify({
          name: user.name,
          email: user.email,
          phone: user.phone || "0000000000",
          participantId: response.data.participantId,
          meetingId: roomId,
        }),
      );

      // Navigate to room
      navigate(`/room/${roomId}`);
    } catch (err) {
      console.error("Auto-join failed:", err);
      setIsCheckingAuth(false);
      setError(
        err.response?.data?.message ||
          "Auto-connection failed. Please enter details manually.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validate fields
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.phone.trim()
    ) {
      setError("All parameters are required for sync.");
      return;
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError("Invalid identity sequence (Email).");
      return;
    }

    // Validate phone (basic validation)
    const phoneRegex = /^[0-9]{10,}$/;
    if (!phoneRegex.test(formData.phone.replace(/[\s-]/g, ""))) {
      setError("Invalid commlink frequency. Minimum 10 digits required.");
      return;
    }

    setLoading(true);

    try {
      const deviceFingerprint = generateDeviceFingerprint();
      const { browser, os } = detectBrowserAndOS();

      // Save participant to database
      const response = await axios.post(`${API_URL}/api/meeting/participant`, {
        meetingId: roomId,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        deviceFingerprint,
        browser,
        os,
      });

      // Store participant info in localStorage
      localStorage.setItem(
        "participant",
        JSON.stringify({
          ...formData,
          participantId: response.data.participantId,
          meetingId: roomId,
        }),
      );

      // Navigate to room
      navigate(`/room/${roomId}`);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Connection failed. Node may be offline.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-slate-300 flex items-center justify-center px-4 relative overflow-hidden font-sans">
      {/* Futuristic Background Grid & Glow */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-fuchsia-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-sm w-full relative z-10 py-8">
        {/* Loading state while checking auth */}
        {isCheckingAuth || isCheckingExisting || loading ? (
          <div className="text-center">
            <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
              <svg
                className="w-7 h-7 text-white animate-spin"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
              Establishing Connection...
            </h1>
            <p className="text-xs text-slate-400 mt-2">
              Verifying identity parameters
            </p>
          </div>
        ) : (
          <>
            {/* Header / Logo */}
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4 shadow-[0_0_15px_rgba(6,182,212,0.5)]">
                <svg
                  className="w-7 h-7 text-white"
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
              <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight">
                Intercept Node
              </h1>
              <p className="text-xs text-slate-400 mt-1 flex items-center justify-center gap-1">
                Target ID:{" "}
                <span className="font-mono text-cyan-400">{roomId}</span>
              </p>
            </div>

            {/* Cyberpunk Form Card */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-[0_0_30px_rgba(0,0,0,0.8)]">
              {error && (
                <div className="bg-red-500/10 border border-red-500/50 text-red-400 px-4 py-2 rounded-xl text-sm mb-5 text-center">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-[11px] uppercase tracking-wider font-medium text-slate-400 mb-1"
                  >
                    Operator Designation
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Enter full name"
                    className="w-full bg-black/50 px-4 py-2.5 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 placeholder-slate-600 text-sm transition-all"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-[11px] uppercase tracking-wider font-medium text-slate-400 mb-1"
                  >
                    Identity Sequence
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="user@network.local"
                    className="w-full bg-black/50 px-4 py-2.5 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 placeholder-slate-600 text-sm transition-all"
                    required
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-[11px] uppercase tracking-wider font-medium text-slate-400 mb-1"
                  >
                    Commlink Frequency
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={handleChange}
                    placeholder="Enter phone number"
                    className="w-full bg-black/50 px-4 py-2.5 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none text-cyan-50 placeholder-slate-600 text-sm transition-all"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 font-semibold text-sm transition-all shadow-[0_0_15px_rgba(6,182,212,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {loading ? "Establishing Link..." : "Enter Session"}
                </button>
              </form>
            </div>

            {/* Back to home */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate("/")}
                className="text-slate-500 hover:text-cyan-400 text-xs transition-colors flex items-center justify-center gap-1 mx-auto"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 19l-7-7m0 0l7-7m-7 7h18"
                  />
                </svg>
                Abort & Return
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default JoinForm;
