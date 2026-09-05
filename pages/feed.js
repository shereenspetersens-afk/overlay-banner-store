import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
const KEY_STORAGE = 'rssStoreAdminKey';
const ACCEPT_MIME = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';
const MAX_FILE_BYTES = 4 * 1024 * 1024; // stay under Vercel body-size ceiling

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function sanitizeSource(s) {
  return String(s || '').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase().slice(0, 64);
}

// Split "a,b,c" (or any separator run) into a deduped, sanitized array
function parseSources(raw) {
  return [...new Set(
    String(raw || '')
      .split(/[,\n]+/)
      .map(sanitizeSource)
      .filter(Boolean)
  )];
}

function guessTitleFromFile(name) {
  return name
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Feed() {
  const [allSources, setAllSources]   = useState([]);
  const [items, setItems]             = useState([]);
  const [pagination, setPagination]   = useState({ total: 0, pages: 1 });

  // Multi-source selection. Empty set = "all". "multiMode" toggles click semantics.
  const [selectedSources, setSelectedSources] = useState(new Set());
  const [multiMode, setMultiMode]     = useState(false);

  // Date range filter (YYYY-MM-DD, empty string = no filter)
  const [dateFrom, setDateFrom]       = useState('');
  const [dateTo, setDateTo]           = useState('');

  const [usageFilter, setUsageFilter]   = useState('all'); // 'all' | 'unused' | 'used'
  const [search, setSearch]           = useState('');
  const [page, setPage]               = useState(1);
  const [loading, setLoading]         = useState(true);
  const [expanded, setExpanded]       = useState({});
  const searchRef                     = useRef();

  // Admin auth key (persisted in localStorage)
  const [apiKey, setApiKey]           = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Selection mode (for batch ops on already-stored items)
  const [selectMode, setSelectMode]         = useState(false);
  const [selected, setSelected]             = useState(new Set());
  const [batchSource, setBatchSource]       = useState('');
  const [batchTitlePrefix, setBatchTitlePrefix] = useState('');
  const [batchTitleSuffix, setBatchTitleSuffix] = useState('');
  const [batchDescription, setBatchDescription] = useState('');
  const [batchBusy, setBatchBusy]           = useState(false);
  const [batchStatus, setBatchStatus]       = useState(null);

  // Per-item used/unused toggle (holds the id of the item currently being flipped)
  const [busyItem, setBusyItem]             = useState(null);

  // Upload staging
  const [uploadOpen, setUploadOpen]     = useState(false);
  const [staged, setStaged]             = useState([]);
  const [stageBusy, setStageBusy]       = useState(false);
  const [stageProgress, setStageProgress] = useState({ done: 0, total: 0, current: '' });
  const [batchPrefix, setBatchPrefix]         = useState('');
  const [batchSuffix, setBatchSuffix]         = useState('');
  const [batchStageDesc, setBatchStageDesc]   = useState('');
  const [batchStageSource, setBatchStageSource] = useState('');
  const fileInputRef = useRef(null);

  // Fetch items whenever filters change
  const load = useCallback(async (sources, q, pg, usage, from, to) => {
    setLoading(true);
    const p = new URLSearchParams({ limit: String(LIMIT), page: String(pg) });
    const srcArr = sources instanceof Set ? [...sources] : (Array.isArray(sources) ? sources : []);
    if (srcArr.length > 0) p.set('source', srcArr.join(','));
    if (q)                 p.set('search', q);
    if (usage === 'unused') p.set('used', 'false');
    if (usage === 'used')   p.set('used', 'true');
    if (from) p.set('from', from);
    if (to)   p.set('to', to);
    try {
      const res  = await fetch(`/api/rss/items?${p}`);
      const data = await res.json();
      setItems(data.items || []);
      setPagination(data.pagination || { total: 0, pages: 1 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Bootstrap source list + restore admin key
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY_STORAGE);
      if (saved) setApiKey(saved);
    } catch {}
    fetch('/api/rss/items?limit=100')
      .then(r => r.json())
      .then(data => {
        const unique = [...new Set((data.items || []).map(i => i.source))].sort();
        setAllSources(unique);
      });
    load(new Set(), '', 1, 'all', '', '');
  }, [load]);

  // Persist admin key
  useEffect(() => {
    try {
      if (apiKey) localStorage.setItem(KEY_STORAGE, apiKey);
      else        localStorage.removeItem(KEY_STORAGE);
    } catch {}
  }, [apiKey]);

  const toggleSource = (src) => {
    if (src === 'all') {
      setSelectedSources(new Set());
      setPage(1);
      load(new Set(), search, 1, usageFilter, dateFrom, dateTo);
      return;
    }
    setSelectedSources(prev => {
      const next = new Set(multiMode ? prev : []);
      if (next.has(src)) next.delete(src); else next.add(src);
      setPage(1);
      load(next, search, 1, usageFilter, dateFrom, dateTo);
      return next;
    });
  };

  const clearSourceFilter = () => {
    setSelectedSources(new Set());
    setPage(1);
    load(new Set(), search, 1, usageFilter, dateFrom, dateTo);
  };

  const changePage   = (pg)  => { setPage(pg);  load(selectedSources, search, pg, usageFilter, dateFrom, dateTo); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const changeUsage  = (u)   => { setUsageFilter(u); setPage(1); load(selectedSources, search, 1, u, dateFrom, dateTo); };
  const changeFrom   = (v)   => { setDateFrom(v); setPage(1); load(selectedSources, search, 1, usageFilter, v, dateTo); };
  const changeTo     = (v)   => { setDateTo(v);   setPage(1); load(selectedSources, search, 1, usageFilter, dateFrom, v); };
  const clearDates   = ()    => { setDateFrom(''); setDateTo(''); setPage(1); load(selectedSources, search, 1, usageFilter, '', ''); };

  const handleSearch = (e) => {
    const q = e.target.value;
    setSearch(q);
    setPage(1);
    // Debounce
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => load(selectedSources, q, 1, usageFilter, dateFrom, dateTo), 400);
  };

  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  const authHeaders = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (apiKey) h['x-api-key'] = apiKey;
    return h;
  }, [apiKey]);

  // ── Upload staging ─────────────────────────────────────────────────────
  const refreshAll = async () => {
    const data = await fetch('/api/rss/items?limit=100').then(r => r.json()).catch(() => ({}));
    if (data && data.items) {
      const unique = [...new Set(data.items.map(i => i.source))].sort();
      setAllSources(unique);
    }
  };

  const addFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter(f => f && f.type && f.type.startsWith('image/'));
    if (files.length === 0) return;
    const oversized = files.filter(f => f.size > MAX_FILE_BYTES);
    if (oversized.length) {
      alert(`Skipping ${oversized.length} file(s) larger than 4 MB:\n${oversized.map(f => f.name).join('\n')}`);
    }
    const usable = files.filter(f => f.size <= MAX_FILE_BYTES);
    const rows = await Promise.all(usable.map(async (f) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${f.name}`,
      name: f.name,
      dataUrl: await fileToDataUrl(f),
      title: guessTitleFromFile(f.name),
      description: '',
      source: 'uploads',
      size: f.size,
    })));
    setStaged(prev => [...rows, ...prev]);
    if (!uploadOpen) setUploadOpen(true);
  };

  const onFilesPicked = (e) => { addFiles(e.target.files); e.target.value = ''; };
  const onDropFiles   = (e) => { e.preventDefault(); addFiles(e.dataTransfer.files); };

  const updateStaged = (key, patch) => setStaged(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r));
  const removeStaged = (key)         => setStaged(prev => prev.filter(r => r.key !== key));
  const clearStaged  = ()            => setStaged([]);

  const applyStageBatch = () => {
    setStaged(prev => prev.map(r => {
      const next = { ...r };
      if (batchStageSource.trim()) next.source = batchStageSource.trim();
      if (batchPrefix)             next.title  = batchPrefix + next.title;
      if (batchSuffix)             next.title  = next.title + batchSuffix;
      if (batchStageDesc)          next.description = batchStageDesc;
      return next;
    }));
    setBatchPrefix('');
    setBatchSuffix('');
    setBatchStageDesc('');
    setBatchStageSource('');
  };

  const saveStaged = async () => {
    if (staged.length === 0) return;
    const bad = staged.find(r => !r.title.trim());
    if (bad) { alert(`Every item needs a title. Missing on: ${bad.name}`); return; }

    setStageBusy(true);
    setStageProgress({ done: 0, total: staged.length, current: staged[0].name });

    let saved = 0;
    let failed = 0;
    const failures = [];

    // Send one at a time to stay safely under Vercel's request body limit
    for (let i = 0; i < staged.length; i++) {
      const row = staged[i];
      setStageProgress({ done: i, total: staged.length, current: row.name });
      try {
        const res = await fetch('/api/rss/store', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            imageUrl: row.dataUrl,
            title: row.title.trim(),
            description: row.description.trim(),
            sources: parseSources(row.source || 'uploads'),
          }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          failed++;
          failures.push(`${row.name}: ${j.error || res.statusText}`);
        } else {
          saved++;
        }
      } catch (err) {
        failed++;
        failures.push(`${row.name}: ${err.message}`);
      }
    }

    setStageBusy(false);
    setStageProgress({ done: staged.length, total: staged.length, current: '' });

    if (failed) {
      alert(`Saved ${saved}. ${failed} failed:\n${failures.join('\n')}`);
    } else {
      setStaged([]);
      setUploadOpen(false);
    }

    await refreshAll();
    load(selectedSources, search, 1, usageFilter, dateFrom, dateTo);
    setPage(1);
  };

  // ── Selection mode on existing items ────────────────────────────────────
  const toggleSelect = (id) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectAllOnPage = () => setSelected(new Set(items.map(i => i.id)));
  const clearSelection  = () => setSelected(new Set());

  const applyBatchToSelected = async () => {
    if (selected.size === 0) return alert('Select at least one item first.');
    if (!batchSource && !batchTitlePrefix && !batchTitleSuffix && !batchDescription) {
      return alert('Set at least one batch field (source, title prefix/suffix, or description).');
    }
    setBatchBusy(true);
    setBatchStatus(null);
    try {
      const patch = {};
      if (batchSource)       patch.source = batchSource;
      if (batchTitlePrefix)  patch.titlePrefix = batchTitlePrefix;
      if (batchTitleSuffix)  patch.titleSuffix = batchTitleSuffix;
      if (batchDescription)  patch.description = batchDescription;
      const res = await fetch('/api/rss/batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'update', ids: [...selected], patch }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setBatchStatus(`Updated ${j.updated} item(s).`);
      setBatchSource('');
      setBatchTitlePrefix('');
      setBatchTitleSuffix('');
      setBatchDescription('');
      clearSelection();
      await refreshAll();
      load(selectedSources, search, page, usageFilter, dateFrom, dateTo);
    } catch (err) {
      setBatchStatus(`Error: ${err.message}`);
    } finally {
      setBatchBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} selected item(s)? This removes them and their stored images.`)) return;
    setBatchBusy(true);
    setBatchStatus(null);
    try {
      const res = await fetch('/api/rss/batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'delete', ids: [...selected] }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setBatchStatus(`Deleted ${j.deleted} item(s).`);
      clearSelection();
      await refreshAll();
      load(selectedSources, search, page, usageFilter, dateFrom, dateTo);
    } catch (err) {
      setBatchStatus(`Error: ${err.message}`);
    } finally {
      setBatchBusy(false);
    }
  };

  // Mark selected items used / unused
  const markSelectedUsed = async (used) => {
    if (selected.size === 0) return alert('Select at least one item first.');
    setBatchBusy(true);
    setBatchStatus(null);
    try {
      const res = await fetch('/api/rss/batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ action: 'update', ids: [...selected], patch: { used } }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setBatchStatus(`Marked ${j.updated} item(s) as ${used ? 'used' : 'unused'}.`);
      clearSelection();
      load(selectedSources, search, page, usageFilter, dateFrom, dateTo);
    } catch (err) {
      setBatchStatus(`Error: ${err.message}`);
    } finally {
      setBatchBusy(false);
    }
  };

  // Flip a single item's used state via PATCH /api/rss/item/[id]
  const toggleItemUsed = async (item) => {
    if (busyItem) return;
    const nextUsed = !item.used;
    setBusyItem(item.id);
    // Optimistic UI: update the card immediately, roll back on failure
    const prevItems = items;
    setItems(prev => prev.map(i =>
      i.id === item.id
        ? { ...i, used: nextUsed, usedAt: nextUsed ? new Date().toISOString() : null }
        : i
    ));
    try {
      const res = await fetch(`/api/rss/item/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ used: nextUsed }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      // Reconcile with server response (authoritative usedAt)
      setItems(prev => prev.map(i => i.id === item.id ? j.item : i));
      // If the flip pushes the item out of the current usage filter, refresh
      if ((usageFilter === 'unused' && j.item.used) || (usageFilter === 'used' && !j.item.used)) {
        load(selectedSources, search, page, usageFilter, dateFrom, dateTo);
      }
    } catch (err) {
      setItems(prevItems);
      alert(`Failed to update: ${err.message}`);
    } finally {
      setBusyItem(null);
    }
  };

  // True when any scope filter is set (sources, date range, or usage)
  const hasFilter = selectedSources.size > 0
    || !!dateFrom || !!dateTo
    || usageFilter !== 'all'
    || !!search;

  // Describe the current filter scope for confirm dialogs / status text
  const filterDescription = () => {
    const parts = [];
    if (selectedSources.size > 0) parts.push(`sources: ${[...selectedSources].join(', ')}`);
    if (dateFrom || dateTo)       parts.push(`stored ${dateFrom || '…'} → ${dateTo || '…'}`);
    if (usageFilter !== 'all')    parts.push(`only ${usageFilter}`);
    if (search)                   parts.push(`match "${search}"`);
    return parts.length ? parts.join(' · ') : 'ALL items in the store';
  };

  // Mark ALL items matching the CURRENT filter (sources + date range + usage + search)
  const markFilterUsed = async (used) => {
    if (!hasFilter) {
      if (!confirm('No filter set — this will mark EVERY item in the store. Continue?')) return;
    } else if (!confirm(`Mark ALL items matching filter (${filterDescription()}) as ${used ? 'used' : 'unused'}?`)) {
      return;
    }
    setBatchBusy(true);
    setBatchStatus(null);
    try {
      const payload = {
        action: 'update',
        all: true,
        patch: { used },
      };
      if (selectedSources.size > 0) payload.sources = [...selectedSources];
      if (search)                   payload.search  = search;
      if (dateFrom)                 payload.from    = dateFrom;
      if (dateTo)                   payload.to      = dateTo;
      // Skip usage filter when marking used=X to avoid the trivial "already X → X" case
      if (usageFilter === 'unused' && used === true)  payload.used = false;
      if (usageFilter === 'used'   && used === false) payload.used = true;

      const res = await fetch('/api/rss/batch', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || res.statusText);
      setBatchStatus(`Marked ${j.updated} item(s) as ${used ? 'used' : 'unused'}.`);
      load(selectedSources, search, 1, usageFilter, dateFrom, dateTo);
      setPage(1);
    } catch (err) {
      setBatchStatus(`Error: ${err.message}`);
    } finally {
      setBatchBusy(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', fontFamily: "'Inter','Helvetica Neue',sans-serif" }}>
      <Head>
        <title>RSS Feed Viewer</title>
        <meta name="robots" content="noindex, nofollow" />
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
        <button
          onClick={() => setUploadOpen(v => !v)}
          style={{
            padding: '9px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: '#6366f1', color: '#fff', fontSize: '0.82rem', fontWeight: 600,
          }}
        >
          {uploadOpen ? 'Close upload' : '+ Upload images'}
        </button>
        <button
          onClick={() => { setSelectMode(v => !v); clearSelection(); }}
          style={{
            padding: '9px 14px', borderRadius: '8px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.14)',
            background: selectMode ? '#8b5cf6' : 'rgba(255,255,255,0.06)',
            color: '#fff', fontSize: '0.82rem', fontWeight: 600,
          }}
        >
          {selectMode ? 'Exit select' : 'Select items'}
        </button>
        <button
          onClick={() => setShowKeyInput(v => !v)}
          title="Admin key required for uploads / edits when RSS_STORE_SECRET is set"
          style={{
            padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.14)',
            background: apiKey ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
            color: apiKey ? '#10b981' : '#fff', fontSize: '0.82rem',
          }}
        >
          🔑 {apiKey ? 'Key set' : 'Set key'}
        </button>
      </header>

      {/* ── Usage filter + date range + batch-mark-by-filter ── */}
      <div style={{
        padding: '8px 28px', background: 'rgba(0,0,0,0.25)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Show
        </span>
        {[
          { key: 'all',    label: 'All' },
          { key: 'unused', label: 'Unused' },
          { key: 'used',   label: 'Used' },
        ].map(opt => {
          const active = usageFilter === opt.key;
          return (
            <button key={opt.key} onClick={() => changeUsage(opt.key)} style={{
              padding: '4px 12px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: active ? '#10b981' : 'rgba(255,255,255,0.07)',
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
              fontSize: '0.75rem', fontWeight: active ? 600 : 400,
            }}>
              {opt.label}
            </button>
          );
        })}

        <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Stored
        </span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => changeFrom(e.target.value)}
          title="Stored from (inclusive)"
          style={dateInput}
        />
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => changeTo(e.target.value)}
          title="Stored to (inclusive)"
          style={dateInput}
        />
        {(dateFrom || dateTo) && (
          <button onClick={clearDates} style={miniBtn} title="Clear date filter">Clear dates</button>
        )}
        {/* Quick date-range presets */}
        {[
          { key: '7',   label: '7d' },
          { key: '30',  label: '30d' },
          { key: '90',  label: '90d' },
          { key: 'ytd', label: 'YTD' },
        ].map(p => (
          <button key={p.key} onClick={() => {
            const now = new Date();
            let from;
            if (p.key === 'ytd') from = new Date(now.getFullYear(), 0, 1);
            else                 from = new Date(now.getTime() - Number(p.key) * 86400000);
            const fromStr = from.toISOString().slice(0, 10);
            const toStr   = now.toISOString().slice(0, 10);
            setDateFrom(fromStr); setDateTo(toStr); setPage(1);
            load(selectedSources, search, 1, usageFilter, fromStr, toStr);
          }} style={{
            ...miniBtn, padding: '4px 10px', fontSize: '0.72rem',
          }}>{p.label}</button>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
            Batch filter ({pagination.total}):
          </span>
          <button onClick={() => markFilterUsed(false)} disabled={batchBusy} style={sourceBatchBtn('#10b981', batchBusy)}>
            Mark filter unused
          </button>
          <button onClick={() => markFilterUsed(true)} disabled={batchBusy} style={sourceBatchBtn('#f59e0b', batchBusy)}>
            Mark filter used
          </button>
        </div>
      </div>

      {showKeyInput && (
        <div style={{
          padding: '10px 28px', background: 'rgba(0,0,0,0.4)',
          borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap',
        }}>
          <input
            type="password"
            placeholder="RSS_STORE_SECRET"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            style={{
              flex: 1, minWidth: 220, maxWidth: 420, padding: '8px 12px',
              background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
              borderRadius: '6px', color: '#fff', fontSize: '0.82rem', outline: 'none',
            }}
          />
          <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)' }}>
            Stored locally in your browser. Sent as <code>x-api-key</code>.
          </span>
        </div>
      )}

      {/* ── Upload / staging panel ── */}
      {uploadOpen && (
        <section style={{
          padding: '18px 28px', background: 'rgba(99,102,241,0.05)',
          borderBottom: '1px solid rgba(99,102,241,0.2)',
        }}>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropFiles}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: '2px dashed rgba(255,255,255,0.2)', borderRadius: '10px',
              padding: '22px', textAlign: 'center', cursor: 'pointer',
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 4 }}>
              Drop images here or click to pick files
            </div>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)' }}>
              PNG · JPG · WEBP · GIF — max 4 MB per file. You can edit each caption below before saving.
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT_MIME}
              onChange={onFilesPicked}
              style={{ display: 'none' }}
            />
          </div>

          {staged.length > 0 && (
            <>
              {/* Batch tools */}
              <div style={{
                marginTop: 14, padding: '12px 14px', borderRadius: 10,
                background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.08)',
                display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
                alignItems: 'end',
              }}>
                <BatchField label="Set source(s) for all" placeholder="e.g. uploads, curated-2026"
                  value={batchStageSource} onChange={setBatchStageSource} />
                <BatchField label="Prefix all titles" placeholder="🔥 "
                  value={batchPrefix} onChange={setBatchPrefix} />
                <BatchField label="Suffix all titles" placeholder=" — 2026"
                  value={batchSuffix} onChange={setBatchSuffix} />
                <BatchField label="Set description for all" placeholder="Uploaded on 2026-…"
                  value={batchStageDesc} onChange={setBatchStageDesc} />
                <button onClick={applyStageBatch} style={{
                  padding: '9px 14px', borderRadius: 8, border: 'none',
                  background: '#14b8a6', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem',
                }}>Apply batch to all ({staged.length})</button>
              </div>

              {/* Staged grid */}
              <div style={{
                marginTop: 14, display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12,
              }}>
                {staged.map(row => (
                  <div key={row.key} style={{
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{ position: 'relative', aspectRatio: '16/9', background: '#111' }}>
                      <img src={row.dataUrl} alt={row.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      <button onClick={() => removeStaged(row.key)} title="Remove"
                        style={{
                          position: 'absolute', top: 6, right: 6,
                          width: 24, height: 24, borderRadius: '50%', border: 'none', cursor: 'pointer',
                          background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 14, lineHeight: 1,
                        }}>×</button>
                    </div>
                    <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <StageInput label="Title" value={row.title}
                        onChange={(v) => updateStaged(row.key, { title: v })} />
                      <StageInput label="Source(s) — comma separated" value={row.source}
                        onChange={(v) => updateStaged(row.key, { source: v })} />
                      <StageTextarea label="Description" value={row.description}
                        onChange={(v) => updateStaged(row.key, { description: v })} />
                      <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)' }}>
                        {row.name} · {(row.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <button onClick={saveStaged} disabled={stageBusy} style={{
                  padding: '10px 18px', borderRadius: 8, border: 'none',
                  background: stageBusy ? '#4b5563' : '#10b981', color: '#fff', fontWeight: 700,
                  cursor: stageBusy ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
                }}>
                  {stageBusy
                    ? `Saving ${stageProgress.done}/${stageProgress.total}…`
                    : `Save all (${staged.length})`}
                </button>
                <button onClick={clearStaged} disabled={stageBusy} style={{
                  padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.14)',
                  background: 'transparent', color: '#fff', fontSize: '0.82rem',
                  cursor: stageBusy ? 'not-allowed' : 'pointer',
                }}>Clear staged</button>
                {stageBusy && stageProgress.current && (
                  <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)' }}>
                    Uploading: {stageProgress.current}
                  </span>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* ── Select-mode batch bar ── */}
      {selectMode && (
        <section style={{
          padding: '12px 28px', background: 'rgba(139,92,246,0.08)',
          borderBottom: '1px solid rgba(139,92,246,0.3)',
        }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <strong style={{ fontSize: '0.85rem' }}>
              {selected.size} selected
            </strong>
            <button onClick={selectAllOnPage} style={miniBtn}>Select page</button>
            <button onClick={clearSelection} style={miniBtn}>Clear</button>
            <button onClick={() => markSelectedUsed(false)} disabled={batchBusy || selected.size === 0} style={{
              ...miniBtn, background: '#10b981', borderColor: '#10b981',
              opacity: batchBusy || selected.size === 0 ? 0.5 : 1,
            }}>Mark unused</button>
            <button onClick={() => markSelectedUsed(true)} disabled={batchBusy || selected.size === 0} style={{
              ...miniBtn, background: '#f59e0b', borderColor: '#f59e0b',
              opacity: batchBusy || selected.size === 0 ? 0.5 : 1,
            }}>Mark used</button>
            <button onClick={deleteSelected} disabled={batchBusy || selected.size === 0} style={{
              ...miniBtn, background: '#ef4444', borderColor: '#ef4444',
              opacity: batchBusy || selected.size === 0 ? 0.5 : 1,
            }}>Delete selected</button>
            {batchStatus && (
              <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.7)' }}>{batchStatus}</span>
            )}
          </div>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10,
            alignItems: 'end',
          }}>
            <BatchField label="Change source" placeholder="new-source"
              value={batchSource} onChange={setBatchSource} />
            <BatchField label="Prefix titles" placeholder="🔥 "
              value={batchTitlePrefix} onChange={setBatchTitlePrefix} />
            <BatchField label="Suffix titles" placeholder=" — updated"
              value={batchTitleSuffix} onChange={setBatchTitleSuffix} />
            <BatchField label="Replace description" placeholder="Leave blank to skip"
              value={batchDescription} onChange={setBatchDescription} />
            <button onClick={applyBatchToSelected} disabled={batchBusy || selected.size === 0} style={{
              padding: '10px 14px', borderRadius: 8, border: 'none',
              background: batchBusy ? '#4b5563' : '#8b5cf6', color: '#fff',
              fontWeight: 700, cursor: batchBusy ? 'not-allowed' : 'pointer', fontSize: '0.82rem',
              opacity: selected.size === 0 ? 0.6 : 1,
            }}>
              {batchBusy ? 'Applying…' : `Apply to ${selected.size}`}
            </button>
          </div>
        </section>
      )}

      {/* ── Source tabs (multi-select capable) ── */}
      <nav style={{
        padding: '12px 28px', display: 'flex', gap: '8px', flexWrap: 'wrap',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,0,0,0.3)', alignItems: 'center',
      }}>
        <button
          onClick={() => setMultiMode(v => !v)}
          title={multiMode ? 'Click tabs to toggle selection' : 'Click tabs to switch — Shift-click still multi-selects'}
          style={{
            padding: '5px 13px', borderRadius: '20px', border: 'none', cursor: 'pointer',
            background: multiMode ? '#14b8a6' : 'rgba(255,255,255,0.07)',
            color: multiMode ? '#fff' : 'rgba(255,255,255,0.65)',
            fontSize: '0.72rem', fontWeight: 600,
          }}
        >
          {multiMode ? '☑ Multi' : '☐ Multi'}
        </button>

        {['all', ...allSources].map(src => {
          const isAll  = src === 'all';
          const active = isAll ? selectedSources.size === 0 : selectedSources.has(src);
          const color  = isAll ? '#6366f1' : sourceColor(src, allSources);
          return (
            <button
              key={src}
              onClick={(e) => {
                // Shift-click always toggles (adds to multi-select); otherwise respect multiMode
                if (isAll) return toggleSource('all');
                if (e.shiftKey || multiMode) {
                  setSelectedSources(prev => {
                    const next = new Set(prev);
                    if (next.has(src)) next.delete(src); else next.add(src);
                    setPage(1);
                    load(next, search, 1, usageFilter, dateFrom, dateTo);
                    return next;
                  });
                } else {
                  const next = new Set([src]);
                  setSelectedSources(next);
                  setPage(1);
                  load(next, search, 1, usageFilter, dateFrom, dateTo);
                }
              }}
              style={{
                padding: '5px 13px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                background: active ? color : 'rgba(255,255,255,0.07)',
                color: active ? '#fff' : 'rgba(255,255,255,0.65)',
                fontSize: '0.78rem', fontWeight: active ? 600 : 400,
                boxShadow: active ? `0 0 12px ${color}55` : 'none',
                transition: 'all 0.15s',
              }}
            >
              {isAll ? 'All' : src}
            </button>
          );
        })}

        {selectedSources.size > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>
            {selectedSources.size} source{selectedSources.size === 1 ? '' : 's'} selected
            <button onClick={clearSourceFilter} style={{
              marginLeft: 8, ...miniBtn, padding: '4px 10px', fontSize: '0.7rem',
            }}>Clear</button>
          </span>
        )}
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
              const isChecked  = selected.has(item.id);
              const isUsed     = !!item.used;
              const preview = item.description
                ? item.description.replace(/\*\*/g, '').slice(0, 110) + (item.description.length > 110 ? '…' : '')
                : '';

              return (
                <article key={item.id} style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${isChecked ? '#8b5cf6' : 'rgba(255,255,255,0.09)'}`,
                  borderRadius: '12px', overflow: 'hidden',
                  display: 'flex', flexDirection: 'column',
                  transition: 'border-color 0.2s, box-shadow 0.2s, opacity 0.2s',
                  boxShadow: isChecked ? '0 0 0 2px rgba(139,92,246,0.4)' : 'none',
                  opacity: isUsed && !isChecked ? 0.55 : 1,
                }}
                  onMouseEnter={e => { if (!isChecked) { e.currentTarget.style.borderColor = `${color}66`; e.currentTarget.style.boxShadow = `0 4px 24px rgba(0,0,0,0.4)`; } }}
                  onMouseLeave={e => { if (!isChecked) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)'; e.currentTarget.style.boxShadow = 'none'; } }}
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
                    {!selectMode && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleItemUsed(item); }}
                        disabled={busyItem === item.id}
                        title={
                          isUsed
                            ? (item.usedAt ? `Used at ${item.usedAt} — click to mark unused` : 'Click to mark unused')
                            : 'Click to mark used'
                        }
                        style={{
                          position: 'absolute', top: 9, right: 9,
                          background: isUsed ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.55)',
                          color: isUsed ? '#f59e0b' : 'rgba(255,255,255,0.85)',
                          padding: '3px 9px', borderRadius: '10px',
                          fontSize: '0.66rem', fontWeight: 700, letterSpacing: '0.04em',
                          border: `1px solid ${isUsed ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.18)'}`,
                          cursor: busyItem === item.id ? 'wait' : 'pointer',
                          opacity: busyItem === item.id ? 0.6 : 1,
                        }}
                      >
                        {busyItem === item.id ? '…' : isUsed ? '✓ USED' : '○ Unused'}
                      </button>
                    )}
                    {selectMode && (
                      <label style={{
                        position: 'absolute', top: 9, right: 9,
                        width: 28, height: 28, borderRadius: '50%',
                        background: isChecked ? '#8b5cf6' : 'rgba(0,0,0,0.65)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', border: '2px solid rgba(255,255,255,0.6)',
                      }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(item.id)}
                          style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
                        />
                        {isChecked && <span style={{ color: '#fff', fontSize: 15, fontWeight: 800 }}>✓</span>}
                      </label>
                    )}
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

// ── Small reusable inputs for batch tools / staging ──────────────────────────
function BatchField({ label, placeholder, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.55)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '8px 10px', borderRadius: 6,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
          color: '#fff', fontSize: '0.82rem', outline: 'none',
        }}
      />
    </label>
  );
}

function StageInput({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: '6px 8px', borderRadius: 5,
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: '0.78rem', outline: 'none',
        }}
      />
    </label>
  );
}

function StageTextarea({ label, value, onChange }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <span style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.5)' }}>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        style={{
          padding: '6px 8px', borderRadius: 5, resize: 'vertical',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
          color: '#fff', fontSize: '0.78rem', outline: 'none', fontFamily: 'inherit',
        }}
      />
    </label>
  );
}

const miniBtn = {
  padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.14)',
  background: 'rgba(255,255,255,0.06)', color: '#fff', fontSize: '0.78rem', cursor: 'pointer',
};

const dateInput = {
  padding: '5px 8px', borderRadius: 6,
  background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
  color: '#fff', fontSize: '0.78rem', outline: 'none',
  colorScheme: 'dark',
};

function sourceBatchBtn(color, busy) {
  return {
    padding: '5px 11px', borderRadius: 14, border: 'none', cursor: busy ? 'not-allowed' : 'pointer',
    background: color, color: '#fff', fontSize: '0.72rem', fontWeight: 600,
    opacity: busy ? 0.6 : 1,
  };
}
