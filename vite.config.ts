import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('@dimforge/rapier3d-compat') || id.includes('@react-three/rapier')) {
              return 'rapier';
            }
            if (id.includes('/three/') || id.includes('three-mesh-bvh')) {
              return 'three';
            }
            if (id.includes('@react-three')) {
              return 'react-three';
            }
          }
        },
      },
    },
  },
})
