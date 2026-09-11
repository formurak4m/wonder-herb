import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/* The editor is its own app and is never part of the public static site: none
   of the 18 pages load anything from here, and its build output stays in
   editor/dist. React lives in this app and in the publish-time renderer only.

   `root` is resolved from this file rather than the working directory, so
   `vite --config editor/vite.config.js` behaves the same wherever it is run. */
const here = fileURLToPath(new URL('.', import.meta.url));

/* renderer/i18n.js is CommonJS - it is loaded by plain Node in the renderer,
 * the export script and the test suite. esbuild's bundler happily gives a CJS
 * module a default export, which is why scripts/test-editor-lang.js passed; the
 * Vite DEV server does not, because it serves source files as native ESM. The
 * editor therefore died on load with:
 *
 *   The requested module '/renderer/i18n.js' does not provide an export
 *   named 'default'
 *
 * Only running the real dev server surfaced that - a bundled test cannot.
 *
 * This wraps that one file in the standard CJS shim so it can be imported as
 * ESM. The alternative was to copy LANGS / PRIMARY / isLangMap into the editor,
 * which would put the language list in two places - exactly the duplication
 * this project exists to avoid.
 *
 * TEMPORARY. The real fix is for renderer/i18n.js to be an ES module that Node
 * consumes through the same esbuild path as sections/, and then this plugin
 * deletes itself. That is a change to renderer/, which P8-T2 is not allowed to
 * make - logged as a finding. */
const cjsAsEsm = {
  name: 'wh-cjs-interop',
  enforce: 'pre',
  transform(code, id) {
    if (!id.replace(/\\/g, '/').endsWith('/renderer/i18n.js')) return null;
    return {
      code: 'const module = { exports: {} };\nconst exports = module.exports;\n' +
            code + '\nexport default module.exports;\n',
      map: null
    };
  }
};

export default defineConfig({
  root: here,
  plugins: [cjsAsEsm, react()],
  server: { port: 5173, strictPort: true },
  build: { outDir: 'dist', emptyOutDir: true },
});
