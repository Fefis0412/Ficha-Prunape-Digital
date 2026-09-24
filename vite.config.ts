/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // host:true expone el servidor en la red local para poder abrirlo
  // desde el celular con la IP de la PC.
  server: { port: 5173, strictPort: true, host: true },
  build: { outDir: 'dist', sourcemap: true },
  // Los .spec.ts de e2e los corre Playwright, no Vitest.
  test: { include: ['src/**/*.test.ts'] },
})
