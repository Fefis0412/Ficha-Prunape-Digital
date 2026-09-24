/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    strictPort: true,
    // host:true expone el servidor en la red local para abrirlo desde el celular
    host: true,
    // permite servir detrás de un túnel (el Host llega con otro dominio)
    allowedHosts: true,
    // La API de Supabase se sirve por el mismo origen. Así alcanza con exponer
    // un solo puerto y no hay que lidiar con CORS ni con dos direcciones.
    proxy: {
      '/api-supabase': {
        target: 'http://127.0.0.1:55321',
        changeOrigin: true,
        ws: true,
        rewrite: (ruta) => ruta.replace(/^\/api-supabase/, ''),
      },
    },
  },
  // El build servido con `vite preview` usa la misma configuración: es lo que
  // conviene exponer por un túnel, porque son dos archivos y no cientos de
  // módulos sueltos como en desarrollo.
  preview: {
    port: 4173,
    strictPort: true,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api-supabase': {
        target: 'http://127.0.0.1:55321',
        changeOrigin: true,
        ws: true,
        rewrite: (ruta) => ruta.replace(/^\/api-supabase/, ''),
      },
    },
  },
  build: { outDir: 'dist', sourcemap: true },
  // Los .spec.ts de e2e los corre Playwright, no Vitest.
  test: { include: ['src/**/*.test.ts'] },
})
