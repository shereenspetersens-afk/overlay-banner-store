import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';

const SOURCE_PALETTE = [
  '#6366f1', '#8b5cf6', '#ec4899', '#14b8a6',
  '#f59e0b', '#10b981', '#3b82f6', '#f97316',
  '#ef4444', '#84cc16', '#06b6d4', '#a855f7',
];

function sourceColor(source, allSources) {
  const idx = allSources.indexOf(source);
  return SOURCE_PALETTE[idx % SOURCE_PALETTE.length];
}

// Render **bold** and newlines from plain text descriptions
function Description({ text }) {
  if (!text) return null;
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} style={{ margin: '0 0 5px' }}>
          {line.split(/(\*\*[^*]+\*\*)/).map((part, j) =>
            part.startsWith('**') && part.endsWith('**')
              ? <strong key={j}>{part.slice(2, -2)}</strong>
              : part
          )}
        </p>
      ))}
    </>
  );
}

const LIMIT = 24;

export default function Feed() {
  const [allSources, setAllSources]   = useState([]);
  const [items, setItems]             = useState([]);
  const [pagination, setPagination]   = useState({ total: 0, pages: 1 });
  const [activeSource, setActiveSource] = useState('all');
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState({});
  const searchRef                     = useRef();

  // Fetch items whenever filters change
  const load = useCallback(async (src, q, pg) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(LIMIT), page: String(pg) });
    if (src !== 'all') p.set('source', src);
    if (q)             p.set('search', q);
    try {
      const res  = await fetch(`/api/rss/items?${p}`);
      const data = await res.json();
      setItems(data.items || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Bootstrap source list from a broad first fetch
  useEffect(() => {
    fetch('/api/rss/items?limit=100')
      .then(r => r.json())
      .then(data => {
        const unique = [...new Set((data.items || []).map(i => i.source))].sort();
        setAllSources(unique);
      });
    load('all', '', 1);
  }, [load]);

  const changeSource = (src) => { setActiveSource(src); setPage(1); load(src, search, 1); };
  const changePage   = (pg)  => { setPage(pg);  load(activeSource, search, pg); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    setPage(1);
    // Debounce
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(activeSource, q, 1), 400);
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      <Head>
        <title>RSS Feed Viewer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* ── Header ── */}
      <header style={{
        padding: '20px 28px', background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px',
      }}>
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0 }}>📰 RSS Feed Store</h1>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>
            {pagination.total} item{pagination.total !== 1 ? 's' : ''} stored
          </p>
        </div>
        <input
          type="search"
          placeholder="Search titles & descriptions…"
          value={search}
          onChange={handleSearch}
          style={{
            marginLeft: 'auto', padding: '9px 14px', width: '260px', maxWidth: '100%',
            background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: '8px', color: '#fff', fontSize: '0.85rem', outline: 'none',
          }}
        />
      </header>

      {/* ── Source tabs ── */}
      <nav style={{
        padding: '12px 28px', display: 'flex', gap: '8px', flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        {['all', ...allSources].map(src => {
          const active = activeSource === src;
          const color  = src === 'all' ? '#6366f1' : sourceColor(src, allSources);
          return (
            <button key={src} onClick={() => changeSource(src)} style={{
              padding: '5px 13px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: active ? color : 'rgba(255,255,255,0.07)',
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
              fontSize: '0.78rem', fontWeight: active ? 600 : 400,
              boxShadow: active ? `0 0 12px ${color}55` : 'none',
              transition: 'all 0.15s',
            }}>
              {src === 'all' ? 'All' : src}
            </button>
          );
        })}
      </nav>

      {/* ── Grid ── */}
      <main style={{ padding: '24px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '240px' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.3)', fontSize: '0.95rem' }}>
            No items found.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '18px',
          }}>
            {items.map(item => {
              const color = sourceColor(item.source, allSources);
              const isExpanded = !!expanded[item.id];
              const preview = item.description
                ? item.description.replace(/\*\*/g, '').slice(0, 110) + (item.description.length > 110 ? '…' : '')
                : '';

              return (
                <article key={item.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  borderRadius: '12px', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}66`; e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.4)`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  {/* Image */}
                  <div style={{ position: 'relative', aspectRatio: '16/9', background: '#111', flexShrink: 0 }}>
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.target.parentElement.style.background = '#1a1a1a'; e.target.remove(); }}
                      />
                    )}
                    {/* Source badge */}
                    <span style={{
                      position: 'absolute', top: 9, left: 9,
                      background: color, color: '#fff',
                      padding: '3px 9px', borderRadius: '10px',
                      fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.02em',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
                    }}>
                      {item.source}
                    </span>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '13px 15px', flex: 1, display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 600, lineHeight: 1.45, margin: 0 }}>
                      {item.title}
                    </h2>

                    {item.description && (
                      <div style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                        {isExpanded
                          ? <Description text={item.description} />
                          : <span>{preview}</span>
                        }
                        {item.description.length > 110 && (
                          <button onClick={() => toggle(item.id)} style={{
                            display: 'block', marginTop: '5px',
                            background: 'none', border: 'none', color: color,
                            cursor: 'pointer', fontSize: '0.74rem', padding: 0,
                          }}>
                            {isExpanded ? 'Show less ▲' : 'Show more ▼'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Footer */}
                    <div style={{ marginTop: 'auto', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)' }}>
                        {new Date(item.storedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      {item.originalImageUrl && (
                        <a
                          href={item.originalImageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.28)', textDecoration: 'none' }}
                        >
                          source ↗
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* ── Pagination ── */}
        {!loading && pagination.pages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '36px', flexWrap: 'wrap' }}>
            <button onClick={() => changePage(1)} disabled={page === 1} style={pgBtn(page === 1)}>«</button>
            <button onClick={() => changePage(page - 1)} disabled={page === 1} style={pgBtn(page === 1)}>‹ Prev</button>

            {/* Page number chips */}
            {Array.from({ length: pagination.pages }, (_, i) => i + 1)
              .filter(n => n === 1 || n === pagination.pages || Math.abs(n - page) <= 2)
              .reduce((acc, n, i, arr) => {
                if (i > 0 && n - arr[i - 1] > 1) acc.push('…');
                acc.push(n);
                return acc;
              }, [])
              .map((n, i) =>
                n === '…'
                  ? <span key={`e${i}`} style={{ color: 'rgba(255,255,255,0.3)', padding: '0 4px' }}>…</span>
                  : <button key={n} onClick={() => changePage(n)} style={{
                      ...pgBtn(false),
                      background: n === page ? '#6366f1' : 'rgba(255,255,255,0.07)',
                      fontWeight: n === page ? 700 : 400,
                    }}>{n}</button>
              )
            }

            <button onClick={() => changePage(page + 1)} disabled={page === pagination.pages} style={pgBtn(page === pagination.pages)}>Next ›</button>
            <button onClick={() => changePage(pagination.pages)} disabled={page === pagination.pages} style={pgBtn(page === pagination.pages)}>»</button>
          </div>
        )}
      </main>
    </div>
  );
}

function pgBtn(disabled) {
  return {
    padding: '7px 13px', borderRadius: '7px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.05)',
    color: disabled ? 'rgba(255,255,255,0.2)' : '#fff',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '0.82rem',
  };
}
