import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      "/lustat": {
        target: "https://lustat.statec.lu",
        changeOrigin: true,
        secure: true,
        headers: {
          Origin: "https://lustat.statec.lu",
        },
        rewrite: (path) => path.replace(/^\/lustat/, ""),
      },
    },
  },
});
