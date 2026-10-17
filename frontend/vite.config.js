import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// В разработке запросы /api уходят на backend (порт 3001), поэтому CORS не нужен
export default defineConfig({ plugins: [react()], server: { proxy: { '/api': 'http://localhost:3001' } } });
