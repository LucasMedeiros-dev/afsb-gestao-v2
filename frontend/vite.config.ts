import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// O .env fica na raiz do repositório (compartilhado com o backend).
const RAIZ = fileURLToPath(new URL('..', import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, RAIZ, '')
  // Em dev, /api vai para o Django sem o prefixo (mesmo contrato do nginx).
  const apiAlvo = process.env.API_ALVO ?? env.API_ALVO ?? 'http://localhost:8000'

  return {
    plugins: [react()],
    envDir: RAIZ,
    server: {
      proxy: {
        '/api': {
          target: apiAlvo,
          changeOrigin: true,
          rewrite: (caminho) => caminho.replace(/^\/api/, ''),
        },
      },
    },
  }
})
