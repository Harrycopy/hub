/* Traffic Hub · protótipo navegável. HTML, CSS e JS puros, dados no navegador. */
(function () {
  'use strict';

  // ---------- armazenamento ----------
  const LS = 'tsh-demo-db', LS_UI = 'tsh-demo-ui';
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* sem armazenamento */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* idem */ } },
  };
  let DB = store.get(LS);
  if (!DB || DB.v !== window.SEED_VERSION) DB = window.buildSeed();
  const saved = store.get(LS_UI) || {};
  const UI = {
    lang: saved.lang || ((navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'),
    user: saved.user && DB.users.some((u) => u.id === saved.user) ? saved.user : null,
    pipe: { view: saved.pipeView || 'board', f: {}, sel: new Set(), selectMode: false, last: null },
    rep: { f: {}, sel: new Set(), last: null },
    perf: { f: {} },
    drive: { tab: 'new', sel: new Set() },
    adminTab: 'users',
    openAds: new Set(),
    openMs: null,
  };
  // ?as=u_kevin&lang=pt abre direto como aquela pessoa (bom para mandar link)
  const qp = new URLSearchParams(location.search);
  if (qp.get('as') && DB.users.some((u) => u.id === qp.get('as'))) UI.user = qp.get('as');
  if (qp.get('lang') === 'pt' || qp.get('lang') === 'en') UI.lang = qp.get('lang');
  const commit = () => store.set(LS, DB);
  const saveUI = () => store.set(LS_UI, { lang: UI.lang, user: UI.user, pipeView: UI.pipe.view });

  // ---------- utilidades ----------
  const app = document.getElementById('app');
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (s, vars) => {
    let o = UI.lang === 'pt' && window.PT[s] != null ? window.PT[s] : s;
    if (vars) o = o.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
    return o;
  };
  const loc = () => (UI.lang === 'pt' ? 'pt-BR' : 'en-US');
  const now = () => new Date().toISOString();
  let seq = Date.now() % 100000;
  const uid = (p) => p + '_x' + (++seq).toString(36);
  const fmtDate = (iso, long) => (iso ? new Date(iso.length === 10 ? iso + 'T12:00:00' : iso).toLocaleDateString(loc(), long ? { day: '2-digit', month: 'short', year: 'numeric' } : { day: '2-digit', month: 'short' }) : '—');
  const money = (v) => (v == null || isNaN(v) ? '—' : new Intl.NumberFormat(loc(), { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 1000 ? 0 : 2 }).format(v));
  const num = (v, d) => (v == null || isNaN(v) || !isFinite(v) ? '—' : new Intl.NumberFormat(loc(), { maximumFractionDigits: d == null ? 0 : d, minimumFractionDigits: d || 0 }).format(v));
  const pct = (v) => (v == null || isNaN(v) || !isFinite(v) ? '—' : num(v * 100, 1) + '%');
  const ago = (iso) => {
    if (!iso) return '—';
    const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (m < 1) return t('just now');
    if (m < 60) return t('{n} min ago', { n: m });
    if (m < 1440) return t('{n} h ago', { n: Math.round(m / 60) });
    return t('{n} d ago', { n: Math.round(m / 1440) });
  };
  const naturalCmp = (a, b) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

  // ---------- domínio ----------
  const STATUSES = ['test', 'testing', 'scaling', 'validated', 'rejected', 'sold_nv', 'sold_rej'];
  const PIPE = ['test', 'testing', 'scaling', 'validated'];
  const REJ = ['rejected', 'sold_rej'];
  const SLABEL = { test: 'Test', testing: 'Testing', scaling: 'Scaling', validated: 'Validated', rejected: 'Rejected', sold_nv: 'Sold · not validated', sold_rej: 'Sold · rejected' };
  const sl = (s) => t(SLABEL[s] || s);
  const ADS_GOAL = 42;

  const user = (id) => DB.users.find((u) => u.id === id);
  const me = () => user(UI.user);
  const isAdmin = () => (me() || {}).role === 'admin';
  const cat = (id) => DB.catalog.find((c) => c.id === id);
  const catLabel = (id) => (cat(id) || {}).label || '—';
  const niche = (id) => DB.niches.find((n) => n.id === id);
  const nicheLabel = (id) => { const n = niche(id); return n ? (UI.lang === 'pt' ? n.labelPt : n.label) : '—'; };
  const offer = (id) => DB.offers.find((o) => o.id === id);
  const ad = (id) => DB.ads.find((a) => a.id === id);
  const catalogOf = (kind, all) => DB.catalog.filter((c) => c.kind === kind && (all || c.active)).sort((a, b) => a.sort - b.sort);
  const canSee = (o) => !!o && (isAdmin() || o.assignee === UI.user);
  const canWrite = (o) => !!o && (isAdmin() || (o.assignee === UI.user && !o.archived));
  const adProducts = (a) => (a.targetProducts && a.targetProducts.length ? a.targetProducts : offer(a.offer).products);
  const adVsls = (a) => (a.targetVsl ? [a.targetVsl] : offer(a.offer).vsls);
  const adTitle = (a) => adProducts(a).map(catLabel).join(' + ') + ' — ' + a.name;
  const testsOf = (a) => DB.tests.filter((x) => x.ad === a.id);
  const isOverdue = (o) => o.deadline && new Date(o.deadline) < new Date() && DB.ads.some((a) => a.offer === o.id && !a.trashed && PIPE.includes(a.status) && a.status !== 'validated');

  function log(offerId, action, d) { DB.activity.push({ id: uid('l'), offer: offerId, at: now(), actor: UI.user, action, d: d || {} }); }
  function notify(userId, offerId, type, d) {
    if (!userId || userId === UI.user) return;
    DB.notifications.push({ id: uid('n'), user: userId, at: now(), offer: offerId, type, d: d || {}, read: false });
  }

  // ---------- filtros ----------
  function visibleAds(opts) {
    opts = opts || {};
    return DB.ads.filter((a) => {
      if (a.trashed) return !!opts.trash;
      if (opts.trash) return false;
      const o = offer(a.offer);
      return canSee(o);
    });
  }
  function applyFilters(list, f, opts) {
    opts = opts || {};
    const q = (f.q || '').trim().toLowerCase();
    return list.filter((a) => {
      const o = offer(a.offer);
      if (o.archived && !f.archived) return false;
      if (f.product && !adProducts(a).includes(f.product)) return false;
      if (f.vsls && f.vsls.length && !adVsls(a).some((v) => f.vsls.includes(v))) return false;
      if (f.mechs && f.mechs.length && !o.mechanisms.some((m) => f.mechs.includes(m))) return false;
      if (f.channel && a.channel !== f.channel) return false;
      if (f.assignee && o.assignee !== f.assignee) return false;
      if (f.niche && o.niche !== f.niche) return false;
      if (f.status && a.status !== f.status) return false;
      if (opts.statuses && !opts.statuses.includes(a.status)) return false;
      if (f.from && o.created.slice(0, 10) < f.from) return false;
      if (f.to && o.created.slice(0, 10) > f.to) return false;
      if (f.tFrom || f.tTo) {
        const ok = testsOf(a).some((x) => (!f.tFrom || x.start >= f.tFrom) && (!f.tTo || x.start <= f.tTo));
        if (!ok) return false;
      }
      if (q) {
        const hay = [a.name, o.name, '#' + o.number, o.number, adProducts(a).map(catLabel).join(' '), adVsls(a).map(catLabel).join(' '),
          o.mechanisms.map(catLabel).join(' '), (user(o.assignee) || {}).name, catLabel(a.channel)].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    }).sort((x, y) => naturalCmp(adTitle(x), adTitle(y)));
  }
  const activeFilterCount = (f) => Object.keys(f).filter((k) => k !== 'q' && (Array.isArray(f[k]) ? f[k].length : f[k])).length;

  // ---------- métricas ----------
  function metrics(tests) {
    const sum = (k) => { const v = tests.filter((x) => x[k] != null); return v.length ? v.reduce((s, x) => s + Number(x[k]), 0) : null; };
    const pair = (a, b) => { const v = tests.filter((x) => x[a] != null && x[b] != null); return v.length ? [v.reduce((s, x) => s + +x[a], 0), v.reduce((s, x) => s + +x[b], 0)] : null; };
    const ratio = (a, b, k) => { const p = pair(a, b); return p && p[1] ? (p[0] / p[1]) * (k || 1) : null; };
    const classified = tests.filter((x) => x.cls);
    return {
      spend: sum('spend'), revenue: sum('revenue'), impressions: sum('impressions'), clicks: sum('clicks'), conversions: sum('conversions'),
      roas: ratio('revenue', 'spend'), cpa: ratio('spend', 'conversions'), ctr: ratio('clicks', 'impressions'), cpc: ratio('spend', 'clicks'), cpm: ratio('spend', 'impressions', 1000),
      classified: classified.length, effective: classified.filter((x) => x.cls === 'effective').length,
    };
  }
  function finalCls(a) {
    const c = testsOf(a).filter((x) => x.cls).sort((x, y) => (y.end || '').localeCompare(x.end || ''));
    return c.length ? c[0].cls : null;
  }

  // ---------- mutações ----------
  function setStatus(ids, st, reason) {
    const prev = [];
    ids.forEach((id) => {
      const a = ad(id); if (!a || a.status === st) return;
      const o = offer(a.offer); if (!canWrite(o)) return;
      prev.push([id, a.status, a.reason, a.changed]);
      log(o.id, 'ad_status', { ad: a.name, from: a.status, to: st });
      if (REJ.includes(st)) { if (reason !== a.reason) log(o.id, 'reason', { ad: a.name, reason }); a.reason = reason; }
      a.status = st; a.changed = now();
      notify(o.assignee, o.id, 'status', { ad: a.name, to: st });
    });
    commit();
    return prev;
  }
  function undoStatus(prev) {
    prev.forEach(([id, s, r, c]) => { const a = ad(id); if (a) { log(a.offer, 'ad_status', { ad: a.name, from: a.status, to: s, undo: true }); a.status = s; a.reason = r; a.changed = c; } });
    commit(); render();
  }
  function changeStatus(ids, st) {
    ids = ids.filter((id) => { const a = ad(id); return a && a.status !== st && canWrite(offer(a.offer)); });
    if (!ids.length) return;
    if (REJ.includes(st)) return reasonModal(ids, st);
    const prev = setStatus(ids, st);
    const out = !PIPE.includes(st) && route().name === 'pipeline';
    toast(t(ids.length > 1 ? '{n} ads moved to {s}' : '{n} ad moved to {s}', { n: ids.length, s: sl(st) }) + (out ? ' · ' + t('find it in Reports') : ''), { undo: () => undoStatus(prev) });
    clearSel(); render();
  }
  function trashAds(ids) {
    const done = [];
    ids.forEach((id) => { const a = ad(id); if (a && canWrite(offer(a.offer)) && !a.trashed) { a.trashPrev = a.status; a.trashed = now(); log(a.offer, 'trashed', { ad: a.name }); done.push(id); } });
    commit(); clearSel();
    toast(t('{n} ads sent to trash', { n: done.length }), { undo: () => { done.forEach((id) => { const a = ad(id); a.trashed = null; }); commit(); render(); } });
    render();
  }
  function restoreAds(ids) {
    ids.forEach((id) => { const a = ad(id); if (a) { a.trashed = null; if (a.trashPrev) a.status = a.trashPrev; log(a.offer, 'restored', { ad: a.name, to: a.status }); } });
    commit(); clearSel(); toast(t('{n} ads restored to their previous status', { n: ids.length })); render();
  }
  function deleteAds(ids) {
    const blocked = ids.filter((id) => DB.tests.some((x) => x.ad === id));
    const ok = ids.filter((id) => !blocked.includes(id));
    DB.ads = DB.ads.filter((a) => !ok.includes(a.id));
    DB.files.forEach((f) => { if (ok.includes(f.ad)) f.ad = null; });
    commit(); clearSel();
    toast(t('{n} deleted', { n: ok.length }) + (blocked.length ? ' · ' + t('{n} kept because they have tests', { n: blocked.length }) : ''));
    render();
  }
  function clearSel() { UI.pipe.sel.clear(); UI.rep.sel.clear(); UI.drive.sel.clear(); }

  // ---------- roteador ----------
  function route() {
    const h = (location.hash || '#/').slice(1);
    const [path, qs] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(qs || ''));
    const map = { '': 'panel', pipeline: 'pipeline', demand: 'demand', reports: 'reports', performance: 'performance', drive: 'drive', 'ads-per-offer': 'adsPerOffer', admin: 'admin' };
    return { name: map[parts[0] || ''] || 'notfound', id: parts[1], q };
  }
  const go = (h) => { if (location.hash === h) render(); else location.hash = h; };
  window.addEventListener('hashchange', () => { closeModal(); clearSel(); UI.openMs = null; render(); window.scrollTo(0, 0); });

  // ---------- ícones ----------
  const I = (d, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const IC = {
    layers: I('<path d="M12 3 3 8l9 5 9-5-9-5Z"/><path d="m3 13 9 5 9-5"/><path d="m3 17.5 9 5 9-5" opacity=".5"/>'),
    pipe: I('<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="10" y="4" width="5" height="11" rx="1"/><rect x="17" y="4" width="4" height="7" rx="1"/>'),
    report: I('<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>'),
    chart: I('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    drive: I('<path d="M8 3h8l6 10-4 7H6l-4-7z"/><path d="m8 3 6 10H2M16 3 10 13M22 13H10l-4 7"/>'),
    grid: I('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
    shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>'),
    bell: I('<path d="M6 16V11a6 6 0 1 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>'),
    search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'),
    plus: I('<path d="M12 5v14M5 12h14"/>'),
    x: I('<path d="M6 6l12 12M18 6 6 18"/>'),
    ext: I('<path d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"/>'),
    trash: I('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    undo: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>'),
    check: I('<path d="m5 12 5 5 9-10"/>'),
    list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
    board: I('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>'),
    select: I('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m8 12 3 3 5-6"/>'),
    back: I('<path d="M15 18 9 12l6-6"/>'),
    down: I('<path d="M12 4v12M6 11l6 6 6-6M4 20h16"/>'),
    refresh: I('<path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7"/>'),
    edit: I('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
    archive: I('<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v11h14V9M10 13h4"/>'),
    rocket: I('<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M14 4c3 0 6 3 6 6l-7 7-6-6z"/><circle cx="14.5" cy="9.5" r="1.5"/>'),
    globe: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>'),
    user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
    lock: I('<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>'),
    print: I('<path d="M7 9V3h10v6M7 17H4v-7h16v7h-3M7 14h10v7H7z"/>'),
    cmd: I('<path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/>'),
    msg: I('<path d="M4 5h16v11H9l-5 4z"/>'),
    clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  };

  // ---------- peças ----------
  const badge = (s) => `<span class="sb s-${s}"><i></i>${esc(sl(s))}</span>`;
  const chip = (label, kind) => `<span class="chip ${kind || ''}">${esc(label)}</span>`;
  function statusSelect(a, disabled) {
    const o = offer(a.offer);
    if (disabled || !canWrite(o)) return badge(a.status);
    return `<label class="ss s-${a.status}"><i></i><select data-ch="status" data-id="${a.id}" aria-label="${esc(t('Status'))}">${STATUSES.map((s) => `<option value="${s}"${s === a.status ? ' selected' : ''}>${esc(sl(s))}</option>`).join('')}</select></label>`;
  }
  function origin(a) {
    if (!a.origin) return '';
    const s = ad(a.origin);
    return `<span class="origin" title="${esc(t('Relaunched'))}">${IC.rocket}${esc(t('Relaunch of {ad}', { ad: s ? s.name : '—' }))}${a.targetVsl ? ' → ' + esc(catLabel(a.targetVsl)) : ''}</span>`;
  }
  function selectEl(scope, key, val, opts, ph) {
    return `<label class="fld"><span>${esc(ph)}</span><select data-ch="filter" data-scope="${scope}" data-key="${key}"><option value="">${esc(t('All'))}</option>${opts.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  }
  function multiEl(scope, key, vals, opts, ph) {
    vals = vals || [];
    const open = UI.openMs === scope + key;
    return `<div class="fld"><span>${esc(ph)}</span><details class="ms"${open ? ' open' : ''} data-ms="${scope + key}"><summary>${vals.length ? esc(vals.map(catLabel).join(', ')) : esc(t('All'))}</summary><div class="ms-pop">${opts.map(([v, l]) => `<label><input type="checkbox" data-ch="multi" data-scope="${scope}" data-key="${key}" value="${esc(v)}"${vals.includes(v) ? ' checked' : ''}>${esc(l)}</label>`).join('')}</div></details></div>`;
  }
  const optsOf = (kind) => catalogOf(kind, true).map((c) => [c.id, c.label + (c.active ? '' : ' · ' + t('inactive'))]);
  function filterBar(scope, f, cfg) {
    cfg = cfg || {};
    const mgrs = DB.users.filter((u) => u.role === 'gestor').map((u) => [u.id, u.name]);
    const n = activeFilterCount(f);
    return `<div class="filters">
      <label class="fld grow"><span>${esc(t('Search'))}</span><span class="search">${IC.search}<input id="q-${scope}" data-in="q" data-scope="${scope}" value="${esc(f.q || '')}" placeholder="${esc(t('Ad, demand, #number, product, VSL, mechanism, manager'))}"></span></label>
      ${selectEl(scope, 'product', f.product, optsOf('product'), t('Product'))}
      ${multiEl(scope, 'vsls', f.vsls, optsOf('vsl'), 'VSL')}
      ${multiEl(scope, 'mechs', f.mechs, optsOf('mechanism'), t('Mechanism'))}
      ${selectEl(scope, 'channel', f.channel, optsOf('channel'), t('Channel'))}
      ${isAdmin() ? selectEl(scope, 'assignee', f.assignee, mgrs, t('Manager')) : ''}
      ${selectEl(scope, 'niche', f.niche, DB.niches.map((x) => [x.id, nicheLabel(x.id)]), t('Niche'))}
      ${cfg.status ? selectEl(scope, 'status', f.status, cfg.status.map((s) => [s, sl(s)]), t('Status')) : ''}
      ${cfg.tests ? `<label class="fld"><span>${esc(t('Test start from'))}</span><input type="date" data-ch="filter" data-scope="${scope}" data-key="tFrom" value="${esc(f.tFrom || '')}"></label><label class="fld"><span>${esc(t('to'))}</span><input type="date" data-ch="filter" data-scope="${scope}" data-key="tTo" value="${esc(f.tTo || '')}"></label>`
        : `<label class="fld"><span>${esc(t('Created from'))}</span><input type="date" data-ch="filter" data-scope="${scope}" data-key="from" value="${esc(f.from || '')}"></label><label class="fld"><span>${esc(t('to'))}</span><input type="date" data-ch="filter" data-scope="${scope}" data-key="to" value="${esc(f.to || '')}"></label>`}
      <div class="fld-actions">
        ${isAdmin() ? `<label class="tog"><input type="checkbox" data-ch="filter" data-scope="${scope}" data-key="archived"${f.archived ? ' checked' : ''}><span>${esc(t('Show archived'))}</span></label>` : ''}
        ${n || f.q ? `<button class="btn ghost sm" data-a="clearFilters" data-scope="${scope}">${IC.x}${esc(t('Clear filters'))}${n ? ` <b class="count">${n}</b>` : ''}</button>` : ''}
      </div>
    </div>`;
  }
  const scopeF = (scope) => ({ pipe: UI.pipe.f, rep: UI.rep.f, perf: UI.perf.f }[scope]);

  // ---------- casca ----------
  function shell(body, opts) {
    opts = opts || {};
    const r = route();
    const u = me();
    const unread = DB.notifications.filter((n) => n.user === UI.user && !n.read).length;
    const newBatches = DB.batches.filter((b) => b.status === 'new' && !b.removed).length;
    const nav = [['#/pipeline', 'pipeline', IC.pipe, t('Pipeline')], ['#/reports', 'reports', IC.report, t('Reports')], ['#/performance', 'performance', IC.chart, t('Performance')]];
    if (isAdmin()) nav.push(['#/drive', 'drive', IC.drive, t('Drive Inbox'), newBatches], ['#/ads-per-offer', 'adsPerOffer', IC.grid, t('Ads per offer')], ['#/admin', 'admin', IC.shield, t('Admin')]);
    return `
    <div class="demo-strip">${IC.lock}<span>${esc(t('Demo environment · sample data · nothing here touches the live Hub'))}</span><button class="link" data-a="resetDemo">${esc(t('Reset demo'))}</button></div>
    <header class="top${opts.panel ? ' is-panel' : ''}">
      <div class="top-in">
        <a class="brand" href="#/"><span class="brand-mark">${IC.layers}</span><span class="brand-txt"><b>ShippingCaps</b><small>Traffic Hub</small></span></a>
        ${opts.panel ? '<div class="top-spacer"></div>' : `<nav class="nav" aria-label="${esc(t('Main'))}">${nav.map(([h, n, ic, l, c]) => `<a href="${h}" class="${r.name === n || (n === 'pipeline' && r.name === 'demand') ? 'on' : ''}">${ic}<span>${esc(l)}</span>${c ? `<b class="count amber">${c}</b>` : ''}</a>`).join('')}</nav>`}
        <div class="top-tools">
          <button class="tool kbd-hint" data-a="palette" title="${esc(t('Quick search'))} (⌘K)">${IC.search}<span>⌘K</span></button>
          <button class="tool lang" data-a="lang" title="${esc(t('Language'))}"><b class="${UI.lang === 'en' ? 'on' : ''}">EN</b><b class="${UI.lang === 'pt' ? 'on' : ''}">PT</b></button>
          <div class="pop-wrap"><button class="tool" data-a="bell" aria-label="${esc(t('Notifications'))}">${IC.bell}${unread ? `<b class="dot">${unread}</b>` : ''}</button>${UI.bellOpen ? notifPanel() : ''}</div>
          <div class="pop-wrap"><button class="tool me" data-a="menu"><span class="avatar">${esc(initials(u.name))}</span><span class="me-txt"><b>${esc(u.name)}</b><small>${esc(roleLabel(u.role))}</small></span></button>${UI.menuOpen ? userMenu() : ''}</div>
        </div>
      </div>
    </header>
    <main class="ws${opts.panel ? ' panel' : ''}">${body}</main>
    <footer class="foot"><span>SHIPPINGCAPS // TRAFFIC OPERATIONS</span><span>${esc(t('Private environment'))} · ${esc(t('built with Claude'))}</span></footer>`;
  }
  const initials = (n) => n.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = (r) => (r === 'admin' ? t('Administrator') : t('Traffic manager'));
  function notifPanel() {
    const list = DB.notifications.filter((n) => n.user === UI.user).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50);
    return `<div class="pop notif"><div class="pop-h"><b>${esc(t('Notifications'))}</b>${list.some((n) => !n.read) ? `<button class="link" data-a="readAll">${esc(t('Mark all as read'))}</button>` : ''}</div>
      <div class="pop-b">${list.length ? list.map((n) => `<button class="nt${n.read ? '' : ' unread'}" data-a="openNotif" data-id="${n.id}"><span>${esc(notifText(n))}</span><small>${esc(ago(n.at))}</small></button>`).join('') : `<p class="empty-s">${esc(t('Nothing new.'))}</p>`}</div></div>`;
  }
  function notifText(n) {
    const o = offer(n.offer) || { number: '—' };
    const d = n.d || {};
    return {
      assigned: t('Demand #{n} was assigned to you', { n: o.number }),
      status: t('{ad} moved to {s} in #{n}', { ad: d.ad, s: sl(d.to), n: o.number }),
      comment: t('New comment on #{n}', { n: o.number }),
      report: t('New report on #{n}', { n: o.number }),
      drive_ads: t('{c} new ads arrived from Drive in #{n}', { c: d.n, n: o.number }),
    }[n.type] || n.type;
  }
  function userMenu() {
    return `<div class="pop menu"><div class="pop-h"><b>${esc(t('View the demo as'))}</b></div><div class="pop-b">
      ${DB.users.filter((u) => u.active).map((u) => `<button class="mi${u.id === UI.user ? ' on' : ''}" data-a="switchUser" data-id="${u.id}"><span class="avatar sm">${esc(initials(u.name))}</span><span>${esc(u.name)}<small>${esc(roleLabel(u.role))}</small></span>${u.id === UI.user ? IC.check : ''}</button>`).join('')}
      </div><div class="pop-f"><button class="mi" data-a="signOut">${IC.back}<span>${esc(t('Sign out'))}</span></button></div></div>`;
  }

  // ---------- login ----------
  function viewLogin() {
    return `<div class="auth">
      <section class="auth-brand">
        <a class="brand" href="#/"><span class="brand-mark">${IC.layers}</span><span class="brand-txt"><b>ShippingCaps // Traffic Hub</b><small>${esc(t('Operations center'))}</small></span></a>
        <div class="auth-hero">
          <p class="eyebrow">${esc(t('Paid traffic // operations center'))}</p>
          <h1 class="mega">${esc(t('Control.'))}<br>${esc(t('Precision.'))}<br><span class="silver">${esc(t('Scale.'))}</span></h1>
          <p class="auth-lede">${esc(t('One operation. Every result. From test to validation, from validation to scale.'))}</p>
        </div>
        <div class="auth-grid" aria-hidden="true">${PIPE.map((s, i) => `<div class="ag s-${s}" style="--d:${i * 0.15}s"><i></i><span>${esc(sl(s))}</span></div>`).join('')}</div>
        <p class="auth-foot">${IC.lock}${esc(t('Private environment / ShippingCaps'))}</p>
      </section>
      <section class="auth-form">
        <div class="auth-card">
          <span class="auth-ic">${IC.lock}</span>
          <p class="eyebrow">${esc(t('Demo access'))}</p>
          <h2>${esc(t('Choose who you are'))}</h2>
          <p class="muted">${esc(t('This is the prototype. Pick a profile to see exactly what that person sees. No password, no real data.'))}</p>
          <div class="who">${DB.users.filter((u) => u.active).map((u) => `<button class="who-b" data-a="login" data-id="${u.id}"><span class="avatar">${esc(initials(u.name))}</span><span><b>${esc(u.name)}</b><small>${esc(roleLabel(u.role))} · ${esc(t('{n} demands', { n: DB.offers.filter((o) => u.role === 'admin' || o.assignee === u.id).length }))}</small></span>${IC.back.replace('class="ic ', 'class="ic flip ')}</button>`).join('')}</div>
          <p class="auth-note">${esc(t('In the connected version this screen becomes email + password, invite only.'))}</p>
          <button class="tool lang solo" data-a="lang"><b class="${UI.lang === 'en' ? 'on' : ''}">EN</b><b class="${UI.lang === 'pt' ? 'on' : ''}">PT</b></button>
        </div>
      </section>
    </div>`;
  }

  // ---------- painel ----------
  function viewPanel() {
    const ads = applyFilters(visibleAds(), {});
    const c = (s) => ads.filter((a) => a.status === s).length;
    const overdue = DB.offers.filter((o) => canSee(o) && !o.archived && isOverdue(o)).length;
    const tests = DB.tests.filter((x) => canSee(offer(x.offer)) && !offer(x.offer).archived);
    const m = metrics(tests);
    const newBatches = DB.batches.filter((b) => b.status === 'new' && !b.removed).length;
    const cards = [
      ['#/pipeline', '01', t('Pipeline'), t('Every ad from test to validation, in one board.'), `${c('testing')} ${t('testing')} · ${c('scaling')} ${t('scaling')}`],
      ['#/reports', '02', t('Reports'), t('Every ad, every status, every rejection reason. CSV and PDF.'), `${ads.length} ${t('ads')} · ${c('rejected') + c('sold_rej')} ${t('rejected')}`],
      ['#/performance', '03', t('Performance'), t('Where the money is going and what is coming back.'), `ROAS ${num(m.roas, 2)} · ${money(m.spend)}`],
    ];
    return `<section class="hero-p">
      <p class="eyebrow">${esc(t('Hello, {n}', { n: me().name.split(' ')[0] }))} · ${esc(new Date().toLocaleDateString(loc(), { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
      <h1 class="panel-title"><span class="silver">${esc(t('Traffic'))}</span><br>${esc(t('Management'))}</h1>
      <div class="pulse">${PIPE.map((s) => `<a href="#/pipeline" class="pl s-${s}"><i></i><b data-count="${c(s)}">${c(s)}</b><span>${esc(sl(s))}</span></a>`).join('')}
        <a href="#/pipeline" class="pl warn"><i></i><b>${overdue}</b><span>${esc(t('overdue demands'))}</span></a></div>
    </section>
    <section class="cards3">${cards.map(([h, n, title, d, live]) => `<a class="pcard" href="${h}"><span class="pc-n">${n}</span><h2>${esc(title)}</h2><p>${esc(d)}</p><span class="pc-live">${esc(live)}</span><span class="pc-go">${IC.back.replace('class="ic ', 'class="ic flip ')}</span></a>`).join('')}</section>
    ${isAdmin() ? `<section class="admin-row"><p class="eyebrow">${esc(t('Admin tools'))}</p><div class="ar">
      <a href="#/drive">${IC.drive}<span>${esc(t('Drive Inbox'))}</span>${newBatches ? `<b class="count amber">${t('{n} new', { n: newBatches })}</b>` : ''}</a>
      <a href="#/ads-per-offer">${IC.grid}<span>${esc(t('Ads per offer'))}</span></a>
      <a href="#/admin">${IC.shield}<span>${esc(t('Administration'))}</span></a></div></section>` : ''}`;
  }

  // ---------- esteira ----------
  function viewPipeline() {
    const P = UI.pipe;
    const trash = P.view === 'trash' && isAdmin();
    const base = trash ? visibleAds({ trash: true }) : applyFilters(visibleAds(), P.f, { statuses: PIPE });
    const kpi = (s) => base.filter((a) => a.status === s).length;
    const trashN = DB.ads.filter((a) => a.trashed).length;
    let body;
    if (trash) body = trashTable(base);
    else if (P.view === 'list') body = adTable(base, 'pipe');
    else body = `<div class="board">${PIPE.map((s) => {
      const col = base.filter((a) => a.status === s);
      return `<section class="col s-${s}" data-drop="${s}"><header><i></i><b>${esc(sl(s))}</b><span>${col.length}</span></header><div class="col-b">${col.map(card).join('') || `<p class="empty-s">${esc(t('No ads here.'))}</p>`}</div></section>`;
    }).join('')}</div>`;
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Operations / Pipeline'))}</p><h1 class="page-title">${esc(t('Ad pipeline'))}</h1></div>
      <div class="ph-a">${isAdmin() ? `<button class="btn primary" data-a="newOffer">${IC.plus}${esc(t('New demand'))}</button>` : ''}</div></div>
      ${trash ? '' : `<div class="kpis">${['testing', 'scaling', 'validated'].map((s) => `<div class="kpi s-${s}"><span>${esc(sl(s))}</span><b>${kpi(s)}</b><small>${esc(activeFilterCount(P.f) || P.f.q ? t('with current filters') : t('all active ads'))}</small></div>`).join('')}<div class="kpi"><span>${esc(t('Test'))}</span><b>${kpi('test')}</b><small>${esc(t('waiting to start'))}</small></div></div>`}
      <div class="viewbar">
        <div class="seg">
          <button class="${P.view === 'board' ? 'on' : ''}" data-a="pipeView" data-v="board">${IC.board}${esc(t('Board'))}</button>
          <button class="${P.view === 'list' ? 'on' : ''}" data-a="pipeView" data-v="list">${IC.list}${esc(t('List'))}</button>
          ${isAdmin() ? `<button class="${trash ? 'on' : ''}" data-a="pipeView" data-v="trash">${IC.trash}${esc(t('Trash'))} <b class="count">${trashN}</b></button>` : ''}
        </div>
        ${P.view === 'board' ? `<button class="btn ghost sm${P.selectMode ? ' on' : ''}" data-a="selectMode">${IC.select}${esc(t('Select'))}</button>` : ''}
        <span class="muted mono">${base.length} ${esc(trash ? t('in trash') : t('ads'))}</span>
      </div>
      ${trash ? '' : filterBar('pipe', P.f, P.view === 'list' ? { status: PIPE } : {})}
      ${body}
      ${bulkBar(P.sel, trash ? 'trash' : 'pipe')}`;
  }
  function card(a) {
    const o = offer(a.offer);
    const sel = UI.pipe.sel.has(a.id);
    const w = canWrite(o);
    const dl = o.deadline ? `<span class="${isOverdue(o) ? 'late' : ''}">${IC.clock}${esc(fmtDate(o.deadline))}</span>` : '';
    return `<article class="card s-${a.status}${sel ? ' sel' : ''}${o.archived ? ' arch' : ''}" draggable="${w}" data-ad="${a.id}">
      ${UI.pipe.selectMode && w ? `<label class="cbx"><input type="checkbox" data-ch="sel" data-scope="pipe" data-id="${a.id}"${sel ? ' checked' : ''}><span></span></label>` : ''}
      <a class="card-t" href="#/demand/${o.id}?tab=ads">${esc(adTitle(a))}</a>
      <div class="chips">${adVsls(a).map((v) => chip(catLabel(v), 'vsl')).join('')}${o.mechanisms.map((m) => chip(catLabel(m), 'mech')).join('')}${chip(catLabel(a.channel), 'ch')}</div>
      ${origin(a)}
      <div class="card-m"><a href="#/demand/${o.id}">#${o.number}</a>${o.archived ? `<span class="tag">${esc(t('Archived'))}</span>` : ''}<span>${esc((user(o.assignee) || {}).name || '—')}</span>${dl}</div>
      <div class="card-f"><a class="link" href="${esc(a.link)}" target="_blank" rel="noopener">${esc(t('View in Drive'))}${IC.ext}</a>${statusSelect(a)}</div>
    </article>`;
  }
  function adTable(list, scope) {
    const S = scope === 'pipe' ? UI.pipe : UI.rep;
    const writable = list.filter((a) => canWrite(offer(a.offer)));
    const all = writable.length && writable.every((a) => S.sel.has(a.id));
    if (!list.length) return `<div class="empty"><b>${esc(t('No ads match these filters.'))}</b><button class="btn ghost sm" data-a="clearFilters" data-scope="${scope}">${esc(t('Clear filters'))}</button></div>`;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr>
      <th class="c-sel"><label class="cbx"><input type="checkbox" data-ch="selAll" data-scope="${scope}"${all ? ' checked' : ''} aria-label="${esc(t('Select all'))}"><span></span></label></th>
      <th>${esc(t('Ad'))}</th><th>${esc(t('Status'))}</th>${scope === 'rep' ? `<th>${esc(t('Rejection reason'))}</th>` : ''}<th>${esc(t('Demand'))}</th><th>VSL</th><th>${esc(t('Mechanism'))}</th><th>${esc(t('Channel'))}</th><th>${esc(t('Manager'))}</th>${scope === 'rep' ? `<th class="r">ROAS</th><th></th>` : `<th>${esc(t('Deadline'))}</th><th>${esc(t('Last change'))}</th>`}
    </tr></thead><tbody>${list.map((a) => {
      const o = offer(a.offer); const w = canWrite(o); const m = metrics(testsOf(a));
      return `<tr class="${S.sel.has(a.id) ? 'sel' : ''}">
        <td class="c-sel">${w ? `<label class="cbx"><input type="checkbox" data-ch="sel" data-scope="${scope}" data-id="${a.id}"${S.sel.has(a.id) ? ' checked' : ''}><span></span></label>` : ''}</td>
        <td><a class="strong" href="#/demand/${o.id}?tab=ads">${esc(adTitle(a))}</a>${origin(a)}</td>
        <td>${statusSelect(a)}</td>
        ${scope === 'rep' ? `<td class="reason">${REJ.includes(a.status) || a.reason ? `<span>${esc(a.reason || t('No reason yet'))}</span>${w ? `<button class="link" data-a="editReason" data-id="${a.id}">${esc(a.reason ? t('Edit') : t('Add reason'))}</button>` : ''}` : '<span class="muted">—</span>'}</td>` : ''}
        <td><a href="#/demand/${o.id}">#${o.number}</a>${o.archived ? ` <span class="tag">${esc(t('Archived'))}</span>` : ''}</td>
        <td>${adVsls(a).map(catLabel).join(', ')}</td><td>${o.mechanisms.map(catLabel).join(', ')}</td><td>${esc(catLabel(a.channel))}</td>
        <td>${esc((user(o.assignee) || {}).name || '—')}</td>
        ${scope === 'rep' ? `<td class="r mono">${num(m.roas, 2)}</td><td><button class="btn ghost xs" data-a="csvOffer" data-id="${o.id}">CSV</button></td>` : `<td class="${isOverdue(o) ? 'late' : ''}">${esc(fmtDate(o.deadline))}</td><td class="muted">${esc(ago(a.changed))}</td>`}
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }
  function trashTable(list) {
    if (!list.length) return `<div class="empty"><b>${esc(t('Trash is empty.'))}</b></div>`;
    const S = UI.pipe;
    return `<div class="tbl-wrap"><table class="tbl"><thead><tr><th class="c-sel"></th><th>${esc(t('Ad'))}</th><th>${esc(t('Demand'))}</th><th>${esc(t('Status before trash'))}</th><th>${esc(t('Tests'))}</th><th>${esc(t('In trash since'))}</th></tr></thead><tbody>
      ${list.map((a) => { const o = offer(a.offer); return `<tr class="${S.sel.has(a.id) ? 'sel' : ''}"><td class="c-sel"><label class="cbx"><input type="checkbox" data-ch="sel" data-scope="pipe" data-id="${a.id}"${S.sel.has(a.id) ? ' checked' : ''}><span></span></label></td><td class="strong">${esc(adTitle(a))}</td><td><a href="#/demand/${o.id}">#${o.number}</a></td><td>${badge(a.trashPrev || a.status)}</td><td class="mono">${testsOf(a).length}</td><td class="muted">${esc(ago(a.trashed))}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }
  function bulkBar(sel, mode) {
    if (!sel.size) return '';
    const n = sel.size;
    if (mode === 'trash') return `<div class="bulk"><b>${esc(t('{n} selected', { n }))}</b><button class="btn primary sm" data-a="restore">${IC.undo}${esc(t('Restore to previous status'))}</button><button class="btn danger sm" data-a="deleteForever">${IC.trash}${esc(t('Delete permanently'))}</button><button class="btn ghost sm" data-a="clearSel">${esc(t('Clear'))}</button></div>`;
    return `<div class="bulk"><b>${esc(t('{n} selected', { n }))}</b>
      <label class="fld inline"><span>${esc(t('Move to'))}</span><select id="bulk-st">${STATUSES.map((s) => `<option value="${s}">${esc(sl(s))}</option>`).join('')}</select></label>
      <button class="btn primary sm" data-a="bulkStatus" data-scope="${mode}">${IC.check}${esc(t('Apply'))}</button>
      ${isAdmin() ? `<button class="btn ghost sm" data-a="relaunch" data-scope="${mode}">${IC.rocket}${esc(t('Relaunch'))}</button>` : ''}
      ${isAdmin() && mode === 'pipe' ? `<button class="btn ghost sm" data-a="bulkEdit">${IC.edit}${esc(t('Edit demands'))}</button>` : ''}
      ${mode === 'pipe' ? `<button class="btn ghost sm" data-a="trashSel">${IC.trash}${esc(t('Trash'))}</button>` : ''}
      <button class="btn ghost sm" data-a="clearSel">${esc(t('Clear'))}</button></div>`;
  }

  // ---------- demanda ----------
  function viewDemand(id, tab) {
    const o = offer(id);
    if (!o || !canSee(o)) return `<div class="empty big"><b>${esc(t('Demand not found or not assigned to you.'))}</b><a class="btn ghost" href="#/pipeline">${esc(t('Back to pipeline'))}</a></div>`;
    tab = tab || 'performance';
    const ads = DB.ads.filter((a) => a.offer === o.id && !a.trashed).sort((x, y) => naturalCmp(x.name, y.name));
    const w = canWrite(o);
    const counts = STATUSES.map((s) => [s, ads.filter((a) => a.status === s).length]).filter(([, n]) => n);
    const videos = ads.filter((a) => /drive\.google\.com\/file\/d\//.test(a.link));
    const tabs = [['performance', t('Performance')], ['ads', t('Ads and tests')], ['comments', t('Comments and reports')], ['history', t('History')]];
    let content = '';
    if (tab === 'ads') content = tabAds(o, ads, w);
    else if (tab === 'comments') content = tabComments(o, w);
    else if (tab === 'history') content = tabHistory(o);
    else content = tabPerf(o, ads);
    return `<a class="back" href="#/pipeline">${IC.back}${esc(t('Pipeline'))}</a>
      ${o.archived && !isAdmin() ? `<div class="note warn">${IC.archive}${esc(t('Archived demand · read only'))}</div>` : ''}
      <div class="ph"><div><p class="eyebrow">${esc(t('Demand'))} #${o.number}${o.archived ? ' · ' + esc(t('Archived')) : ''}</p><h1 class="page-title">${esc(o.name)}</h1>
        <div class="sum">${counts.map(([s, n]) => `<span class="s-${s}"><i></i>${n} ${esc(sl(s))}</span>`).join('')}</div></div>
        <div class="ph-a">
          ${isAdmin() ? `<button class="btn ghost" data-a="editOffer" data-id="${o.id}">${IC.edit}${esc(t('Edit'))}</button><button class="btn ghost" data-a="archive" data-id="${o.id}">${IC.archive}${esc(o.archived ? t('Restore') : t('Archive'))}</button>` : ''}
          <button class="btn ghost" data-a="csvOffer" data-id="${o.id}">${IC.down}CSV</button>
          <button class="btn ghost" data-a="print">${IC.print}PDF</button>
        </div></div>
      <section class="delivery">
        <div class="dv-main"><p class="eyebrow">${esc(t('Delivery for the manager'))}</p>
          <a class="btn primary big" href="${esc(o.drive)}" target="_blank" rel="noopener">${IC.drive}${esc(t('Open ads in Drive'))}${IC.ext}</a>
          <div class="dv-grid">
            <div><span>${esc(t('Product'))}</span><b>${o.products.map(catLabel).join(', ')}</b></div>
            <div><span>VSL</span><b>${o.vsls.map(catLabel).join(', ')}</b></div>
            <div><span>${esc(t('Mechanism'))}</span><b>${o.mechanisms.map(catLabel).join(', ')}</b></div>
            <div><span>${esc(t('Channel'))}</span><b>${esc(catLabel(o.channel))}</b></div>
            <div><span>${esc(t('Niche'))}</span><b>${esc(nicheLabel(o.niche))}</b></div>
            <div><span>${esc(t('Manager'))}</span><b>${esc((user(o.assignee) || {}).name || '—')}</b></div>
            <div><span>${esc(t('Deadline'))}</span><b class="${isOverdue(o) ? 'late' : ''}">${esc(fmtDate(o.deadline, true))}${isOverdue(o) ? ' · ' + esc(t('Overdue')) : ''}</b></div>
            <div><span>${esc(t('Created'))}</span><b>${esc(fmtDate(o.created, true))}</b></div>
          </div>
          ${o.description || o.notes ? `<div class="dv-desc">${o.description ? `<p>${esc(o.description)}</p>` : ''}${o.notes ? `<p class="muted"><b>${esc(t('Notes'))}:</b> ${esc(o.notes)}</p>` : ''}</div>` : ''}
        </div>
        <details class="dv-vids"><summary>${esc(t('Videos for this demand'))} <b class="count">${videos.length}</b></summary><ul>${videos.map((a) => `<li><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.name)}.mp4${IC.ext}</a>${badge(a.status)}</li>`).join('')}</ul></details>
      </section>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/demand/${o.id}?tab=${k}" class="${tab === k ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav>
      <div class="tab-b">${content}</div>`;
  }
  function tabPerf(o, ads) {
    const tests = DB.tests.filter((x) => x.offer === o.id && ads.some((a) => a.id === x.ad));
    const m = metrics(tests);
    const eff = m.classified ? m.effective / m.classified : null;
    const k = [[t('Effectiveness'), pct(eff), t('{e} of {c} classified', { e: m.effective, c: m.classified }), 'hl'],
      [t('Spend'), money(m.spend)], [t('Revenue'), money(m.revenue)], ['ROAS', num(m.roas, 2)], ['CPA', money(m.cpa)],
      ['CTR', pct(m.ctr)], ['CPC', money(m.cpc)], ['CPM', money(m.cpm)],
      [t('Tested ads'), new Set(tests.map((x) => x.ad)).size], [t('Ongoing tests'), tests.filter((x) => !x.end).length]];
    return `<div class="kgrid">${k.map(([l, v, s, c]) => `<div class="kpi ${c || ''}"><span>${esc(l)}</span><b>${esc(v)}</b>${s ? `<small>${esc(s)}</small>` : ''}</div>`).join('')}</div>
      <p class="muted small">${esc(t('Empty is not zero: ratios only use tests where both values were filled. A ratio over zero shows as "—".'))}</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('Ad'))}</th><th>${esc(t('Status'))}</th><th class="r">${esc(t('Tests'))}</th><th>${esc(t('Final classification'))}</th><th class="r">${esc(t('Spend'))}</th><th class="r">${esc(t('Revenue'))}</th><th class="r">ROAS</th><th class="spark-h">ROAS</th></tr></thead><tbody>
      ${ads.map((a) => { const mm = metrics(testsOf(a)); const fc = finalCls(a); return `<tr><td class="strong">${esc(a.name)}</td><td>${badge(a.status)}</td><td class="r mono">${testsOf(a).length}</td><td>${fc ? `<span class="cls ${fc}">${esc(fc === 'effective' ? t('Effective') : t('Not effective'))}</span>` : '<span class="muted">—</span>'}</td><td class="r mono">${money(mm.spend)}</td><td class="r mono">${money(mm.revenue)}</td><td class="r mono">${num(mm.roas, 2)}</td><td>${roasBar(mm.roas)}</td></tr>`; }).join('')}
      </tbody></table></div>`;
  }
  const roasBar = (v) => (v == null ? '' : `<span class="rbar"><i style="width:${Math.min(100, (v / 4) * 100)}%" class="${v >= 1.5 ? 'g' : v >= 1 ? 'a' : 'r'}"></i></span>`);
  function tabAds(o, ads, w) {
    return `${w ? `<div class="row-a"><button class="btn primary sm" data-a="newAd" data-id="${o.id}">${IC.plus}${esc(t('New ad'))}</button></div>` : ''}
      <div class="adlist">${ads.map((a) => {
        const ts = testsOf(a); const open = UI.openAds.has(a.id);
        return `<div class="adrow${open ? ' open' : ''}">
          <div class="adrow-h">
            <button class="exp" data-a="toggleAd" data-id="${a.id}" aria-expanded="${open}">${IC.back.replace('class="ic ', 'class="ic rot ')}</button>
            <div class="adrow-t"><b>${esc(adTitle(a))}</b>${origin(a)}<small>${esc(catLabel(a.channel))} · ${ts.length} ${esc(t('tests'))} · VSL ${esc(adVsls(a).map(catLabel).join(', '))}${a.reason ? ' · ' + esc(a.reason) : ''}</small></div>
            <div class="adrow-a">
              <a class="btn ghost xs" href="${esc(a.link)}" target="_blank" rel="noopener">Drive${IC.ext}</a>
              ${w ? `<button class="btn ghost xs" data-a="newTest" data-id="${a.id}">${IC.plus}${esc(t('Record test'))}</button>` : ''}
              ${isAdmin() && !o.archived ? `<button class="btn ghost xs" data-a="relaunchOne" data-id="${a.id}">${IC.rocket}${esc(t('Relaunch'))}</button>` : ''}
              ${w && !ts.length ? `<button class="btn ghost xs danger-t" data-a="trashOne" data-id="${a.id}" title="${esc(t('Trash'))}">${IC.trash}</button>` : ''}
              ${statusSelect(a)}
            </div>
          </div>
          ${open ? `<div class="tests">${ts.length ? ts.map((x) => { const mm = metrics([x]); return `<div class="test"><div class="test-h"><b>${esc(fmtDate(x.start))} → ${x.end ? esc(fmtDate(x.end)) : esc(t('ongoing'))}</b>${x.cls ? `<span class="cls ${x.cls}">${esc(x.cls === 'effective' ? t('Effective') : t('Not effective'))}</span>` : `<span class="cls">${esc(t('Unclassified'))}</span>`}<small>${esc(x.src === 'manual' ? t('Manual') : t('Integration'))}</small>${isAdmin() ? `<button class="link danger-t" data-a="delTest" data-id="${x.id}">${esc(t('Delete'))}</button>` : ''}</div>
              <div class="test-m"><span>${esc(t('Spend'))} <b>${money(x.spend)}</b></span><span>${esc(t('Revenue'))} <b>${money(x.revenue)}</b></span><span>ROAS <b>${num(mm.roas, 2)}</b></span><span>CTR <b>${pct(mm.ctr)}</b></span><span>CPC <b>${money(mm.cpc)}</b></span><span>CPA <b>${money(mm.cpa)}</b></span><span>${esc(t('Conv.'))} <b>${num(x.conversions)}</b></span></div>${x.notes ? `<p class="muted">${esc(x.notes)}</p>` : ''}</div>`; }).join('') : `<p class="empty-s">${esc(t('No tests recorded yet.'))}</p>`}</div>` : ''}
        </div>`;
      }).join('') || `<div class="empty"><b>${esc(t('No ads in this demand yet.'))}</b></div>`}</div>`;
  }
  function tabComments(o, w) {
    const list = DB.comments.filter((c) => c.offer === o.id);
    const roots = list.filter((c) => !c.parent).sort((a, b) => b.at.localeCompare(a.at));
    const tests = DB.tests.filter((x) => x.offer === o.id);
    const one = (c, reply) => `<article class="cm${reply ? ' reply' : ''}${c.kind === 'report' ? ' rep' : ''}">
      <header><span class="avatar sm">${esc(initials((user(c.author) || { name: '?' }).name))}</span><b>${esc((user(c.author) || {}).name || '—')}</b>${c.kind === 'report' ? `<span class="tag amber">${esc(t('Report'))}</span>` : ''}<small>${esc(ago(c.at))}${c.edited ? ' · ' + esc(t('edited')) : ''}</small></header>
      <p>${esc(c.body)}</p>
      ${c.kind === 'report' ? `<dl class="rep-g"><div><dt>${esc(t('What sold'))}</dt><dd>${esc(c.sold || '—')}</dd></div><div><dt>${esc(t('What did not work'))}</dt><dd>${esc(c.failed || '—')}</dd></div><div><dt>${esc(t('Next step'))}</dt><dd>${esc(c.next || '—')}</dd></div></dl>` : ''}
      ${!reply && w ? `<button class="link" data-a="reply" data-id="${c.id}">${esc(t('Reply'))}</button>` : ''}
      ${UI.replyTo === c.id ? `<form class="reply-f" data-form="reply" data-id="${c.id}"><textarea name="body" required placeholder="${esc(t('Write a reply'))}"></textarea><button class="btn primary sm">${esc(t('Send'))}</button></form>` : ''}
    </article>`;
    return `${w ? `<form class="composer" data-form="comment" data-id="${o.id}">
        <div class="seg sm"><label><input type="radio" name="kind" value="update" checked><span>${esc(t('Update'))}</span></label><label><input type="radio" name="kind" value="report"><span>${esc(t('Report'))}</span></label></div>
        <textarea name="body" required placeholder="${esc(t('What happened with this demand?'))}"></textarea>
        <div class="rep-fields"><input name="sold" placeholder="${esc(t('What sold'))}"><input name="failed" placeholder="${esc(t('What did not work'))}"><input name="next" placeholder="${esc(t('Next step'))}"></div>
        <div class="composer-f"><select name="test"><option value="">${esc(t('No linked test'))}</option>${tests.map((x) => `<option value="${x.id}">${esc((ad(x.ad) || {}).name)} · ${esc(fmtDate(x.start))}</option>`).join('')}</select><button class="btn primary sm">${IC.msg}${esc(t('Post'))}</button></div>
      </form>` : ''}
      <div class="cms">${roots.map((c) => one(c) + list.filter((r) => r.parent === c.id).sort((a, b) => a.at.localeCompare(b.at)).map((r) => one(r, true)).join('')).join('') || `<div class="empty"><b>${esc(t('No comments yet.'))}</b></div>`}</div>`;
  }
  function actText(l) {
    const d = l.d || {};
    const s = {
      offer_created: t('created the demand'), assigned: t('assigned it to {u}', { u: (user(d.to) || {}).name }),
      ad_status: d.undo ? t('undid {ad}: {f} → {to}', { ad: d.ad, f: sl(d.from), to: sl(d.to) }) : t('moved {ad}: {f} → {to}', { ad: d.ad, f: sl(d.from), to: sl(d.to) }),
      reason: t('set rejection reason of {ad}: "{r}"', { ad: d.ad, r: d.reason }), relaunched: t('relaunched {ad} on {v}', { ad: d.ad, v: catLabel(d.vsl) }),
      trashed: t('sent {ad} to trash', { ad: d.ad }), restored: t('restored {ad} as {s}', { ad: d.ad, s: sl(d.to) }),
      comment_added: t('commented'), report_added: t('posted a report'), offer_edited: t('edited the demand'), archived: t('archived the demand'), unarchived: t('restored the demand'),
      ad_created: t('added ad {ad}', { ad: d.ad }), test_added: t('recorded a test on {ad}', { ad: d.ad }), test_deleted: t('deleted a test on {ad}', { ad: d.ad }),
      drive_linked: t('linked Drive batch {b} ({n} ads)', { b: d.batch, n: d.n }),
    }[l.action];
    return s || l.action;
  }
  function tabHistory(o) {
    const list = DB.activity.filter((l) => l.offer === o.id).sort((a, b) => b.at.localeCompare(a.at));
    return `<ol class="tl">${list.map((l) => `<li><span class="tl-d"></span><div><b>${esc((user(l.actor) || {}).name || t('System'))}</b> ${esc(actText(l))}<small>${esc(new Date(l.at).toLocaleString(loc(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }))}</small></div></li>`).join('')}</ol>`;
  }

  // ---------- relatórios ----------
  function viewReports() {
    const R = UI.rep;
    const list = applyFilters(visibleAds(), R.f);
    const sc = [['', t('All ads')], ['rejected', t('Rejected')], ['sold_rej', t('Sold · rejected')], ['validated', t('Validated')]];
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Operations / Reports'))}</p><h1 class="page-title">${esc(t('Reports'))}</h1></div>
      <div class="ph-a">${isAdmin() ? `<button class="btn ghost" data-a="csvAll">${IC.down}${esc(t('Consolidated CSV'))}</button><button class="btn ghost" data-a="print">${IC.print}${esc(t('Consolidated PDF'))}</button>` : ''}</div></div>
      <div class="seg shortcuts">${sc.map(([s, l]) => `<button class="${(R.f.status || '') === s ? 'on' : ''}" data-a="repShortcut" data-s="${s}">${esc(l)} <b class="count">${applyFilters(visibleAds(), Object.assign({}, R.f, { status: s })).length}</b></button>`).join('')}</div>
      ${filterBar('rep', R.f, { status: STATUSES, tests: true })}
      <p class="muted mono small">${list.length} ${esc(t('ads'))}${R.f.tFrom || R.f.tTo ? ' · ' + esc(t('test period applied')) : ''}</p>
      ${adTable(list, 'rep')}
      ${bulkBar(R.sel, 'rep')}`;
  }

  // ---------- performance ----------
  function viewPerformance() {
    const F = UI.perf.f;
    const ads = applyFilters(visibleAds(), F);
    const ids = new Set(ads.map((a) => a.id));
    const tests = DB.tests.filter((x) => ids.has(x.ad) && (!F.tFrom || x.start >= F.tFrom) && (!F.tTo || x.start <= F.tTo));
    const m = metrics(tests);
    const counts = STATUSES.map((s) => [s, ads.filter((a) => a.status === s).length]);
    const max = Math.max(1, ...counts.map((c) => c[1]));
    const groups = (keyFn, labelFn) => {
      const g = {};
      ads.forEach((a) => { keyFn(a).forEach((k) => { (g[k] = g[k] || []).push(a); }); });
      return Object.entries(g).map(([k, list]) => {
        const set = new Set(list.map((a) => a.id)); const mm = metrics(tests.filter((x) => set.has(x.ad)));
        const decided = list.filter((a) => ['validated', 'scaling', 'rejected', 'sold_nv', 'sold_rej'].includes(a.status));
        return { label: labelFn(k), n: list.length, win: list.filter((a) => a.status === 'validated' || a.status === 'scaling').length, rate: decided.length ? list.filter((a) => a.status === 'validated' || a.status === 'scaling').length / decided.length : null, spend: mm.spend, roas: mm.roas };
      }).sort((a, b) => (b.spend || 0) - (a.spend || 0));
    };
    const table = (title, rows) => `<section class="pf-t"><h3>${esc(title)}</h3><div class="tbl-wrap"><table class="tbl"><thead><tr><th></th><th class="r">${esc(t('Ads'))}</th><th class="r">${esc(t('Winners'))}</th><th class="r">${esc(t('Win rate'))}</th><th class="r">${esc(t('Spend'))}</th><th class="r">ROAS</th><th class="spark-h"></th></tr></thead><tbody>${rows.map((r) => `<tr><td class="strong">${esc(r.label)}</td><td class="r mono">${r.n}</td><td class="r mono">${r.win}</td><td class="r mono">${pct(r.rate)}</td><td class="r mono">${money(r.spend)}</td><td class="r mono">${num(r.roas, 2)}</td><td>${roasBar(r.roas)}</td></tr>`).join('')}</tbody></table></div></section>`;
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Operations / Performance'))}</p><h1 class="page-title">${esc(t('Performance'))}</h1></div></div>
      ${filterBar('perf', F, { tests: true })}
      <div class="kgrid">
        <div class="kpi hl"><span>${esc(t('Total ads'))}</span><b>${ads.length}</b><small>${esc(t('{n} demands', { n: new Set(ads.map((a) => a.offer)).size }))}</small></div>
        <div class="kpi"><span>${esc(t('Spend'))}</span><b>${money(m.spend)}</b></div><div class="kpi"><span>${esc(t('Revenue'))}</span><b>${money(m.revenue)}</b></div>
        <div class="kpi"><span>ROAS</span><b>${num(m.roas, 2)}</b></div><div class="kpi"><span>CPA</span><b>${money(m.cpa)}</b></div>
        <div class="kpi"><span>${esc(t('Effectiveness'))}</span><b>${pct(m.classified ? m.effective / m.classified : null)}</b><small>${esc(t('{e} of {c} classified', { e: m.effective, c: m.classified }))}</small></div>
      </div>
      <section class="chart-card"><header><h3>${esc(t('Ads by status'))}</h3><small class="muted">${esc(t('Click a bar to open those ads in Reports'))}</small></header>
        <div class="bars">${counts.map(([s, n]) => `<button class="bar s-${s}" data-a="perfBar" data-s="${s}" style="--h:${(n / max) * 100}%"><b>${n}</b><i></i><span>${esc(sl(s))}</span></button>`).join('')}</div></section>
      <div class="pf-grid">${table(t('By manager'), groups((a) => [offer(a.offer).assignee], (k) => (user(k) || {}).name || '—'))}${table(t('By product'), groups(adProducts, catLabel))}</div>
      ${table(t('By mechanism'), groups((a) => offer(a.offer).mechanisms, catLabel))}`;
  }

  // ---------- Drive ----------
  function viewDrive() {
    if (!isAdmin()) return denied();
    const D = UI.drive;
    const tabs = [['new', t('New')], ['linked', t('Linked')], ['ignored', t('Ignored')]];
    const inTab = DB.batches.filter((b) => b.status === D.tab && !b.removed);
    const bySource = DB.sources.map((s) => [s, inTab.filter((b) => b.source === s.id).sort((a, b) => b.arrived.localeCompare(a.arrived))]).filter(([, l]) => l.length);
    const filesOf = (b) => DB.files.filter((f) => f.batch === b.id && !f.removed);
    const batchCard = (b) => {
      const fs = filesOf(b); const sel = D.sel.has(b.id); const o = offer(b.offer);
      return `<article class="batch${sel ? ' sel' : ''}">
        <label class="cbx"><input type="checkbox" data-ch="sel" data-scope="drive" data-id="${b.id}"${sel ? ' checked' : ''} aria-label="${esc(t('Select batch'))}"><span></span></label>
        <div class="batch-b"><b>${esc(b.name)}</b><small>${esc(t('Arrived {d}', { d: fmtDate(b.arrived) }))} · ${fs.length} ${esc(t('files'))}${b.reason ? ' · ' + esc(b.reason === 'before_cutoff' ? t('before the Oct 8 cutoff') : t('ignored by you')) : ''}${o ? ' · #' + o.number : ''}</small>
          <details><summary>${esc(t('Files'))}</summary><ul class="files">${fs.map((f) => `<li><span>${esc(f.name)}</span><small>${num(f.size / 1048576)} MB</small>${f.ad ? `<span class="tag">${esc(t('ad created'))}</span>` : ''}</li>`).join('')}</ul></details></div>
        <div class="batch-a">${D.tab === 'new' ? `<button class="btn primary xs" data-a="batchCreate" data-id="${b.id}">${IC.plus}${esc(t('Create demand'))}</button><button class="btn ghost xs" data-a="batchLink" data-id="${b.id}">${esc(t('Link to demand'))}</button><button class="btn ghost xs" data-a="batchIgnore" data-id="${b.id}">${esc(t('Ignore'))}</button>`
          : D.tab === 'linked' ? `<a class="btn ghost xs" href="#/demand/${b.offer}">${esc(t('Open demand'))}</a>` : `<button class="btn ghost xs" data-a="batchRestore" data-id="${b.id}">${esc(t('Restore'))}</button>`}</div>
      </article>`;
    };
    const selN = D.sel.size;
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Admin / Drive Inbox'))}</p><h1 class="page-title">${esc(t('Drive Inbox'))}</h1>
      <p class="muted">${esc(t('Every new batch dropped into an "EDIÇÃO - ADS" folder shows up here. Turn it into a demand in one click.'))}</p></div>
      <div class="ph-a"><button class="btn primary" data-a="scan">${IC.refresh}${esc(t('Read Drive now'))}</button></div></div>
      <div class="scanline"><span>${IC.clock}${esc(t('Last automatic scan'))}: <b>${esc(ago(DB.scans.auto))}</b></span>${DB.scans.manual ? `<span>${esc(t('Last manual scan'))}: <b>${esc(ago(DB.scans.manual.at))}</b> · ${esc(t('{b} new batches, {f} files', { b: DB.scans.manual.b, f: DB.scans.manual.f }))}</span>` : ''}<span class="muted">${esc(t('Incremental every 10 min · full read every 24 h'))}</span></div>
      <div class="viewbar"><div class="seg">${tabs.map(([k, l]) => `<button class="${D.tab === k ? 'on' : ''}" data-a="driveTab" data-v="${k}">${esc(l)} <b class="count">${DB.batches.filter((b) => b.status === k && !b.removed).length}</b></button>`).join('')}</div></div>
      ${bySource.length ? bySource.map(([s, list]) => `<section class="src"><header><div><b>${esc(catLabel(s.product))}</b><small>${esc(s.path)}</small>${s.error ? `<small class="err">${esc(s.error)}</small>` : ''}</div><button class="link" data-a="selFolder" data-id="${s.id}">${esc(t('Select all in this folder'))}</button></header>${list.map(batchCard).join('')}</section>`).join('') : `<div class="empty"><b>${esc(t('Nothing here.'))}</b></div>`}
      ${selN ? `<div class="bulk"><b>${esc(t('{n} selected', { n: selN }))}</b>${D.tab === 'new' ? `<button class="btn primary sm" data-a="batchCreateMany">${IC.plus}${esc(t('Create {n} demands', { n: selN }))}</button><button class="btn ghost sm" data-a="batchIgnoreMany">${esc(t('Ignore selected'))}</button>` : D.tab === 'ignored' ? `<button class="btn primary sm" data-a="batchRestoreMany">${esc(t('Restore selected'))}</button>` : ''}<button class="btn ghost sm" data-a="clearSel">${esc(t('Clear'))}</button></div>` : ''}`;
  }

  // ---------- Ads per offer ----------
  function viewAdsPerOffer() {
    if (!isAdmin()) return denied();
    const ST = [['copy', 'Copywriter'], ['editing', t('Editing')], ['dev', 'Dev'], ['traffic', t('Traffic')], ['approved', t('Approved')]];
    const total = DB.tasks.reduce((s, x) => s + x.editing, 0);
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Admin / Ads per offer'))}</p><h1 class="page-title">${esc(t('Ads per offer'))}</h1>
      <p class="muted">${esc(t('Each VSL needs {g} ads. Edited videos come from Drive, hooks waiting for video come from the COPY ADS docs.', { g: ADS_GOAL }))}</p></div></div>
      <div class="kgrid"><div class="kpi hl"><span>${esc(t('Offers'))}</span><b>${DB.tasks.length}</b></div><div class="kpi"><span>${esc(t('Edited ads'))}</span><b>${total}</b></div><div class="kpi"><span>${esc(t('Hooks waiting for video'))}</span><b>${DB.tasks.reduce((s, x) => s + x.copy, 0)}</b></div><div class="kpi"><span>${esc(t('At goal'))}</span><b>${DB.tasks.filter((x) => x.editing >= ADS_GOAL).length}</b></div></div>
      ${ST.map(([k, l]) => { const list = DB.tasks.filter((x) => x.stage === k); return list.length ? `<section class="stage"><h3>${esc(l)} <b class="count">${list.length}</b></h3>${list.map((x) => {
        const p = Math.min(1, x.editing / ADS_GOAL); const lab = x.editing >= ADS_GOAL ? t('Has ads') : x.editing + x.copy >= ADS_GOAL ? t('To edit') : t('Make ads');
        return `<div class="apo"><div><b>${esc(x.name)}</b><small>${esc(catLabel(x.mechanism))} · ${esc(t('Editing'))}: ${x.editing} · Copy: ${x.copy}</small></div><div class="apo-p"><span class="prog"><i style="width:${p * 100}%"></i><i class="cp" style="width:${Math.min(1 - p, x.copy / ADS_GOAL) * 100}%"></i></span><span class="mono">${x.editing}/${ADS_GOAL}</span></div><span class="tag ${x.editing >= ADS_GOAL ? 'green' : x.editing + x.copy >= ADS_GOAL ? 'amber' : ''}">${esc(lab)}</span><a class="btn ghost xs" href="${esc(x.folder)}" target="_blank" rel="noopener">Drive${IC.ext}</a></div>`;
      }).join('')}</section>` : ''; }).join('')}`;
  }

  // ---------- admin ----------
  function viewAdmin() {
    if (!isAdmin()) return denied();
    const tab = route().q.tab || 'users';
    const tabs = [['users', t('Users')], ['catalog', t('Catalog')], ['folders', t('Drive folders')], ['integrations', t('Integrations')]];
    let c = '';
    if (tab === 'catalog') {
      const ro = (kind, title) => `<section class="cat"><h3>${esc(title)}</h3><ul>${catalogOf(kind, true).map((x) => `<li class="${x.active ? '' : 'off'}">${esc(x.label)}<small>${x.active ? esc(t('active')) : esc(t('inactive'))}</small></li>`).join('')}</ul><small class="muted">${esc(t('Synced from ClickUp'))}</small></section>`;
      c = `<section class="cat wide"><header><h3>${esc(t('Mechanisms'))}</h3><button class="btn primary sm" data-a="newMech">${IC.plus}${esc(t('New mechanism'))}</button></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('Name'))}</th><th>${esc(t('Origin'))}</th><th>${esc(t('Demands'))}</th><th>${esc(t('State'))}</th><th></th></tr></thead><tbody>
        ${catalogOf('mechanism', true).map((x) => `<tr class="${x.active ? '' : 'off'}"><td class="strong">${esc(x.label)}</td><td>${esc(x.src === 'app' ? t('Created in the app') : 'ClickUp')}</td><td class="mono">${DB.offers.filter((o) => o.mechanisms.includes(x.id)).length}</td><td>${x.active ? `<span class="tag green">${esc(t('Active'))}</span>` : `<span class="tag">${esc(t('Inactive'))}</span>`}</td><td class="r"><button class="link" data-a="renameMech" data-id="${x.id}">${esc(t('Rename'))}</button> <button class="link" data-a="toggleMech" data-id="${x.id}">${esc(x.active ? t('Deactivate') : t('Activate'))}</button></td></tr>`).join('')}
      </tbody></table></div></section><div class="cat-grid">${ro('product', t('Products'))}${ro('vsl', 'VSLs')}${ro('channel', t('Channels'))}<section class="cat"><h3>${esc(t('Niches'))}</h3><ul>${DB.niches.map((n) => `<li>${esc(nicheLabel(n.id))}</li>`).join('')}</ul></section></div>`;
    } else if (tab === 'folders') {
      c = `<div class="row-a"><button class="btn primary sm" data-a="newFolder">${IC.plus}${esc(t('Add folder'))}</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('Folder'))}</th><th>${esc(t('Defaults'))}</th><th>${esc(t('Cutoff'))}</th><th>${esc(t('Last scan'))}</th><th>${esc(t('State'))}</th><th></th></tr></thead><tbody>
        ${DB.sources.map((s) => `<tr class="${s.active ? '' : 'off'}"><td><b>${esc(s.name)}</b>${s.discovered ? ` <span class="tag">${esc(t('auto-discovered'))}</span>` : ''}<small class="block muted">${esc(s.path)}</small>${s.error ? `<small class="block err">${esc(s.error)}</small>` : ''}</td><td>${esc(catLabel(s.product))} · ${esc(nicheLabel(s.niche))} · ${esc(catLabel(s.channel))}</td><td class="mono">${esc(fmtDate(s.since, true))}</td><td class="muted">${esc(ago(s.lastScan))}</td><td>${s.active ? `<span class="tag green">${esc(t('Active'))}</span>` : `<span class="tag">${esc(t('Inactive'))}</span>`}</td><td class="r"><button class="link" data-a="toggleFolder" data-id="${s.id}">${esc(s.active ? t('Deactivate') : t('Activate'))}</button></td></tr>`).join('')}
      </tbody></table></div>`;
    } else if (tab === 'integrations') {
      c = `<p class="muted">${esc(t('Today every metric is typed by hand. These connections would pull spend, clicks and revenue automatically.'))}</p><div class="ints">${DB.integrations.map((x) => `<div class="int"><span class="int-ic">${esc(x.platform.slice(0, 2))}</span><b>${esc(x.platform)}</b><small>${esc(t('Not connected'))}</small><button class="btn ghost xs" disabled>${esc(t('Coming soon'))}</button></div>`).join('')}</div>`;
    } else {
      c = `<div class="row-a"><button class="btn primary sm" data-a="invite">${IC.plus}${esc(t('Invite user'))}</button></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>${esc(t('Name'))}</th><th>Email</th><th>${esc(t('Role'))}</th><th>${esc(t('Demands'))}</th><th>${esc(t('Last access'))}</th><th>${esc(t('Access'))}</th><th></th></tr></thead><tbody>
        ${DB.users.map((u) => { const self = u.id === UI.user; return `<tr class="${u.active ? '' : 'off'}"><td><span class="avatar sm">${esc(initials(u.name))}</span> <b>${esc(u.name)}</b>${self ? ` <span class="tag">${esc(t('you'))}</span>` : ''}</td><td class="muted">${esc(u.email)}</td><td><select data-ch="role" data-id="${u.id}"${self ? ' disabled' : ''}><option value="admin"${u.role === 'admin' ? ' selected' : ''}>${esc(t('Administrator'))}</option><option value="gestor"${u.role === 'gestor' ? ' selected' : ''}>${esc(t('Traffic manager'))}</option></select></td><td class="mono">${DB.offers.filter((o) => o.assignee === u.id).length}</td><td class="muted">${u.last ? esc(ago(u.last)) : esc(t('never signed in'))}</td><td>${u.active ? `<span class="tag green">${esc(t('Active'))}</span>` : `<span class="tag">${esc(t('Inactive'))}</span>`}</td><td class="r">${u.last ? '' : `<button class="link" data-a="resend" data-id="${u.id}">${esc(t('Resend invite'))}</button> `}<button class="link" data-a="toggleUser" data-id="${u.id}"${self ? ' disabled' : ''}>${esc(u.active ? t('Deactivate') : t('Activate'))}</button></td></tr>`; }).join('')}
      </tbody></table></div>`;
    }
    return `<div class="ph"><div><p class="eyebrow">${esc(t('Admin'))}</p><h1 class="page-title">${esc(t('Administration'))}</h1></div></div>
      <nav class="tabs">${tabs.map(([k, l]) => `<a href="#/admin?tab=${k}" class="${tab === k ? 'on' : ''}">${esc(l)}</a>`).join('')}</nav><div class="tab-b">${c}</div>`;
  }
  const denied = () => `<div class="empty big"><b>${esc(t('Admins only.'))}</b><a class="btn ghost" href="#/">${esc(t('Back'))}</a></div>`;

  // ---------- modais ----------
  const modalRoot = document.getElementById('modal');
  let modalSubmit = null;
  function openModal(title, body, onSubmit, opts) {
    opts = opts || {};
    modalSubmit = onSubmit;
    modalRoot.innerHTML = `<div class="mback" data-a="closeModal"></div><form class="modal${opts.wide ? ' wide' : ''}" data-form="modal" novalidate><header><h2>${esc(title)}</h2><button type="button" class="tool" data-a="closeModal" aria-label="${esc(t('Close'))}">${IC.x}</button></header><div class="mb">${body}</div><p class="merr" role="alert"></p><footer><button type="button" class="btn ghost" data-a="closeModal">${esc(t('Cancel'))}</button><button class="btn ${opts.danger ? 'danger' : 'primary'}">${esc(opts.ok || t('Save'))}</button></footer></form>`;
    modalRoot.classList.add('on');
    const f = modalRoot.querySelector('input:not([type=checkbox]):not([type=radio]),textarea,select');
    if (f) setTimeout(() => f.focus(), 30);
  }
  function closeModal() { modalRoot.classList.remove('on'); modalRoot.innerHTML = ''; modalSubmit = null; }
  const mErr = (msg) => { const e = modalRoot.querySelector('.merr'); if (e) e.textContent = msg; };
  const checks = (name, opts, vals) => `<div class="checks">${opts.map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${esc(v)}"${(vals || []).includes(v) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
  const field = (label, inner, cls) => `<label class="mf ${cls || ''}"><span>${esc(label)}</span>${inner}</label>`;
  const options = (list, val, empty) => (empty ? `<option value="">${esc(empty)}</option>` : '') + list.map(([v, l]) => `<option value="${esc(v)}"${v === val ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const activeOpts = (kind) => catalogOf(kind).map((c) => [c.id, c.label]);
  const mgrOpts = () => DB.users.filter((u) => u.active).map((u) => [u.id, u.name + ' · ' + roleLabel(u.role)]);

  function reasonModal(ids, st, current) {
    openModal(t('Rejection reason'), `<p class="muted">${esc(t('{n} ad(s) → {s}. The reason is required and goes to the history.', { n: ids.length, s: sl(st) }))}</p>${field(t('Reason'), `<textarea name="reason" required>${esc(current || '')}</textarea>`)}`, (fd) => {
      const reason = (fd.get('reason') || '').trim();
      if (!reason) return mErr(t('Write the reason.'));
      if (current != null) {
        const a = ad(ids[0]); log(a.offer, 'reason', { ad: a.name, reason }); a.reason = reason; commit(); closeModal(); toast(t('Reason saved')); return render();
      }
      const prev = setStatus(ids, st, reason);
      closeModal(); clearSel();
      toast(t(ids.length > 1 ? '{n} ads moved to {s}' : '{n} ad moved to {s}', { n: ids.length, s: sl(st) }), { undo: () => undoStatus(prev) });
      render();
    }, { ok: t('Confirm') });
  }
  function offerModal(o, prefill, after) {
    const v = o || Object.assign({ products: [], vsls: [], mechanisms: [], channel: 'c_meta', niche: '', assignee: '', name: '', drive: '', description: '', notes: '', deadline: '' }, prefill || {});
    openModal(o ? t('Edit demand #{n}', { n: o.number }) : t('New demand'), `<div class="mgrid">
      ${field(t('Name'), `<input name="name" required value="${esc(v.name)}">`, 'full')}
      ${field(t('Drive folder link'), `<input name="drive" type="url" required placeholder="https://drive.google.com/…" value="${esc(v.drive)}">`, 'full')}
      ${field(t('Products'), checks('products', activeOpts('product'), v.products), 'full')}
      ${field('VSLs', checks('vsls', activeOpts('vsl'), v.vsls), 'full')}
      ${field(t('Mechanisms'), checks('mechanisms', activeOpts('mechanism'), v.mechanisms), 'full')}
      ${field(t('Channel'), `<select name="channel">${options(activeOpts('channel'), v.channel)}</select>`)}
      ${field(t('Niche'), `<select name="niche" required>${options(DB.niches.map((n) => [n.id, nicheLabel(n.id)]), v.niche, t('Choose'))}</select>`)}
      ${field(t('Manager'), `<select name="assignee" required>${options(mgrOpts(), v.assignee, t('Choose'))}</select>`)}
      ${field(t('Deadline'), `<input type="date" name="deadline" value="${esc((v.deadline || '').slice(0, 10))}">`)}
      ${field(t('Description'), `<textarea name="description">${esc(v.description)}</textarea>`, 'full')}
      ${field(t('Notes'), `<textarea name="notes">${esc(v.notes)}</textarea>`, 'full')}
    </div>`, (fd) => {
      const d = { name: (fd.get('name') || '').trim(), drive: (fd.get('drive') || '').trim(), products: fd.getAll('products'), vsls: fd.getAll('vsls'), mechanisms: fd.getAll('mechanisms'), channel: fd.get('channel'), niche: fd.get('niche'), assignee: fd.get('assignee'), deadline: fd.get('deadline') ? fd.get('deadline') + 'T23:59:00' : null, description: (fd.get('description') || '').trim(), notes: (fd.get('notes') || '').trim() };
      if (!d.name) return mErr(t('Give the demand a name.'));
      if (!/^https:\/\//.test(d.drive)) return mErr(t('The Drive link must start with https://'));
      if (!d.products.length || !d.vsls.length || !d.mechanisms.length) return mErr(t('Pick at least one product, one VSL and one mechanism.'));
      if (!d.niche || !d.assignee) return mErr(t('Pick the niche and the manager.'));
      let target = o;
      if (o) {
        if (o.assignee !== d.assignee) { log(o.id, 'assigned', { to: d.assignee }); notify(d.assignee, o.id, 'assigned'); }
        Object.assign(o, d); log(o.id, 'offer_edited', {});
      } else {
        const n = String(Math.max(0, ...DB.offers.map((x) => +x.number)) + 1).padStart(4, '0');
        target = Object.assign({ id: uid('o'), number: n, created: now(), archived: null, source: null }, d);
        DB.offers.push(target); log(target.id, 'offer_created', { name: d.name }); log(target.id, 'assigned', { to: d.assignee }); notify(d.assignee, target.id, 'assigned');
      }
      if (after) after(target);
      commit(); closeModal(); toast(o ? t('Demand saved') : t('Demand #{n} created', { n: target.number }));
      if (!o && !after) go('#/demand/' + target.id); else render();
    }, { wide: true, ok: o ? t('Save') : t('Create demand') });
  }
  function relaunchModal(ids) {
    const ads = ids.map(ad).filter(Boolean);
    openModal(t('Relaunch {n} ad(s)', { n: ads.length }), `<p class="muted">${esc(t('Creates a new ad in Test for each target VSL. The original and its tests stay untouched.'))}</p>
      ${field(t('Target VSLs'), checks('vsls', activeOpts('vsl'), []), 'full')}
      ${field(t('Product (optional)'), `<select name="product">${options(activeOpts('product'), '', t('Keep the original'))}</select>`)}
      ${field(t('Managers (optional)'), checks('mgrs', DB.users.filter((u) => u.active && u.role === 'gestor').map((u) => [u.id, u.name]), []), 'full')}`, (fd) => {
      const vs = fd.getAll('vsls'); const prod = fd.get('product'); const mgrs = fd.getAll('mgrs');
      if (!vs.length) return mErr(t('Pick at least one target VSL.'));
      let created = 0, skipped = 0;
      ads.forEach((src) => {
        const so = offer(src.offer);
        const targets = mgrs.length ? mgrs.map((m) => {
          if (m === so.assignee) return so;
          let copy = DB.offers.find((x) => x.source === so.id && x.assignee === m && !x.archived);
          if (!copy) {
            const n = String(Math.max(0, ...DB.offers.map((x) => +x.number)) + 1).padStart(4, '0');
            copy = Object.assign({}, so, { id: uid('o'), number: n, assignee: m, created: now(), archived: null, source: so.id });
            DB.offers.push(copy); log(copy.id, 'offer_created', { name: copy.name }); log(copy.id, 'assigned', { to: m }); notify(m, copy.id, 'assigned');
          }
          return copy;
        }) : [so];
        targets.forEach((to) => vs.forEach((v) => {
          if (DB.ads.some((x) => x.origin === src.id && x.targetVsl === v && x.offer === to.id)) { skipped++; return; }
          DB.ads.push(Object.assign({}, src, { id: uid('a'), offer: to.id, status: 'test', reason: '', changed: now(), created: now(), origin: src.id, targetVsl: v, targetProducts: prod ? [prod] : null, trashed: null, trashPrev: null }));
          log(to.id, 'relaunched', { ad: src.name, vsl: v }); created++;
        }));
      });
      commit(); closeModal(); clearSel();
      toast(t('{n} relaunched ads created in Test', { n: created }) + (skipped ? ' · ' + t('{n} already existed', { n: skipped }) : ''));
      render();
    }, { wide: true, ok: t('Relaunch') });
  }
  function bulkEditModal(offerIds) {
    const os = offerIds.map(offer);
    openModal(t('Edit {n} demands', { n: os.length }), `<p class="muted">${esc(t('Only the fields you touch change. Lists you leave as "keep" stay different per demand.'))}</p>
      ${field(t('Manager'), `<select name="assignee">${options(mgrOpts(), '', t('Keep each one'))}</select>`)}
      ${field(t('Deadline'), `<input type="date" name="deadline">`)}
      ${field(t('Add mechanism'), `<select name="mech">${options(activeOpts('mechanism'), '', t('Keep each one'))}</select>`)}
      ${field(t('Add VSL'), `<select name="vsl">${options(activeOpts('vsl'), '', t('Keep each one'))}</select>`)}`, (fd) => {
      const a = fd.get('assignee'), dl = fd.get('deadline'), m = fd.get('mech'), v = fd.get('vsl');
      os.forEach((o) => {
        if (a && o.assignee !== a) { o.assignee = a; log(o.id, 'assigned', { to: a }); notify(a, o.id, 'assigned'); }
        if (dl) o.deadline = dl + 'T23:59:00';
        if (m && !o.mechanisms.includes(m)) o.mechanisms.push(m);
        if (v && !o.vsls.includes(v)) o.vsls.push(v);
        log(o.id, 'offer_edited', {});
      });
      commit(); closeModal(); clearSel(); toast(t('{n} demands updated', { n: os.length })); render();
    }, { ok: t('Apply') });
  }
  function testModal(a) {
    openModal(t('Record test · {ad}', { ad: a.name }), `<div class="mgrid">
      ${field(t('Start'), `<input type="date" name="start" required value="${new Date().toISOString().slice(0, 10)}">`)}
      ${field(t('End'), `<input type="date" name="end">`)}
      ${field(t('Spend (R$)'), `<input name="spend" inputmode="decimal" placeholder="1.234,56">`)}
      ${field(t('Revenue (R$)'), `<input name="revenue" inputmode="decimal">`)}
      ${field(t('Impressions'), `<input name="impressions" inputmode="numeric">`)}
      ${field(t('Clicks'), `<input name="clicks" inputmode="numeric">`)}
      ${field(t('Conversions'), `<input name="conversions" inputmode="numeric">`)}
      ${field(t('Classification'), `<select name="cls"><option value="">${esc(t('Unclassified'))}</option><option value="effective">${esc(t('Effective'))}</option><option value="not_effective">${esc(t('Not effective'))}</option></select>`)}
      ${field(t('Notes'), `<textarea name="notes"></textarea>`, 'full')}</div>`, (fd) => {
      const dec = (s) => { s = (s || '').trim(); if (!s) return null; const v = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s); return isNaN(v) ? NaN : v; };
      const int = (s) => { s = (s || '').trim(); if (!s) return null; return /^\d+$/.test(s.replace(/[.,]/g, '')) ? +s.replace(/[.,]/g, '') : NaN; };
      const x = { id: uid('t'), ad: a.id, offer: a.offer, start: fd.get('start'), end: fd.get('end') || null, spend: dec(fd.get('spend')), revenue: dec(fd.get('revenue')), impressions: int(fd.get('impressions')), clicks: int(fd.get('clicks')), conversions: int(fd.get('conversions')), cls: fd.get('cls') || null, notes: (fd.get('notes') || '').trim(), src: 'manual' };
      if (!x.start) return mErr(t('Start date is required.'));
      if ([x.spend, x.revenue, x.impressions, x.clicks, x.conversions].some((v) => Number.isNaN(v))) return mErr(t('Check the numbers: use 1.234,56 or 1234.56.'));
      if (x.end && x.end < x.start) return mErr(t('End date is before the start.'));
      if (x.cls && !x.end) return mErr(t('Only finished tests can be classified. Add the end date.'));
      if (x.clicks != null && x.impressions != null && x.clicks > x.impressions) return mErr(t('Clicks are higher than impressions.'));
      DB.tests.push(x); log(a.offer, 'test_added', { ad: a.name }); UI.openAds.add(a.id);
      commit(); closeModal(); toast(t('Test recorded')); render();
    }, { wide: true, ok: t('Save test') });
  }

  // ---------- paleta de comandos ----------
  function palette() {
    const pages = [['#/', t('Panel')], ['#/pipeline', t('Pipeline')], ['#/reports', t('Reports')], ['#/performance', t('Performance')]];
    if (isAdmin()) pages.push(['#/drive', t('Drive Inbox')], ['#/ads-per-offer', t('Ads per offer')], ['#/admin', t('Administration')]);
    const items = pages.map(([h, l]) => ({ h, l, k: t('Page') }))
      .concat(DB.offers.filter(canSee).map((o) => ({ h: '#/demand/' + o.id, l: '#' + o.number + ' ' + o.name, k: t('Demand') })))
      .concat(visibleAds().map((a) => ({ h: '#/demand/' + a.offer + '?tab=ads', l: adTitle(a), k: sl(a.status) })));
    modalRoot.innerHTML = `<div class="mback" data-a="closeModal"></div><div class="pal"><span class="search">${IC.search}<input id="pal-q" placeholder="${esc(t('Jump to a page, demand or ad…'))}" autocomplete="off"></span><div class="pal-l" id="pal-l"></div><p class="pal-f"><kbd>↑</kbd><kbd>↓</kbd> ${esc(t('navigate'))} <kbd>↵</kbd> ${esc(t('open'))} <kbd>esc</kbd> ${esc(t('close'))}</p></div>`;
    modalRoot.classList.add('on');
    const q = document.getElementById('pal-q'), L = document.getElementById('pal-l');
    let idx = 0, shown = [];
    const draw = () => {
      const s = q.value.trim().toLowerCase();
      shown = items.filter((x) => !s || x.l.toLowerCase().includes(s)).slice(0, 12);
      idx = Math.min(idx, Math.max(0, shown.length - 1));
      L.innerHTML = shown.map((x, i) => `<a href="${x.h}" class="${i === idx ? 'on' : ''}"><span>${esc(x.l)}</span><small>${esc(x.k)}</small></a>`).join('') || `<p class="empty-s">${esc(t('Nothing found.'))}</p>`;
    };
    q.addEventListener('input', () => { idx = 0; draw(); });
    q.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { idx = Math.min(shown.length - 1, idx + 1); draw(); e.preventDefault(); }
      if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); draw(); e.preventDefault(); }
      if (e.key === 'Enter' && shown[idx]) { closeModal(); go(shown[idx].h); }
    });
    L.addEventListener('click', () => setTimeout(closeModal, 0));
    draw(); q.focus();
  }

  // ---------- toasts ----------
  const toasts = document.getElementById('toasts');
  function toast(msg, opts) {
    opts = opts || {};
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(msg)}</span>${opts.undo ? `<button class="link">${IC.undo}${esc(t('Undo'))}</button>` : ''}`;
    if (opts.undo) el.querySelector('button').onclick = () => { opts.undo(); el.remove(); };
    toasts.appendChild(el);
    requestAnimationFrame(() => el.classList.add('in'));
    setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, opts.undo ? 10000 : 3500);
  }

  // ---------- CSV ----------
  function download(name, text) {
    const b = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
    const u = URL.createObjectURL(b); const l = document.createElement('a'); l.href = u; l.download = name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  const csvCell = (v) => { if (v == null) return ''; const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const csv = (rows) => rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
  const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  function csvOffer(o) {
    const head = ['Demand', 'Demand name', 'Ad', 'Product', 'VSL', 'Mechanism', 'Channel', 'Manager', 'Status', 'Rejection reason', 'Relaunch of', 'Test start', 'Test end', 'Classification', 'Spend', 'Revenue', 'Impressions', 'Clicks', 'Conversions', 'ROAS', 'CPA', 'CTR', 'CPC', 'CPM'];
    const rows = [head];
    DB.ads.filter((a) => a.offer === o.id && !a.trashed).forEach((a) => {
      const base = ['#' + o.number, o.name, a.name, adProducts(a).map(catLabel).join(' + '), adVsls(a).map(catLabel).join(' + '), o.mechanisms.map(catLabel).join(' + '), catLabel(a.channel), (user(o.assignee) || {}).name, SLABEL[a.status], a.reason, a.origin ? (ad(a.origin) || {}).name : ''];
      const ts = testsOf(a).filter((x) => (!UI.rep.f.tFrom || x.start >= UI.rep.f.tFrom) && (!UI.rep.f.tTo || x.start <= UI.rep.f.tTo));
      if (!ts.length) rows.push(base);
      ts.forEach((x) => { const m = metrics([x]); rows.push(base.concat([x.start, x.end, x.cls, x.spend, x.revenue, x.impressions, x.clicks, x.conversions, m.roas && +m.roas.toFixed(2), m.cpa && +m.cpa.toFixed(2), m.ctr && +(m.ctr * 100).toFixed(2), m.cpc && +m.cpc.toFixed(2), m.cpm && +m.cpm.toFixed(2)])); });
    });
    download('demand-' + o.number + '-' + slug(o.name) + '-' + new Date().toISOString().slice(0, 10) + '.csv', csv(rows));
  }
  function csvAll() {
    const list = applyFilters(visibleAds(), UI.rep.f);
    const rows = [['Demand', 'Ad', 'Product', 'VSL', 'Mechanism', 'Channel', 'Manager', 'Status', 'Rejection reason', 'Tests', 'Spend', 'Revenue', 'ROAS', 'Final classification']];
    list.forEach((a) => { const o = offer(a.offer); const m = metrics(testsOf(a)); rows.push(['#' + o.number, a.name, adProducts(a).map(catLabel).join(' + '), adVsls(a).map(catLabel).join(' + '), o.mechanisms.map(catLabel).join(' + '), catLabel(a.channel), (user(o.assignee) || {}).name, SLABEL[a.status], a.reason, testsOf(a).length, m.spend, m.revenue, m.roas && +m.roas.toFixed(2), finalCls(a)]); });
    download('shippingcaps-consolidated-' + new Date().toISOString().slice(0, 10) + '.csv', csv(rows));
  }

  // ---------- Drive: ações ----------
  function linkBatch(b, o) {
    const fs = DB.files.filter((f) => f.batch === b.id && !f.removed && !f.ad);
    fs.forEach((f) => {
      const a = { id: uid('a'), offer: o.id, name: f.name.replace(/\.[^.]+$/, ''), channel: o.channel, link: 'https://drive.google.com/file/d/' + f.id + '/view', status: 'test', changed: now(), reason: '', created: now(), trashed: null, trashPrev: null, origin: null, targetVsl: null, targetProducts: null };
      DB.ads.push(a); f.ad = a.id;
    });
    b.status = 'linked'; b.offer = o.id; b.reason = null;
    log(o.id, 'drive_linked', { batch: b.name, n: fs.length });
    notify(o.assignee, o.id, 'drive_ads', { n: fs.length });
    return fs.length;
  }
  function batchDefaults(b) {
    const s = DB.sources.find((x) => x.id === b.source);
    return { name: catLabel(s.product) + ' — ' + b.name, drive: 'https://drive.google.com/drive/folders/demo-' + b.id, products: [s.product], niche: s.niche, channel: s.channel, vsls: [], mechanisms: [] };
  }

  // ---------- render ----------
  function render() {
    UI.bellOpen = UI.bellOpen && !!UI.user; UI.menuOpen = UI.menuOpen && !!UI.user;
    document.documentElement.lang = UI.lang === 'pt' ? 'pt-BR' : 'en';
    const focus = document.activeElement && document.activeElement.id ? { id: document.activeElement.id, s: document.activeElement.selectionStart } : null;
    if (!UI.user) { app.innerHTML = viewLogin(); document.title = 'Traffic Hub · ' + t('Sign in'); return; }
    const r = route();
    let body, title;
    switch (r.name) {
      case 'panel': body = shell(viewPanel(), { panel: true }); title = t('Panel'); break;
      case 'pipeline': body = shell(viewPipeline()); title = t('Pipeline'); break;
      case 'demand': body = shell(viewDemand(r.id, r.q.tab)); title = (offer(r.id) ? '#' + offer(r.id).number : t('Demand')); break;
      case 'reports': body = shell(viewReports()); title = t('Reports'); break;
      case 'performance': body = shell(viewPerformance()); title = t('Performance'); break;
      case 'drive': body = shell(viewDrive()); title = t('Drive Inbox'); break;
      case 'adsPerOffer': body = shell(viewAdsPerOffer()); title = t('Ads per offer'); break;
      case 'admin': body = shell(viewAdmin()); title = t('Administration'); break;
      default: body = shell(`<div class="empty big"><b>${esc(t('Page not found'))}</b><a class="btn ghost" href="#/pipeline">${esc(t('Back to pipeline'))}</a></div>`); title = '404';
    }
    app.innerHTML = body;
    document.title = title + ' · Traffic Hub';
    if (focus) { const el = document.getElementById(focus.id); if (el) { el.focus(); try { el.setSelectionRange(focus.s, focus.s); } catch (e) { /* não é texto */ } } }
  }

  // ---------- eventos ----------
  const A = {
    login: (el) => { UI.user = el.dataset.id; saveUI(); go('#/'); },
    signOut: () => { UI.user = null; UI.menuOpen = false; saveUI(); render(); },
    switchUser: (el) => { UI.user = el.dataset.id; UI.menuOpen = false; saveUI(); clearSel(); toast(t('Now viewing as {n}', { n: me().name })); render(); },
    lang: () => { UI.lang = UI.lang === 'pt' ? 'en' : 'pt'; saveUI(); render(); },
    bell: () => { UI.bellOpen = !UI.bellOpen; UI.menuOpen = false; render(); },
    menu: () => { UI.menuOpen = !UI.menuOpen; UI.bellOpen = false; render(); },
    readAll: () => { DB.notifications.forEach((n) => { if (n.user === UI.user) n.read = true; }); commit(); render(); },
    openNotif: (el) => { const n = DB.notifications.find((x) => x.id === el.dataset.id); n.read = true; commit(); UI.bellOpen = false; go('#/demand/' + n.offer); },
    resetDemo: () => { if (!confirm(t('Reset all demo data to the original sample?'))) return; store.del(LS); DB = window.buildSeed(); commit(); clearSel(); toast(t('Demo data reset')); render(); },
    palette: () => palette(),
    closeModal: () => closeModal(),
    clearFilters: (el) => { const s = el.dataset.scope; if (s === 'pipe') UI.pipe.f = {}; if (s === 'rep') UI.rep.f = {}; if (s === 'perf') UI.perf.f = {}; render(); },
    pipeView: (el) => { UI.pipe.view = el.dataset.v; clearSel(); saveUI(); render(); },
    selectMode: () => { UI.pipe.selectMode = !UI.pipe.selectMode; if (!UI.pipe.selectMode) UI.pipe.sel.clear(); render(); },
    clearSel: () => { clearSel(); render(); },
    bulkStatus: (el) => { const st = document.getElementById('bulk-st').value; const S = el.dataset.scope === 'rep' ? UI.rep : UI.pipe; changeStatus([...S.sel], st); },
    relaunch: (el) => relaunchModal([...(el.dataset.scope === 'rep' ? UI.rep : UI.pipe).sel]),
    relaunchOne: (el) => relaunchModal([el.dataset.id]),
    bulkEdit: () => bulkEditModal([...new Set([...UI.pipe.sel].map((id) => ad(id).offer))]),
    trashSel: () => trashAds([...UI.pipe.sel]),
    trashOne: (el) => trashAds([el.dataset.id]),
    restore: () => restoreAds([...UI.pipe.sel]),
    deleteForever: () => { const ids = [...UI.pipe.sel]; openModal(t('Delete permanently'), `<p>${esc(t('{n} ad(s) will be deleted for good. Ads that already have tests are kept.', { n: ids.length }))}</p>`, () => { closeModal(); deleteAds(ids); }, { danger: true, ok: t('Delete') }); },
    newOffer: () => offerModal(null),
    editOffer: (el) => offerModal(offer(el.dataset.id)),
    archive: (el) => { const o = offer(el.dataset.id); o.archived = o.archived ? null : now(); log(o.id, o.archived ? 'archived' : 'unarchived'); commit(); toast(o.archived ? t('Demand archived') : t('Demand restored')); render(); },
    csvOffer: (el) => csvOffer(offer(el.dataset.id)),
    csvAll: () => csvAll(),
    print: () => window.print(),
    toggleAd: (el) => { const id = el.dataset.id; UI.openAds.has(id) ? UI.openAds.delete(id) : UI.openAds.add(id); render(); },
    newAd: (el) => { const o = offer(el.dataset.id); openModal(t('New ad'), `${field(t('Name (file name without extension)'), '<input name="name" required>')}${field(t('Channel'), `<select name="channel">${options(activeOpts('channel'), o.channel)}</select>`)}${field(t('Link'), '<input name="link" type="url" placeholder="https://drive.google.com/file/d/…">')}`, (fd) => {
      const name = (fd.get('name') || '').trim(); if (!name) return mErr(t('Give the ad a name.'));
      if (DB.ads.some((a) => a.offer === o.id && a.name.toLowerCase() === name.toLowerCase())) return mErr(t('This demand already has an ad with that name.'));
      DB.ads.push({ id: uid('a'), offer: o.id, name, channel: fd.get('channel'), link: (fd.get('link') || '').trim() || o.drive, status: 'test', changed: now(), reason: '', created: now(), trashed: null, trashPrev: null, origin: null, targetVsl: null, targetProducts: null });
      log(o.id, 'ad_created', { ad: name }); commit(); closeModal(); toast(t('Ad created in Test')); render();
    }); },
    newTest: (el) => testModal(ad(el.dataset.id)),
    delTest: (el) => { const x = DB.tests.find((y) => y.id === el.dataset.id); DB.tests = DB.tests.filter((y) => y !== x); log(x.offer, 'test_deleted', { ad: (ad(x.ad) || {}).name }); commit(); toast(t('Test deleted'), { undo: () => { DB.tests.push(x); commit(); render(); } }); render(); },
    editReason: (el) => { const a = ad(el.dataset.id); reasonModal([a.id], a.status, a.reason || ''); },
    reply: (el) => { UI.replyTo = UI.replyTo === el.dataset.id ? null : el.dataset.id; render(); },
    repShortcut: (el) => { UI.rep.f.status = el.dataset.s || ''; render(); },
    perfBar: (el) => { UI.rep.f = Object.assign({}, UI.perf.f, { status: el.dataset.s }); go('#/reports'); },
    driveTab: (el) => { UI.drive.tab = el.dataset.v; UI.drive.sel.clear(); render(); },
    selFolder: (el) => { DB.batches.filter((b) => b.source === el.dataset.id && b.status === UI.drive.tab && !b.removed).forEach((b) => UI.drive.sel.add(b.id)); render(); },
    scan: () => {
      const s = DB.sources.filter((x) => x.active)[Math.floor(Math.random() * DB.sources.filter((x) => x.active).length)];
      const p = cat(s.product); const nf = 3 + Math.floor(Math.random() * 6);
      const b = { id: uid('b'), source: s.id, name: 'LOTE ' + String(DB.batches.filter((x) => x.source === s.id).length + 1).padStart(2, '0') + ' - ' + new Date().toISOString().slice(5, 10), status: 'new', reason: null, offer: null, removed: null, arrived: now() };
      DB.batches.push(b);
      for (let i = 0; i < nf; i++) DB.files.push({ id: uid('f'), batch: b.id, name: p.prefix + (70 + DB.files.length % 30) + 'H' + (1 + i % 6) + '.mp4', size: (12 + i * 9) * 1048576, at: now(), ad: null, removed: null });
      DB.scans.manual = { at: now(), b: 1, f: nf }; s.lastScan = now(); s.error = '';
      UI.drive.tab = 'new'; commit(); toast(t('Scan finished · 1 new batch, {n} files', { n: nf })); render();
    },
    batchCreate: (el) => { const b = DB.batches.find((x) => x.id === el.dataset.id); offerModal(null, batchDefaults(b), (o) => { const n = linkBatch(b, o); setTimeout(() => toast(t('{n} ads created in Test', { n })), 50); }); },
    batchLink: (el) => {
      const b = DB.batches.find((x) => x.id === el.dataset.id);
      openModal(t('Link {b} to a demand', { b: b.name }), field(t('Demand'), `<select name="offer" required>${options(DB.offers.filter((o) => !o.archived).map((o) => [o.id, '#' + o.number + ' ' + o.name]), '', t('Choose'))}</select>`), (fd) => {
        const o = offer(fd.get('offer')); if (!o) return mErr(t('Choose a demand.'));
        const n = linkBatch(b, o); commit(); closeModal(); toast(t('{n} ads created in Test', { n })); render();
      }, { ok: t('Link') });
    },
    batchIgnore: (el) => { const b = DB.batches.find((x) => x.id === el.dataset.id); b.status = 'ignored'; b.reason = 'manual'; commit(); toast(t('Batch ignored'), { undo: () => { b.status = 'new'; b.reason = null; commit(); render(); } }); render(); },
    batchRestore: (el) => { const b = DB.batches.find((x) => x.id === el.dataset.id); b.status = b.offer ? 'linked' : 'new'; b.reason = null; commit(); toast(t('Batch restored')); render(); },
    batchIgnoreMany: () => { const ids = [...UI.drive.sel]; ids.forEach((id) => { const b = DB.batches.find((x) => x.id === id); if (b.status === 'new' && !b.offer) { b.status = 'ignored'; b.reason = 'manual'; } }); commit(); clearSel(); toast(t('{n} batches ignored', { n: ids.length })); render(); },
    batchRestoreMany: () => { const ids = [...UI.drive.sel]; ids.forEach((id) => { const b = DB.batches.find((x) => x.id === id); b.status = b.offer ? 'linked' : 'new'; b.reason = null; }); commit(); clearSel(); toast(t('{n} batches restored', { n: ids.length })); render(); },
    batchCreateMany: () => {
      const bs = [...UI.drive.sel].map((id) => DB.batches.find((x) => x.id === id)).filter((b) => b.status === 'new');
      openModal(t('Create {n} demands', { n: bs.length }), `<p class="muted">${esc(t('One demand per batch, named "Product — batch". Shared fields below.'))}</p>
        ${field('VSLs', checks('vsls', activeOpts('vsl'), []), 'full')}${field(t('Mechanisms'), checks('mechanisms', activeOpts('mechanism'), []), 'full')}
        ${field(t('Manager'), `<select name="assignee" required>${options(mgrOpts(), '', t('Choose'))}</select>`)}${field(t('Deadline'), '<input type="date" name="deadline">')}`, (fd) => {
        const vs = fd.getAll('vsls'), ms = fd.getAll('mechanisms'), as = fd.get('assignee');
        if (!vs.length || !ms.length || !as) return mErr(t('Pick VSL, mechanism and manager.'));
        let total = 0;
        bs.forEach((b) => {
          const d = batchDefaults(b);
          const n = String(Math.max(0, ...DB.offers.map((x) => +x.number)) + 1).padStart(4, '0');
          const o = Object.assign({ id: uid('o'), number: n, created: now(), archived: null, source: null, description: '', notes: '', deadline: fd.get('deadline') ? fd.get('deadline') + 'T23:59:00' : null }, d, { vsls: vs, mechanisms: ms, assignee: as });
          DB.offers.push(o); log(o.id, 'offer_created', { name: o.name }); log(o.id, 'assigned', { to: as }); notify(as, o.id, 'assigned');
          total += linkBatch(b, o);
        });
        commit(); closeModal(); clearSel(); toast(t('{n} demands created · {a} ads in Test', { n: bs.length, a: total })); render();
      }, { wide: true, ok: t('Create demands') });
    },
    invite: () => openModal(t('Invite user'), `${field(t('Name'), '<input name="name" required>')}${field('Email', '<input name="email" type="email" required>')}${field(t('Role'), `<select name="role"><option value="gestor">${esc(t('Traffic manager'))}</option><option value="admin">${esc(t('Administrator'))}</option></select>`)}`, (fd) => {
      const name = (fd.get('name') || '').trim(), email = (fd.get('email') || '').trim();
      if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return mErr(t('Name and a valid email are required.'));
      if (DB.users.some((u) => u.email.toLowerCase() === email.toLowerCase())) return mErr(t('This email is already in the team.'));
      DB.users.push({ id: uid('u'), name, email, role: fd.get('role'), active: true, last: null }); commit(); closeModal(); toast(t('Invite sent to {e} (simulated)', { e: email })); render();
    }, { ok: t('Send invite') }),
    resend: (el) => toast(t('Invite resent to {e} (simulated)', { e: user(el.dataset.id).email })),
    toggleUser: (el) => { const u = user(el.dataset.id); if (u.id === UI.user) return; u.active = !u.active; commit(); toast(u.active ? t('{n} can sign in again', { n: u.name }) : t('{n} lost access', { n: u.name })); render(); },
    newMech: () => openModal(t('New mechanism'), field(t('Name'), '<input name="label" required>'), (fd) => {
      const l = (fd.get('label') || '').trim(); if (!l) return mErr(t('Give it a name.'));
      if (DB.catalog.some((c) => c.kind === 'mechanism' && c.label.toLowerCase() === l.toLowerCase())) return mErr(t('That mechanism already exists.'));
      DB.catalog.push({ id: uid('m'), kind: 'mechanism', label: l, active: true, sort: 99, src: 'app' }); commit(); closeModal(); toast(t('Mechanism created')); render();
    }),
    renameMech: (el) => { const c = cat(el.dataset.id); openModal(t('Rename mechanism'), field(t('Name'), `<input name="label" required value="${esc(c.label)}">`), (fd) => { const l = (fd.get('label') || '').trim(); if (!l) return mErr(t('Give it a name.')); c.label = l; commit(); closeModal(); render(); }); },
    toggleMech: (el) => { const c = cat(el.dataset.id); c.active = !c.active; commit(); render(); },
    newFolder: () => openModal(t('Add folder'), `${field(t('Folder link'), '<input name="link" type="url" required placeholder="https://drive.google.com/drive/folders/…">')}${field(t('Default product'), `<select name="product">${options(activeOpts('product'), '')}</select>`)}`, (fd) => {
      if (!/^https:\/\/drive\.google\.com\//.test(fd.get('link') || '')) return mErr(t('Paste a Google Drive folder link.'));
      const p = cat(fd.get('product'));
      DB.sources.push({ id: uid('s'), name: 'EDIÇÃO - ADS', path: 'ShippingCaps / ' + p.label + ' / EDIÇÃO - ADS', product: p.id, niche: p.niche, channel: 'c_meta', active: true, discovered: false, since: new Date().toISOString().slice(0, 10), lastScan: null, error: '' });
      commit(); closeModal(); toast(t('Folder added. It will be read in the next scan.')); render();
    }),
    toggleFolder: (el) => { const s = DB.sources.find((x) => x.id === el.dataset.id); s.active = !s.active; commit(); render(); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-a]');
    if (!el) {
      if ((UI.bellOpen || UI.menuOpen) && !e.target.closest('.pop')) { UI.bellOpen = UI.menuOpen = false; render(); }
      return;
    }
    const fn = A[el.dataset.a];
    if (fn) { e.preventDefault(); fn(el, e); }
  });
  let lastSel = null;
  document.addEventListener('change', (e) => {
    const el = e.target; const k = el.dataset.ch; if (!k) return;
    if (k === 'status') return changeStatus([el.dataset.id], el.value);
    if (k === 'filter') { const f = scopeF(el.dataset.scope); f[el.dataset.key] = el.type === 'checkbox' ? el.checked : el.value; UI.openMs = null; return render(); }
    if (k === 'multi') { const f = scopeF(el.dataset.scope); const key = el.dataset.key; f[key] = f[key] || []; f[key] = el.checked ? f[key].concat(el.value) : f[key].filter((v) => v !== el.value); UI.openMs = el.dataset.scope + key; return render(); }
    if (k === 'sel') {
      const S = { pipe: UI.pipe, rep: UI.rep, drive: UI.drive }[el.dataset.scope];
      const id = el.dataset.id;
      // o evento change não traz o shift; ele vem do último mousedown/keydown
      if (window.__shift && lastSel && el.dataset.scope !== 'drive') {
        const ids = [...document.querySelectorAll(`[data-ch="sel"][data-scope="${el.dataset.scope}"]`)].map((x) => x.dataset.id);
        const [i, j] = [ids.indexOf(lastSel), ids.indexOf(id)].sort((a, b) => a - b);
        if (i >= 0) ids.slice(i, j + 1).forEach((x) => (el.checked ? S.sel.add(x) : S.sel.delete(x)));
      } else el.checked ? S.sel.add(id) : S.sel.delete(id);
      lastSel = id; return render();
    }
    if (k === 'selAll') { const S = el.dataset.scope === 'rep' ? UI.rep : UI.pipe; document.querySelectorAll(`[data-ch="sel"][data-scope="${el.dataset.scope}"]`).forEach((x) => (el.checked ? S.sel.add(x.dataset.id) : S.sel.delete(x.dataset.id))); return render(); }
    if (k === 'role') { const u = user(el.dataset.id); u.role = el.value; commit(); toast(t('{n} is now {r}', { n: u.name, r: roleLabel(u.role) })); return render(); }
  });
  document.addEventListener('keydown', (e) => { window.__shift = e.shiftKey; });
  document.addEventListener('keyup', (e) => { window.__shift = e.shiftKey; });
  document.addEventListener('mousedown', (e) => { window.__shift = e.shiftKey; });
  let qTimer;
  document.addEventListener('input', (e) => {
    const el = e.target; if (el.dataset.in !== 'q') return;
    scopeF(el.dataset.scope).q = el.value;
    clearTimeout(qTimer); qTimer = setTimeout(render, 140);
  });
  document.addEventListener('toggle', (e) => {
    const d = e.target; if (!d.dataset || !d.dataset.ms) return;
    if (d.open) { UI.openMs = d.dataset.ms; document.querySelectorAll('details.ms[open]').forEach((x) => { if (x !== d) x.open = false; }); } else if (UI.openMs === d.dataset.ms) UI.openMs = null;
  }, true);
  document.addEventListener('submit', (e) => {
    const f = e.target; const k = f.dataset.form; if (!k) return;
    e.preventDefault();
    const fd = new FormData(f);
    if (k === 'modal' && modalSubmit) return modalSubmit(fd);
    if (k === 'comment') {
      const o = offer(f.dataset.id); const kind = fd.get('kind'); const body = (fd.get('body') || '').trim(); if (!body) return;
      DB.comments.push({ id: uid('c'), offer: o.id, parent: null, kind, body, sold: kind === 'report' ? fd.get('sold') : '', failed: kind === 'report' ? fd.get('failed') : '', next: kind === 'report' ? fd.get('next') : '', links: [], author: UI.user, at: now(), edited: null, test: fd.get('test') || null });
      log(o.id, kind === 'report' ? 'report_added' : 'comment_added');
      notify(o.assignee, o.id, kind === 'report' ? 'report' : 'comment'); DB.users.filter((u) => u.role === 'admin').forEach((u) => notify(u.id, o.id, kind === 'report' ? 'report' : 'comment'));
      commit(); toast(t('Posted')); return render();
    }
    if (k === 'reply') {
      const p = DB.comments.find((c) => c.id === f.dataset.id); const body = (fd.get('body') || '').trim(); if (!body) return;
      DB.comments.push({ id: uid('c'), offer: p.offer, parent: p.id, kind: 'update', body, sold: '', failed: '', next: '', links: [], author: UI.user, at: now(), edited: null });
      notify(p.author, p.offer, 'comment'); UI.replyTo = null; commit(); return render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k' && UI.user) { e.preventDefault(); palette(); }
    if (e.key === 'Escape') { if (modalRoot.classList.contains('on')) closeModal(); else if (UI.bellOpen || UI.menuOpen) { UI.bellOpen = UI.menuOpen = false; render(); } }
  });

  // arrastar e soltar entre colunas
  let dragId = null;
  document.addEventListener('dragstart', (e) => { const c = e.target.closest && e.target.closest('.card[data-ad]'); if (!c) return; dragId = c.dataset.ad; c.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (x) { /* ok */ } });
  document.addEventListener('dragend', () => { dragId = null; document.querySelectorAll('.drag,.over').forEach((x) => x.classList.remove('drag', 'over')); });
  document.addEventListener('dragover', (e) => { const col = e.target.closest && e.target.closest('[data-drop]'); if (!col || !dragId) return; e.preventDefault(); document.querySelectorAll('.over').forEach((x) => x !== col && x.classList.remove('over')); col.classList.add('over'); });
  document.addEventListener('drop', (e) => { const col = e.target.closest && e.target.closest('[data-drop]'); if (!col || !dragId) return; e.preventDefault(); const ids = UI.pipe.sel.has(dragId) ? [...UI.pipe.sel] : [dragId]; changeStatus(ids, col.dataset.drop); });

  render();
})();
