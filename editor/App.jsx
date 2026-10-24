/* The Puck editor shell.
 *
 *   load   GET  /api/pages/:slug   ->  withIds  ->  projectTree(lang)  ->  Puck
 *   save   Puck ->  mergeTree(original, edited, lang)  ->  PUT /api/pages/:slug
 *
 * The two things this file must get right, both of which live in editor/lang.js
 * and are proved by scripts/test-editor-lang.js:
 *
 *   1. The tree loaded from the API is kept whole, as `original`. Saving merges
 *      the edited single-language view back INTO it, so the six languages the
 *      editor never showed come through untouched.
 *   2. An untranslated field shows empty, never the Chinese fallback. The UI
 *      says "not translated yet" instead, so empty-because-untranslated is
 *      distinguishable from empty-because-empty without inviting the user to
 *      save Chinese text into an English field.
 *
 * Editor-only. Nothing here is imported by the renderer or by any of the 18
 * static pages.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Puck } from '@puckeditor/core';
import '@puckeditor/core/puck.css';

import { buildConfig } from './puck.config.js';
import { registry } from '../sections/index.js';
import * as api from './api.js';
import { LANGS, PRIMARY, projectTree, mergeTree, withIds, resolveContent } from './lang.js';

const LANG_LABEL = {
  zh: '中文 (主要)', en: 'English', de: 'Deutsch', es: 'Español',
  fr: 'Français', ja: '日本語', ru: 'Русский'
};

/* The field configs, for the array-field walk in project/merge. */
const CONFIGS = Object.fromEntries(
  Object.entries(registry).map(([type, mod]) => [type, { fields: mod.config.fields }])
);

const bar = {
  display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap',
  padding: '10px 16px', background: '#1f2430', color: '#fff',
  font: '13px/1.5 ui-monospace, Consolas, monospace'
};
const btn = {
  font: 'inherit', padding: '6px 12px', borderRadius: 6,
  border: '1px solid #3a4152', background: '#2b3242', color: '#fff', cursor: 'pointer'
};
const pageStyle = { font: '15px/1.6 system-ui, sans-serif', padding: 48, maxWidth: 460 };

/* ------------------------------------------------------------------ login -
   The admin's own endpoint. The editor is on its own origin, so it holds its
   own copy of the same kind of token - see the note in editor/api.js. */
function SignIn({ onDone }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async e => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const r = await api.login(email, password);
      api.setToken(r.token);
      onDone();
    } catch (err) { setError(err.message); }
    setBusy(false);
  };

  return (
    <main style={pageStyle}>
      <h1 style={{ font: '600 20px/1.3 system-ui', margin: '0 0 6px' }}>康草堂 — 頁面編輯器</h1>
      <p style={{ color: '#6b7280', margin: '0 0 20px' }}>
        Sign in with your admin account. Saving a page requires an administrator.
      </p>
      <form onSubmit={submit}>
        <input style={{ font: 'inherit', padding: 8, width: '100%', marginBottom: 8 }}
               placeholder="email" value={email} onChange={e => setEmail(e.target.value)} />
        <input style={{ font: 'inherit', padding: 8, width: '100%', marginBottom: 12 }}
               type="password" placeholder="password" value={password}
               onChange={e => setPassword(e.target.value)} />
        <button style={Object.assign({}, btn, { background: '#0f766e', borderColor: '#0f766e' })}
                disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      {error ? <p style={{ color: '#b91c1c', marginTop: 12 }}>{error}</p> : null}
      <p style={{ color: '#9ca3af', fontSize: 13, marginTop: 24 }}>API: {api.apiBase()}</p>
    </main>
  );
}

/* ----------------------------------------------------------------- editor - */
export default function App() {
  const [authed, setAuthed] = useState(!!api.token());
  const [slugs, setSlugs] = useState([]);
  const [slug, setSlug] = useState('');
  const [original, setOriginal] = useState(null);   // the WHOLE tree, all languages
  const [lang, setLang] = useState(PRIMARY);
  const [content, setContent] = useState({});
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (authed) api.loadContent().then(setContent).catch(() => {}); }, [authed]);

  useEffect(() => {
    if (!authed) return;
    api.listPages()
      .then(list => {
        const names = list.map(p => p.slug);
        setSlugs(names);
        if (!slug && names.length) setSlug(names[0]);
      })
      .catch(err => setError(err.message));
  }, [authed]);                                       // eslint-disable-line

  useEffect(() => {
    if (!slug) return;
    setStatus('loading ' + slug + '…');
    api.loadPage(slug)
      .then(tree => { setOriginal(withIds(tree)); setStatus(''); setError(''); })
      .catch(err => { setError(err.message); setStatus(''); });
  }, [slug]);

  /* Content is resolved for the picked language before it reaches a section,
     exactly as renderer/render.js `resolveData` does at publish time. Product
     titles are per-language objects since P9-T1, and a section renders text,
     not language maps - so the canvas and the published page must resolve at
     the same point or they show different things. */
  const config = useMemo(
    () => buildConfig({ data: resolveContent(content, lang), lang }),
    [content, lang]
  );

  /* The Puck document for ONE language. Keyed on slug+lang so switching either
     remounts Puck with the new projection rather than keeping stale props. */
  const puckData = useMemo(() => {
    if (!original) return null;
    const p = projectTree(original, lang, CONFIGS);
    return {
      root: { props: { title: p.title, description: p.description } },
      content: p.sections.map(s => ({ type: s.type, props: s.props }))
    };
  }, [original, lang]);

  const save = useCallback(async data => {
    setStatus('saving ' + lang + '…'); setError('');
    try {
      const edited = {
        title: data.root.props ? data.root.props.title : '',
        description: data.root.props ? data.root.props.description : '',
        sections: data.content.map(c => ({ type: c.type, props: c.props }))
      };
      const merged = mergeTree(original, edited, lang, CONFIGS);
      await api.savePage(slug, merged);
      setOriginal(merged);                 // keep editing against what was saved
      setStatus('saved ' + lang + ' · other languages untouched');
    } catch (err) {
      setError(err.message); setStatus('');
    }
  }, [original, lang, slug]);

  const openPreview = useCallback(async () => {
    setStatus('rendering preview…'); setError('');
    try {
      const r = await api.preview(slug, original, lang);
      const w = window.open('', '_blank');
      if (w) { w.document.open(); w.document.write(r.html); w.document.close(); }
      setStatus('preview rendered by the publish renderer (' + Math.round(r.bytes / 1024) + ' KB)');
    } catch (err) { setError(err.message); setStatus(''); }
  }, [slug, original, lang]);

  if (!authed) return <SignIn onDone={() => setAuthed(true)} />;

  const signOut = () => { api.setToken(''); setAuthed(false); };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={bar}>
        <strong style={{ color: '#7ee0d6' }}>康草堂 編輯器</strong>

        <label>page&nbsp;
          <select value={slug} onChange={e => setSlug(e.target.value)} style={{ font: 'inherit' }}>
            {slugs.length ? slugs.map(s => <option key={s} value={s}>{s}</option>)
                          : <option value="">(no page trees yet)</option>}
          </select>
        </label>

        {/* the content-language picker: edit one language at a time */}
        <label>content language&nbsp;
          <select value={lang} onChange={e => setLang(e.target.value)} style={{ font: 'inherit' }}>
            {LANGS.map(l => <option key={l} value={l}>{LANG_LABEL[l] || l}</option>)}
          </select>
        </label>

        {lang !== PRIMARY
          ? <span style={{ color: '#fcd34d' }}>
              editing {lang} · empty fields are untranslated, not blank · saving cannot
              change {PRIMARY}
            </span>
          : <span style={{ color: '#9ca3af' }}>editing the primary language</span>}

        <span style={{ flex: 1 }} />
        <button style={btn} onClick={openPreview} disabled={!original}>Preview</button>
        <button style={btn} onClick={signOut}>Sign out</button>
        {status ? <span style={{ color: '#7ee0d6' }}>{status}</span> : null}
        {error ? <span style={{ color: '#fca5a5' }}>{error}</span> : null}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        {puckData
          ? <Puck key={slug + ':' + lang} config={config} data={puckData} onPublish={save} />
          : <main style={pageStyle}>
              <p style={{ color: '#6b7280' }}>
                {error ? error : (status || 'No page tree loaded.')}
              </p>
              <p style={{ color: '#9ca3af', fontSize: 13 }}>
                Page trees come from <code>GET /api/pages</code>. Create one with
                <code> PUT /api/pages/&lt;slug&gt;</code>, or run the seed.
              </p>
            </main>}
      </div>
    </div>
  );
}
