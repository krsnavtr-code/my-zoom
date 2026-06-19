import { useState, useEffect, useRef } from "react";
import { io } from "socket.io-client";

const Chat = ({ roomId, userId, userName }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const messagesEndRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    // Initialize Socket.io connection
    socketRef.current = io(import.meta.env.VITE_API_URL);

    // Request message history
    socketRef.current.emit("get-message-history", roomId);

    // Listen for message history
    socketRef.current.on("message-history", (history) => {
      setMessages(history);
    });

    // Listen for new messages
    socketRef.current.on("receive-message", (messageData) => {
      setMessages((prev) => [...prev, messageData]);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [roomId]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (inputMessage.trim()) {
      socketRef.current.emit("send-message", {
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
    <div className="flex flex-col h-full">
      {/* Messages List */}
      <div className="flex-1 overflow-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-400 py-8">
            <p className="text-sm">No messages yet</p>
            <p className="text-xs mt-1">Start the conversation!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.userId === userId ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 ${
                  msg.userId === userId
                    ? "bg-blue-600 text-white"
                    : "bg-gray-700 text-white"
                }`}
              >
                {msg.userId !== userId && (
                  <p className="text-xs font-semibold text-blue-400 mb-1">
                    {msg.userName}
                  </p>
                )}
                <p className="text-sm break-words">{msg.message}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.userId === userId ? "text-blue-200" : "text-gray-400"
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form
        onSubmit={handleSendMessage}
        className="p-4 border-t border-gray-700"
      >
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-gray-700 text-white px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
};

export default Chat;
