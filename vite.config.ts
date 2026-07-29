import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// We reuse the existing top-level `assets/` folder as Vite's public directory,
// so the original files (figures, videos) are served as-is without duplication.
//   - assets/figures/Overview.png    -> /figures/Overview.png
//   - assets/deploy_video/*.mp4      -> /deploy_video/*.mp4
//   - assets/animbot_video/*.mp4     -> /animbot_video/*.mp4
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  publicDir: 'assets',
  server: {
    allowedHosts: true,
    fs: {
      strict: false,
    },
  },
  base: './',
})
