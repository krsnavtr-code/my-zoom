import { useEffect } from "react";

const Modal = ({
  isOpen,
  onClose,
  onConfirm, // Added to handle redirects or actions safely
  title,
  message,
  type = "info",
  confirmText = "Acknowledge",
}) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAction = () => {
    if (onConfirm) {
      onConfirm(); // Execute redirect or specific logic
    }
    if (onClose) {
      onClose(); // Close the modal
    }
  };

  // Cyberpunk styling themes based on type
  const theme = {
    error: {
      icon: (
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      glow: "shadow-[0_0_30px_rgba(239,68,68,0.4)]",
      iconBg: "bg-red-500/20 border-red-500/50",
      button:
        "bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] text-white",
    },
    success: {
      icon: (
        <svg
          className="w-8 h-8 text-cyan-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      glow: "shadow-[0_0_30px_rgba(6,182,212,0.4)]",
      iconBg: "bg-cyan-500/20 border-cyan-500/50",
      button:
        "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-[0_0_15px_rgba(6,182,212,0.4)] text-white",
    },
    info: {
      icon: (
        <svg
          className="w-8 h-8 text-fuchsia-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      ),
      glow: "shadow-[0_0_30px_rgba(217,70,239,0.4)]",
      iconBg: "bg-fuchsia-500/20 border-fuchsia-500/50",
      button:
        "bg-gradient-to-r from-fuchsia-600 to-purple-600 hover:from-fuchsia-500 hover:to-purple-500 shadow-[0_0_15px_rgba(217,70,239,0.4)] text-white",
    },
  };

  const currentTheme = theme[type] || theme.info;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 font-sans">
      {/* Blurred Dark Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose} // Optional: Click outside to close (remove if you force users to click OK)
      />

      {/* Cyberpunk Modal Container */}
      <div
        className={`relative bg-[#0a0a0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-sm w-full mx-auto ${currentTheme.glow} transform transition-all animate-scale-in overflow-hidden`}
      >
        {/* Futuristic Grid Background inside Modal */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Glowing Icon */}
          <div
            className={`w-16 h-16 rounded-2xl border flex items-center justify-center mb-5 ${currentTheme.iconBg}`}
          >
            {currentTheme.icon}
          </div>

          {/* Text Content */}
          <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            {message}
          </p>

          {/* Action Button */}
          <button
            onClick={handleAction}
            className={`w-full font-bold text-sm tracking-wide uppercase py-3 px-6 rounded-xl transition-all duration-200 ${currentTheme.button}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
