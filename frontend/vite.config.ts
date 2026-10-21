import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The SPA is served on the single exposed port and proxies API + admin traffic
// to the Django dev server. This keeps the browser on ONE origin so Django's
// session cookie and CSRF flow behave as if the API were same-origin.
//
const DJANGO = "http://127.0.0.1:8000"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": { target: DJANGO, changeOrigin: true },
      "/admin": { target: DJANGO, changeOrigin: true },
      "/static": { target: DJANGO, changeOrigin: true },
    },
  },
})
