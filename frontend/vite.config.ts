/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Під час розробки запити /api проксіюються на Spring Boot (порт 8080), тож cookie сесії
// та CSRF працюють як в одному домені. Збірка потрапляє в static бекенду — один артефакт.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080',
      '/v3': 'http://localhost:8080',
      '/swagger-ui': 'http://localhost:8080',
    },
  },
  build: {
    outDir: '../backend/src/main/resources/static',
    emptyOutDir: true,
    sourcemap: false,
    // Не вбудовувати шрифти як data: URI — їх блокує Content-Security-Policy (дефект DEF-07)
    assetsInlineLimit: 0,
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
