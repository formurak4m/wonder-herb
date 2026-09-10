import { registry } from '../sections/index.js';

/* Phase 1 placeholder. This becomes the Puck editor shell in Phase 8:
   load a page tree from GET /api/pages/:slug, edit, PUT it back.
   It renders the section registry so the toolchain is visibly wired
   end to end - editor app -> shared sections - before Puck arrives. */
export default function App() {
  const types = Object.keys(registry);
  return (
    <main style={{ font: '15px/1.6 system-ui, sans-serif', padding: '48px', maxWidth: 640 }}>
      <h1 style={{ font: '600 22px/1.3 system-ui, sans-serif', margin: '0 0 8px' }}>
        Wonder Herb — 頁面編輯器
      </h1>
      <p style={{ color: '#6b7280', margin: '0 0 24px' }}>
        Toolchain check (Phase 1). The Puck canvas arrives in Phase 8.
      </p>
      <p>
        Sections in the shared registry: <strong>{types.length}</strong>
        {types.length ? ' — ' + types.join(', ') : ' (Phase 4 builds these)'}
      </p>
    </main>
  );
}
