import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The editor is its own app and is never part of the public static site: none
   of the 18 pages load anything from here, and its build output stays in
   editor/dist. React lives in this app and in the publish-time renderer only.

   `root` is resolved from this file rather than the working directory, so
   `vite --config editor/vite.config.js` behaves the same wherever it is run. */
const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: here,
  plugins: [react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
