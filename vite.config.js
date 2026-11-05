import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// `npm run dev:https` serves over HTTPS on the LAN so phones can use location and camera.
// With a trusted certificate in certs/ (made by mkcert) there's no browser warning;
// otherwise a self-signed one is used and browsers warn once.
const https = process.env.HTTPS === '1';
const cert = new URL('./certs/dev.pem', import.meta.url);
const key = new URL('./certs/dev-key.pem', import.meta.url);
const trusted = https && fs.existsSync(cert) && fs.existsSync(key);

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(https && !trusted ? [basicSsl()] : [])],
  server: {
    port: 5173,
    host: https ? true : undefined,
    https: trusted ? { cert: fs.readFileSync(cert), key: fs.readFileSync(key) } : undefined,
    proxy: {
      // xfwd passes the client IP through so the backend's hospital-network check works
      '/api': { target: 'http://localhost:5050', xfwd: true },
      '/uploads': 'http://localhost:5050',
      '/socket.io': { target: 'http://localhost:5050', ws: true, xfwd: true },
    },
  },
});
