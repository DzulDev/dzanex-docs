import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { writeFileSync } from 'fs'
import { version } from './package.json'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'generate-version-json',
      buildStart() {
        writeFileSync(
          './public/version.json',
          JSON.stringify({ version, buildTime: Date.now() })
        )
      },
    },
  ],
})
