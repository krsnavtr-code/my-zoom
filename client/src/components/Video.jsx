import { useRef, useEffect } from "react";

const Video = ({
  stream,
  muted = false,
  name = "User",
  isScreenSharing = false,
  isMainScreen = false, // 🟢 Naya prop add kiya screen share aspect ratio ke liye
}) => {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-[#0a0a0f] w-full h-full flex items-center justify-center rounded-inherit overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        // Agar main screen hai toh object-contain, warna carousel me object-cover
        className={`w-full h-full ${isMainScreen ? "object-contain" : "object-cover"}`}
      />
      {isScreenSharing && (
        <div className="absolute top-2 left-2 bg-blue-600/80 backdrop-blur text-white px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider flex items-center space-x-1 border border-blue-500/50">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
          </svg>
          <span>Screen Share</span>
        </div>
      )}
    </div>
  );
};

export default Video;
