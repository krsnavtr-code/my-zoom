export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || "http://localhost:7002";
  
  // If we are on a non-localhost domain (e.g. local IP 192.168.x.x, or ngrok),
  // but VITE_API_URL is configured as localhost, we dynamically update it.
  const currentHostname = window.location.hostname;
  if (currentHostname !== "localhost" && currentHostname !== "127.0.0.1") {
    try {
      const url = new URL(envUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.hostname = currentHostname;
        return url.origin;
      }
    } catch (e) {
      console.error("Error parsing VITE_API_URL:", e);
    }
  }
  return envUrl;
};

export const API_URL = getApiUrl();
