import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Cloudflare Quick Tunnel hostnames are random per run and unknown
    // ahead of time — dev-only, so wide-open allowedHosts is fine here.
    allowedHosts: true,
  },
})
