/* Ligação com o banco real do Hub (Supabase). Mesmo login, mesmas regras de acesso (RLS) do Hub do Lovable. */
(function () {
  'use strict';
  const URL_ = 'https://civneanjtpkyuhqfppay.supabase.co';
  const KEY = 'sb_publishable_ZlwVn4d7_F67LO2JcwF2qA_K_KtDrrA';
  window.HUB_URL = 'https://traffic-status-hub.lovable.app';
  if (!window.supabase || !window.supabase.createClient) return;
  // link de "definir senha" do e-mail: lido antes do cliente, que apaga o endereço ao entrar
  const AUTH_HASH = new URLSearchParams(location.hash.replace(/^#/, ''));
  const RECOVERY = /^(recovery|invite)$/.test(AUTH_HASH.get('type') || '');
  const LINK_ERROR = AUTH_HASH.get('error_code') || AUTH_HASH.get('error') || '';
  const SITE = location.origin + location.pathname;
  const sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'traffic-hub-claude-auth' } });

  const ST_IN = { aprovados: 'test', testando: 'testing', escalando: 'scaling', validado: 'validated', rejeitados: 'rejected', vendeu_nao_validou: 'sold_nv', vendeu_rejeitado: 'sold_rej' };
  const ST_OUT = Object.fromEntries(Object.entries(ST_IN).map(([k, v]) => [v, k]));
  const KIND_IN = { produto: 'product', vsl: 'vsl', canal: 'channel', mecanismo: 'mechanism' };
  const BATCH_IN = { novo: 'new', vinculado: 'linked', ignorado: 'ignored' };
  const REASON_IN = { anterior_ao_corte: 'before_cutoff', manual: 'manual' };

  async function all(make) {
    const rows = [];
    for (let from = 0; ; from += 500) {
      const r = await make().range(from, from + 499);
      if (r.error) throw r.error;
      const page = r.data || [];
      rows.push(...page);
      if (page.length < 500) return rows;
    }
  }
  function visibleDriveError(v) {
    if (!v) return '';
    for (const p of ['__drive_scan_lease__:', '__drive_scan_state__:']) {
      if (v.startsWith(p)) { try { const o = JSON.parse(v.slice(p.length)); return p.includes('lease') ? visibleDriveError(o.previous || '') : (o.error || ''); } catch (e) { return ''; } }
    }
    return v;
  }
  const must = (r) => { if (r.error) throw r.error; return r.data; };

  // ---- Ads por oferta: a mesma conta do Hub (ads-by-offer.ts), em cima da foto que o robô do Hub salva a cada 10 min ----
  const norm = (v) => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/\s+/g, ' ');
  const idKey = (v) => norm(v).replace(/\s+/g, '');
  const offerKey = (product, vsl) => idKey(product) + '/' + idKey(vsl);
  function sourcePathKey(path) { const p = String(path || '').split('/').map((x) => x.trim()).filter(Boolean); return p.length >= 3 ? offerKey(p[p.length - 3], p[p.length - 2]) : null; }
  function taskIdentity(name) {
    const parts = [...String(name).matchAll(/\[([^\]]+)\]/g)].map((m) => (m[1] || '').trim());
    const vsl = parts.find((x) => /^VSL\s*\d+$/i.test(x));
    return parts[0] && vsl ? idKey(parts[0]) + '/' + idKey(vsl) : null;
  }
  const adNameKey = (name) => String(name).replace(/\.[A-Za-z0-9]{2,5}$/, '').replace(/\s+/g, '').toLowerCase();
  function copyAdKeys(names) {
    const keys = new Set();
    for (const name of names) {
      const key = adNameKey(name); const range = key.match(/^([a-z]+ad)(\d+)-(\d+)$/i);
      if (range) { const from = Number(range[2]), to = Number(range[3]); if (to < from || to - from > 1000) continue; for (let n = from; n <= to; n++) keys.add(range[1] + n); }
      else if (/^[a-z]+ad\d+(?:h\d+)?$/i.test(key)) keys.add(key);
    }
    return [...keys];
  }
  function adHookKey(name) { const key = adNameKey(name); const m = key.match(/^([a-z]+ad)0*(\d+)(?:h0*(\d+))?/); return m ? m[1] + m[2] + (m[3] ? 'h' + m[3] : '') : key; }
  function splitOfferAds(editedNames, copyKeys) {
    const edited = new Set(editedNames.map(adHookKey)); const ed = [...edited];
    const pending = new Set(copyKeys.filter((k) => !edited.has(k) && !(!/h\d+$/.test(k) && ed.some((v) => v.startsWith(k + 'h')))));
    return { editing: edited.size, copy: pending.size };
  }
  const STAGE_IN = { copywriter: 'copy', edicao: 'editing', dev: 'dev', trafego: 'traffic' };
  const offerStage = (status) => { const s = norm(status); return /^aprovad[ao]s?$/.test(s) ? 'approved' : STAGE_IN[s] || null; };
  const STAGE_ORDER = ['copy', 'editing', 'dev', 'traffic', 'approved'];
  const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });
  function offerAdsRows(snap, sources, batches, files) {
    if (!snap || !snap.clickup) return null;
    const keyBySource = new Map(sources.filter((s) => s.active).map((s) => [s.id, sourcePathKey(s.drive_path)]));
    const keyByBatch = new Map(batches.filter((b) => !b.removed_at).map((b) => [b.id, keyBySource.get(b.source_id) || null]));
    const edited = new Map();
    for (const f of files) {
      if (f.removed_at || !String(f.mime_type || '').startsWith('video/')) continue;
      const key = keyByBatch.get(f.batch_id); if (!key) continue;
      if (!edited.has(key)) edited.set(key, []); edited.get(key).push(f.name);
    }
    const copy = snap.copy, copyNames = copy ? new Map() : null;
    if (copy) {
      const keyByFolder = new Map((copy.folders || []).map((f) => [f.id, f.key]));
      for (const d of copy.docs || []) {
        const key = keyByFolder.get(d.parent); if (!key) continue;
        const keys = copy.hooksReady && d.hooks ? d.hooks : copyAdKeys([d.name]);
        if (!copyNames.has(key)) copyNames.set(key, []); copyNames.get(key).push(...keys);
      }
    }
    const vsls = (copy && copy.vsls) || {};
    const rows = (snap.clickup.tasks || []).flatMap((t) => {
      const stage = offerStage(t.status); if (t.parent || !stage) return [];
      const key = taskIdentity(t.name);
      const folder = key && vsls[key] ? 'https://drive.google.com/drive/folders/' + vsls[key] : null;
      const split = !copyNames ? { editing: null, copy: null } : key ? splitOfferAds(edited.get(key) || [], copyNames.get(key) || []) : { editing: 0, copy: 0 };
      return [{ id: t.id, name: t.name, stage, mechName: t.mechanism || '', mechanism: null, editing: split.editing, copy: split.copy, folder }];
    });
    rows.sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || collator.compare(a.name, b.name));
    return { rows, updatedAt: copy ? copy.updatedAt || null : null, counting: !copy };
  }

  // função do banco que ainda não foi criada: o site manda para o Hub antigo em vez de quebrar
  const NEEDS_HUB = 'needs-hub';
  async function rpc(name, args) {
    const r = await sb.rpc(name, args || {});
    if (r.error) { if (r.error.code === 'PGRST202' || /Could not find the function/i.test(r.error.message || '')) { const e = new Error(NEEDS_HUB); e.code = NEEDS_HUB; throw e; } throw r.error; }
    return r.data;
  }

  const L = {
    sb,
    offerAdsRows,
    NEEDS_HUB,
    recovery: RECOVERY,
    linkError: LINK_ERROR,
    // ---- usuários e senha (antes só no servidor do Hub) ----
    async sendPasswordLink(email) { const r = await sb.auth.resetPasswordForEmail(String(email).trim().toLowerCase(), { redirectTo: SITE }); if (r.error) throw r.error; },
    async setPassword(pw) { const r = await sb.auth.updateUser({ password: pw }); if (r.error) throw r.error; L.recovery = false; },
    async invite(email, name, role) { await rpc('admin_invite_user', { _email: email, _full_name: name, _role: role }); await L.sendPasswordLink(email); },
    async setRole(id, role) { await rpc('admin_set_user_role', { _user_id: id, _role: role }); },
    async setActive(id, active) { await rpc('admin_set_user_active', { _user_id: id, _active: active }); },
    async scanNow() { return rpc('drive_scan_now'); },
    session: null,
    me: null, // { id, role, active, name, email }
    async getSession() { const r = await sb.auth.getSession(); L.session = r.data.session; return L.session; },
    async signIn(email, password) { const r = await sb.auth.signInWithPassword({ email, password }); if (r.error) throw r.error; L.session = r.data.session; return r.data.session; },
    async signOut() { try { await sb.auth.signOut(); } catch (e) { /* sessão já caiu */ } L.session = null; L.me = null; },

    async identity() {
      const u = L.session && L.session.user; if (!u) return null;
      const [p, r] = await Promise.all([sb.from('profiles').select('*').eq('id', u.id).maybeSingle(), sb.rpc('my_role')]);
      if (p.error) throw p.error; if (r.error) throw r.error;
      L.me = { id: u.id, role: r.data, active: !!(p.data && p.data.active), name: (p.data && p.data.full_name) || u.email, email: u.email };
      return L.me;
    },

    async load() {
      const admin = L.me.role === 'admin';
      const [offers, niches, profiles, ads, tests, roles, catalog, ov, op, om, notifs] = await Promise.all([
        all(() => sb.from('offers').select('*').order('created_at', { ascending: false }).order('id')),
        all(() => sb.from('niches').select('*').order('sort_order').order('id')),
        all(() => sb.from('profiles').select('*').order('full_name').order('id')),
        all(() => sb.from('ads').select('*').order('id')),
        all(() => sb.from('ad_tests').select('*').order('id')),
        admin ? all(() => sb.from('user_roles').select('user_id,role').order('user_id')) : Promise.resolve([]),
        all(() => sb.from('catalog_options').select('*').order('kind').order('sort_order').order('id')),
        all(() => sb.from('offer_vsls').select('*').order('offer_id').order('vsl_id')),
        all(() => sb.from('offer_products').select('*').order('offer_id').order('product_id')),
        all(() => sb.from('offer_mechanisms').select('*').order('offer_id').order('mechanism_id')),
        sb.from('notifications').select('*').eq('user_id', L.me.id).order('created_at', { ascending: false }).limit(50).then(must),
      ]);
      let sources = [], batches = [], files = [], integrations = [], snap = null;
      if (admin) {
        [sources, batches, integrations, snap] = await Promise.all([
          all(() => sb.from('drive_sources').select('*').order('name').order('id')),
          all(() => sb.from('drive_batches').select('*').order('first_seen_at', { ascending: false }).order('id')),
          sb.from('platform_integrations').select('*').then((r) => (r.error ? [] : r.data || [])),
          // foto do ClickUp e dos docs COPY ADS; sem a função no banco, a página avisa em vez de quebrar
          sb.rpc('offer_ads_snapshot').then((r) => (r.error ? null : r.data || null)),
        ]);
        // lotes menores e poucos de cada vez: endereço curto e sem estourar o limite do servidor; tenta de novo se falhar
        const ids = batches.map((b) => b.id);
        const chunks = [];
        for (let i = 0; i < ids.length; i += 50) chunks.push(ids.slice(i, i + 50));
        const readChunk = async (c) => {
          for (let tries = 0; ; tries++) {
            try { return await all(() => sb.from('drive_files').select('id,batch_id,file_id,name,mime_type,size_bytes,drive_created_at,ad_id,removed_at').in('batch_id', c).order('name').order('id')); }
            catch (e) { if (tries >= 2) throw e; await new Promise((r) => setTimeout(r, 600 * (tries + 1))); }
          }
        };
        for (let i = 0; i < chunks.length; i += 3) {
          const part = await Promise.all(chunks.slice(i, i + 3).map(readChunk));
          part.forEach((p) => files.push(...p));
        }
      }
      const group = (rows, key, val) => { const m = new Map(); rows.forEach((r) => { if (!m.has(r[key])) m.set(r[key], []); m.get(r[key]).push(r[val]); }); return m; };
      const gv = group(ov, 'offer_id', 'vsl_id'), gp = group(op, 'offer_id', 'product_id'), gm = group(om, 'offer_id', 'mechanism_id');
      const firstFirst = (main, list) => { const l = (list || []).slice(); if (main && !l.includes(main)) l.unshift(main); else if (main) { l.splice(l.indexOf(main), 1); l.unshift(main); } return l; };
      const roleOf = new Map(roles.map((r) => [r.user_id, r.role]));
      const apo = admin ? offerAdsRows(snap, sources, batches, files) : null;
      return {
        v: 'live',
        users: profiles.map((p) => ({ id: p.id, name: p.full_name || p.email, email: p.email, role: roleOf.get(p.id) || (p.id === L.me.id ? L.me.role : (admin ? null : 'gestor')), active: p.active, last: null })),
        niches: niches.map((n) => ({ id: n.id, label: n.name, labelPt: n.name, active: n.active, sort: n.sort_order })),
        catalog: catalog.map((c) => ({ id: c.id, kind: KIND_IN[c.kind] || c.kind, label: c.label, active: c.active, sort: c.sort_order, src: c.clickup_option_id ? 'clickup' : 'app', synced: c.synced_at })),
        offers: offers.map((o) => ({
          id: o.id, number: o.offer_number, name: o.name, products: firstFirst(o.product_id, gp.get(o.id)), vsls: firstFirst(o.vsl_id, gv.get(o.id)), mechanisms: firstFirst(o.mechanism_id, gm.get(o.id)),
          channel: o.channel_id, niche: o.niche_id, assignee: o.assignee_id, drive: o.drive_link, description: o.description || '', notes: o.notes || '',
          deadline: o.deadline, created: o.created_at, archived: o.archived_at, source: null,
        })),
        ads: ads.map((a) => ({
          id: a.id, offer: a.offer_id, name: a.name, channel: a.channel_id, link: a.link || '', status: ST_IN[a.status] || 'test', changed: a.status_changed_at,
          reason: a.rejection_reason || '', created: a.created_at, trashed: a.trashed_at, trashPrev: null, origin: a.source_ad_id, targetVsl: a.target_vsl_id,
          targetProducts: a.target_product_ids && a.target_product_ids.length ? a.target_product_ids : null, sourceLabels: a.source_vsl_labels || null, platformId: a.platform_ad_id,
        })),
        tests: tests.map((x) => ({
          id: x.id, ad: x.ad_id, offer: x.offer_id, start: x.start_date, end: x.end_date, spend: x.spend, impressions: x.impressions, clicks: x.clicks, conversions: x.conversions,
          revenue: x.revenue, cls: x.classification === 'assertivo' ? 'effective' : x.classification === 'nao_assertivo' ? 'not_effective' : null, notes: x.notes || '', src: x.source === 'integracao' ? 'integration' : 'manual',
        })),
        comments: [], activity: [],
        notifications: notifs.map((n) => ({ id: n.id, user: n.user_id, at: n.created_at, offer: n.offer_id, type: n.type, title: n.title, body: n.body, read: !!n.read_at })),
        sources: sources.map((s) => ({ id: s.id, name: s.name, path: s.drive_path || '', folder: s.folder_id, product: s.product_id, niche: s.niche_id, channel: s.channel_id, active: s.active, discovered: s.discovered, since: s.track_since, lastScan: s.last_scan_at, error: visibleDriveError(s.last_error) })),
        batches: batches.map((b) => ({ id: b.id, source: b.source_id, folder: b.folder_id, name: b.name, status: BATCH_IN[b.status] || b.status, reason: REASON_IN[b.ignored_reason] || null, offer: b.offer_id, removed: b.removed_at, arrived: b.first_seen_at })),
        files: files.map((f) => ({ id: f.id, batch: f.batch_id, fileId: f.file_id, name: f.name, mime: f.mime_type || '', size: f.size_bytes || 0, at: f.drive_created_at, ad: f.ad_id, removed: f.removed_at })),
        tasks: apo ? apo.rows : [],
        adsState: apo ? { updatedAt: apo.updatedAt, counting: apo.counting } : null,
        integrations: integrations.map((x) => ({ platform: x.platform, status: x.status, last: x.last_sync_at })),
        scans: { auto: sources.reduce((m, s) => (s.last_scan_at && (!m || s.last_scan_at > m) ? s.last_scan_at : m), null), manual: null },
      };
    },

    async offerExtras(offerId) {
      const [c, a] = await Promise.all([
        all(() => sb.from('comments').select('*').eq('offer_id', offerId).order('created_at').order('id')),
        all(() => sb.from('activity_log').select('*').eq('offer_id', offerId).order('created_at', { ascending: false }).order('id')),
      ]);
      return {
        comments: c.map((x) => ({ id: x.id, offer: x.offer_id, parent: x.parent_id, kind: x.kind === 'relatorio' ? 'report' : 'update', body: x.body || '', sold: x.what_sold || '', failed: x.what_failed || '', next: x.next_step || '', links: x.links || [], author: x.author_id, at: x.created_at, edited: x.edited_at, test: x.test_id })),
        activity: a.map((x) => ({ id: x.id, offer: x.offer_id, at: x.created_at, actor: x.actor_id, action: x.action, from: ST_IN[x.from_status] || null, to: ST_IN[x.to_status] || null, d: x.details && typeof x.details === 'object' && !Array.isArray(x.details) ? x.details : {} })),
      };
    },

    // ---- gravações (as mesmas que o Hub faz) ----
    async setStatus(ids, st, reason) {
      const payload = { status: ST_OUT[st] };
      if (reason !== undefined && reason !== null && reason !== '') payload.rejection_reason = String(reason).trim();
      const write = (list) => sb.from('ads').update(payload).in('id', list).select('id');
      let r = await write(ids); const ok = new Set();
      if (r.error) {
        if (r.error.code !== '42501') throw r.error;
        for (const id of ids) { const s = await write([id]); if (s.error && s.error.code !== '42501') throw s.error; (s.data || []).forEach((x) => ok.add(x.id)); }
      } else (r.data || []).forEach((x) => ok.add(x.id));
      return { missing: ids.filter((id) => !ok.has(id)).length };
    },
    async setReason(id, reason) { must(await sb.from('ads').update({ rejection_reason: reason.trim() }).eq('id', id).select('id').single()); },
    async trash(ids, on) { const r = must(await sb.from('ads').update({ trashed_at: on ? new Date().toISOString() : null }).in('id', ids).select('id')); return { missing: ids.length - r.length }; },
    async remove(ids) { const r = must(await sb.from('ads').delete().in('id', ids).select('id')); return { missing: ids.length - r.length }; },
    async archive(id, on) { must(await sb.from('offers').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', id).select('id').single()); },
    async saveOffer(offerId, d) {
      const payload = { product_id: d.products[0], product_ids: d.products, mechanism_ids: d.mechanisms, channel_id: d.channel, drive_link: d.drive, name: d.name, niche_id: d.niche, assignee_id: d.assignee, description: d.description || null, deadline: d.deadline ? String(d.deadline).slice(0, 10) : null, notes: d.notes || null };
      const r = await sb.rpc('save_offer_with_vsls', { _offer_id: offerId, _payload: payload, _vsl_ids: [...new Set(d.vsls)] });
      if (r.error) throw r.error;
      const saved = r.data && r.data[0]; if (!saved) throw new Error('Could not save the demand');
      return { id: saved.id, number: saved.offer_number };
    },
    async relaunch(adIds, vslIds, productId, assigneeId) {
      const args = { _ad_ids: [...new Set(adIds)], _vsl_ids: [...new Set(vslIds)], _request_id: crypto.randomUUID() };
      if (productId) args._product_ids = [productId];
      if (assigneeId) args._assignee_id = assigneeId;
      return must(await sb.rpc('relaunch_ads', args));
    },
    // mesmos campos que o import_batch_files do banco grava (canal fica com o padrão do banco)
    async insertAds(offerId, rows) { if (!rows.length) return []; return must(await sb.from('ads').insert(rows.map((r) => ({ offer_id: offerId, name: r.name, link: r.link, platform_ad_id: null }))).select('id')); },
    async insertAd(offerId, name, channel, link) { must(await sb.from('ads').insert({ offer_id: offerId, name, channel_id: channel, platform_ad_id: null, link: link || null }).select('id').single()); },
    async insertTest(x) {
      must(await sb.from('ad_tests').insert({ ad_id: x.ad, offer_id: x.offer, start_date: x.start, end_date: x.end, spend: x.spend, revenue: x.revenue, impressions: x.impressions, clicks: x.clicks, conversions: x.conversions, classification: x.cls === 'effective' ? 'assertivo' : x.cls === 'not_effective' ? 'nao_assertivo' : null, notes: x.notes || null }).select('id').single());
    },
    async updateAd(id, a) { must(await sb.from('ads').update({ name: a.name, channel_id: a.channel, platform_ad_id: a.platformId || null, link: a.link || null }).eq('id', id).select('id').single()); },
    testPayload(x) { return { start_date: x.start, end_date: x.end, spend: x.spend, revenue: x.revenue, impressions: x.impressions, clicks: x.clicks, conversions: x.conversions, classification: x.cls === 'effective' ? 'assertivo' : x.cls === 'not_effective' ? 'nao_assertivo' : null, notes: x.notes || null }; },
    async updateTest(id, x) { must(await sb.from('ad_tests').update(L.testPayload(x)).eq('id', id).select('id').single()); },
    async updateComment(id, c) { must(await sb.from('comments').update({ body: c.body, what_sold: c.kind === 'report' ? c.sold || null : null, what_failed: c.kind === 'report' ? c.failed || null : null, next_step: c.kind === 'report' ? c.next || null : null, links: c.links || [] }).eq('id', id).select('id').single()); },
    async linkFiles(offerId, fileIds) { return must(await sb.rpc('link_drive_files', { _offer_id: offerId, _file_ids: fileIds })); },
    async deleteTest(id) { must(await sb.from('ad_tests').delete().eq('id', id).select('id')); },
    async insertComment(c) {
      must(await sb.from('comments').insert({ offer_id: c.offer, kind: c.kind === 'report' ? 'relatorio' : 'acompanhamento', body: c.body, what_sold: c.kind === 'report' ? c.sold || null : null, what_failed: c.kind === 'report' ? c.failed || null : null, next_step: c.kind === 'report' ? c.next || null : null, links: c.links || [], test_id: c.test || null, parent_id: c.parent || null }).select('id').single());
    },
    async readNotifications(id) { let q = sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', L.me.id).is('read_at', null); if (id) q = q.eq('id', id); must(await q); },
    async linkBatch(batchId, offerId) { return must(await sb.rpc('link_drive_batch', { _batch_id: batchId, _offer_id: offerId })); },
    async ignoreBatches(ids) { const r = must(await sb.from('drive_batches').update({ status: 'ignorado', ignored_reason: 'manual' }).in('id', ids).eq('status', 'novo').is('offer_id', null).is('removed_at', null).select('id')); return { missing: ids.length - r.length }; },
    async restoreBatches(ids) { const r = must(await sb.from('drive_batches').update({ status: 'novo' }).in('id', ids).eq('status', 'ignorado').select('id')); return { missing: ids.length - r.length }; },
    async insertMech(label, sort) { must(await sb.from('catalog_options').insert({ kind: 'mecanismo', label, sort_order: sort, active: true }).select('id').single()); },
    async updateMech(id, values) { must(await sb.from('catalog_options').update(values).eq('id', id).eq('kind', 'mecanismo').select('id').single()); },
    async insertSource(s) { must(await sb.from('drive_sources').insert(s).select('id').single()); },
    async updateSource(id, values) { must(await sb.from('drive_sources').update(values).eq('id', id).select('id').single()); },

    // tempo real: uma recarga só por rajada de mudanças
    listen(onChange) {
      const tables = ['offers', 'ads', 'ad_tests', 'comments', 'activity_log', 'notifications', 'niches', 'catalog_options', 'drive_sources', 'drive_batches', 'drive_files'];
      let ch = sb.channel('traffic-hub-' + L.me.id);
      tables.forEach((table) => { ch = ch.on('postgres_changes', Object.assign({ event: '*', schema: 'public', table }, table === 'notifications' ? { filter: 'user_id=eq.' + L.me.id } : {}), () => onChange(table)); });
      ch.subscribe();
      return () => sb.removeChannel(ch);
    },
  };
  window.HubLive = L;
})();
