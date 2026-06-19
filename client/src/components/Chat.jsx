import { useState } from "react";

const Chat = ({
  roomId,
  userId,
  userName,
  socket,
  messages,
  onSendMessage,
}) => {
  const [inputMessage, setInputMessage] = useState("");

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      onSendMessage({
        roomId,
        userId,
        userName,
        message: inputMessage.trim(),
      });
      setInputMessage("");
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-transparent font-sans relative">
      {/* Messages List */}
      <div className="flex-1 overflow-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
            <svg className="w-8 h-8 text-cyan-500 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-xs uppercase tracking-widest font-bold text-slate-400">Comms Link Established</p>
            <p className="text-[10px] text-slate-500 mt-1">Awaiting data transmission...</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.userId === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] px-3.5 py-2 shadow-lg ${
                  msg.userId === userId
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-50 rounded-2xl rounded-tr-sm"
                    : "bg-black/60 border border-white/10 text-slate-300 rounded-2xl rounded-tl-sm"
                }`}
              >
                {msg.userId !== userId && (
                  <p className="text-[10px] uppercase tracking-wider font-bold text-fuchsia-400 mb-1 border-b border-white/5 pb-1">
                    {msg.userName}
                  </p>
                )}
                <p className="text-sm break-words leading-relaxed">{msg.message}</p>
                <p
                  className={`text-[9px] font-mono mt-1 text-right ${
                    msg.userId === userId ? "text-cyan-400/70" : "text-slate-500"
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-white/10 bg-black/20 backdrop-blur-md"
      >
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Transmit data..."
            className="flex-1 bg-black/50 text-cyan-50 px-4 py-2.5 border border-slate-700 rounded-xl focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 outline-none placeholder-slate-600 text-sm transition-all"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="bg-gradient-to-r from-cyan-600 to-blue-600 text-white px-4 py-2.5 rounded-xl hover:from-cyan-500 hover:to-blue-500 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center"
            title="Send"
          >
            <svg className="w-4 h-4 transform rotate-45 -mt-1 -mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;