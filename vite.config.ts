import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // base "./" keeps asset paths relative for GitHub Pages deployment
  base: "./",
});
