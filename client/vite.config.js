import { defineConfig } from "vite";
import react, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";

// https://vite.dev/config/
export default defineConfig({
  css: {
    postcss: "./postcss.config.js",
  },
  define: {
    global: "globalThis",
  },
  plugins: [react(), babel({ presets: [reactCompilerPreset()] })],
});
