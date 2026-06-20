export const getApiUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL || "http://localhost:7002";

  const currentHostname = window.location.hostname;
  const currentProtocol = window.location.protocol; // "http:" or "https:"

  // If we are on HTTPS, we must connect securely to avoid Mixed Content blockages.
  // In a standard production deployment behind an SSL reverse proxy (e.g. Nginx, Cloudflare),
  // the backend is mapped under the same domain on port 443. Therefore, we use window.location.origin.
  if (currentProtocol === "https:") {
    try {
      const url = new URL(envUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return window.location.origin; // e.g. "https://connect.trivixam.com"
      }
    } catch (e) {
      console.error("Error parsing VITE_API_URL:", e);
    }
  }

  // If we are on a non-localhost domain in development (e.g. local IP 192.168.x.x),
  // but VITE_API_URL is configured as localhost, we dynamically update the host
  // and protocol to match the current access address, enabling multi-device local testing.
  if (currentHostname !== "localhost" && currentHostname !== "127.0.0.1") {
    try {
      const url = new URL(envUrl);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        url.hostname = currentHostname;
        url.protocol = currentProtocol;
        return url.origin;
      }
    } catch (e) {
      console.error("Error parsing VITE_API_URL:", e);
    }
  }
  return envUrl;
};

export const API_URL = getApiUrl();
