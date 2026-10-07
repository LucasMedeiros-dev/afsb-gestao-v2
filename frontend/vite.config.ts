import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em dev, /api vai para o Django sem o prefixo (mesmo contrato do nginx).
const API_ALVO = process.env.API_ALVO ?? 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: API_ALVO,
        changeOrigin: true,
        rewrite: (caminho) => caminho.replace(/^\/api/, ''),
      },
    },
  },
})
