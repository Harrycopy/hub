/* Dados de demonstração. Nada aqui vem do banco real do Hub. */
(function () {
  'use strict';
  window.SEED_VERSION = 3;

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  window.buildSeed = function () {
    const r = rng(20261029);
    const pick = (a) => a[Math.floor(r() * a.length)];
    const int = (a, b) => a + Math.floor(r() * (b - a + 1));
    const NOW = new Date('2026-10-29T15:00:00-03:00').getTime();
    const daysAgo = (d, h) => new Date(NOW - d * 864e5 - (h || 0) * 36e5).toISOString();
    let seq = 0;
    const uid = (p) => p + '_' + (++seq).toString(36);

    const users = [
      { id: 'u_admin', name: 'Edson Junior', email: 'edson@demo.local', role: 'admin', active: true, last: daysAgo(0, 1) },
      { id: 'u_harry', name: 'Harry', email: 'harry@demo.local', role: 'admin', active: true, last: daysAgo(0, 3) },
      { id: 'u_kevin', name: 'Kevin', email: 'kevin@demo.local', role: 'gestor', active: true, last: daysAgo(0, 2) },
      { id: 'u_joao', name: 'João Félix', email: 'joao@demo.local', role: 'gestor', active: true, last: daysAgo(1) },
      { id: 'u_matheus', name: 'Matheus Sales', email: 'matheus@demo.local', role: 'gestor', active: true, last: daysAgo(0, 5) },
      { id: 'u_akshit', name: 'Akshit', email: 'akshit@demo.local', role: 'gestor', active: true, last: null },
      { id: 'u_munish', name: 'Munish', email: 'munish@demo.local', role: 'gestor', active: true, last: null },
    ];
    const managers = ['u_kevin', 'u_joao', 'u_matheus'];

    const niches = [
      ['n_ed', 'Erectile dysfunction', 'Disfunção erétil'], ['n_hyp', 'Hypertension', 'Hipertensão'],
      ['n_dia', 'Diabetes', 'Diabetes'], ['n_neu', 'Neuropathy', 'Neuropatia'], ['n_mem', 'Memory', 'Memória'],
      ['n_lung', 'Lungs', 'Pulmão'], ['n_vis', 'Vision', 'Visão'], ['n_wl', 'Weight loss', 'Emagrecimento'],
    ].map(([id, en, pt], i) => ({ id, label: en, labelPt: pt, active: true, sort: i }));

    const PRODUCTS = [
      ['p_vard', 'Vardexil', 'VARAD', 'n_ed'], ['p_soda', 'SodaPril', 'SODAD', 'n_hyp'], ['p_glyc', 'GlycoNova', 'GLYAD', 'n_dia'],
      ['p_neur', 'NeuroFlex', 'NEUAD', 'n_neu'], ['p_memo', 'MemoClear', 'METAD', 'n_mem'], ['p_brea', 'BreathPure', 'BREAD', 'n_lung'],
      ['p_eyer', 'EyeRestore', 'EYEAD', 'n_vis'], ['p_slim', 'SlimBurn', 'SMBAD', 'n_wl'],
    ];
    const catalog = [];
    PRODUCTS.forEach(([id, label, prefix, niche], i) => catalog.push({ id, kind: 'product', label, prefix, niche, active: true, sort: i, src: 'clickup', synced: daysAgo(0, 6) }));
    ['1005', '1006', '1007', '1008', '1016', '1021', '1027', '1031'].forEach((n, i) => catalog.push({ id: 'v_' + n, kind: 'vsl', label: 'VSL' + n, active: n !== '1005', sort: i, src: 'clickup', synced: daysAgo(0, 6) }));
    ['Meta', 'YouTube', 'NewsBreak', 'TikTok', 'Taboola'].forEach((l, i) => catalog.push({ id: 'c_' + l.toLowerCase(), kind: 'channel', label: l, active: true, sort: i, src: 'clickup', synced: daysAgo(0, 6) }));
    ['Baking Soda', 'Gelatina', 'Mel', 'Brazilian Trick', 'Arterial Flush Ritual', 'The Horse Trick', 'Japanese Recipe', 'Golden Vitamin', 'Vick', 'Azeite', 'Cinnamon', 'Sal Rosa', 'Biblical Drink']
      .forEach((l, i) => catalog.push({ id: 'm_' + i, kind: 'mechanism', label: l, active: i !== 9, sort: i, src: i < 11 ? 'clickup' : 'app', synced: daysAgo(2) }));
    const vsls = catalog.filter((c) => c.kind === 'vsl' && c.active).map((c) => c.id);
    const channels = ['c_meta', 'c_meta', 'c_meta', 'c_youtube', 'c_newsbreak', 'c_tiktok'];
    const mechs = catalog.filter((c) => c.kind === 'mechanism' && c.active).map((c) => c.id);

    const REASONS = [
      'CPA 3x above target after R$ 900 spend',
      'Hook rate under 18%, no click intent',
      'Account flagged the creative on day 2',
      'CTR fine but landing drop-off, no sales in 4 days',
      'Lost the auction against our own VARAD ads',
      'Avatar lip sync broke on mobile, pulled',
    ];
    const W = [['test', 30], ['testing', 22], ['scaling', 12], ['validated', 8], ['rejected', 16], ['sold_nv', 7], ['sold_rej', 5]];
    const weighted = () => { let x = r() * 100; for (const [s, w] of W) { if ((x -= w) < 0) return s; } return 'test'; };

    const offers = [], ads = [], tests = [], comments = [], activity = [], notifications = [];
    const log = (offer, at, actor, action, d) => activity.push({ id: uid('l'), offer, at, actor, action, d: d || {} });

    const plan = [
      ['p_vard', 'Hook test · wife angle'], ['p_vard', 'Relaunch · doctor interview'], ['p_soda', 'Salt trick · podcast'],
      ['p_soda', 'Arterial flush · UGC'], ['p_glyc', 'Cinnamon · grandma recipe'], ['p_glyc', 'Japanese recipe · news'],
      ['p_neur', 'Feet burning · story'], ['p_memo', 'Keys in the fridge · UGC'], ['p_memo', 'Honey trick · interview'],
      ['p_brea', 'Morning cough · podcast'], ['p_eyer', 'Blurry menu · UGC'], ['p_slim', 'Gelatin trick · friends'],
      ['p_vard', 'Horse trick · contrarian'], ['p_glyc', 'Golden vitamin · pop quiz'],
    ];
    plan.forEach(([pid, title], i) => {
      const p = PRODUCTS.find((x) => x[0] === pid);
      const created = 21 - Math.floor(i * 1.4);
      const assignee = managers[i % 3];
      const o = {
        id: uid('o'), number: String(45 + i).padStart(4, '0'), name: p[1] + ' — ' + title,
        products: [pid], vsls: r() < 0.25 ? [pick(vsls), pick(vsls)].filter((v, k, a) => a.indexOf(v) === k) : [pick(vsls)],
        mechanisms: [pick(mechs)], channel: pick(channels), niche: p[3], assignee,
        drive: 'https://drive.google.com/drive/folders/demo-' + (45 + i),
        description: 'Batch of ' + p[1] + ' creatives for ' + title.split(' · ')[0].toLowerCase() + '. Run on cold traffic first, keep the winning hook.',
        notes: i % 3 === 0 ? 'Budget cap R$ 300/day per ad set during test.' : '',
        deadline: daysAgo(created - (i % 4 === 1 ? int(8, 12) : int(22, 34))), created: daysAgo(created, int(1, 9)), archived: i === 12 ? daysAgo(1) : null,
        source: null,
      };
      offers.push(o);
      log(o.id, o.created, 'u_admin', 'offer_created', { name: o.name });
      log(o.id, o.created, 'u_admin', 'assigned', { to: assignee });
      notifications.push({ id: uid('n'), user: assignee, at: o.created, offer: o.id, type: 'assigned', read: created > 3 });

      const n = int(5, 11), used = new Set();
      for (let k = 0; k < n; k++) {
        let name; do { name = p[2] + int(10, 64) + 'H' + int(1, 6); } while (used.has(name)); used.add(name);
        const st = i >= 12 && k > 2 ? 'test' : weighted();
        const changed = daysAgo(Math.max(0, created - int(1, created)), int(0, 20));
        const a = {
          id: uid('a'), offer: o.id, name, channel: o.channel, link: 'https://drive.google.com/file/d/demo' + seq + '/view',
          status: st, changed, reason: st === 'rejected' || st === 'sold_rej' ? pick(REASONS) : '', created: o.created,
          trashed: null, trashPrev: null, origin: null, targetVsl: null, targetProducts: null,
        };
        ads.push(a);
        if (st !== 'test') log(o.id, changed, assignee, 'ad_status', { ad: name, from: 'test', to: st });
        if (st !== 'test') {
          const nt = int(1, 3);
          for (let q = 0; q < nt; q++) {
            const spend = int(180, 2600) + r(); const imp = int(9000, 140000); const clk = Math.round(imp * (0.008 + r() * 0.025));
            const good = st === 'validated' || st === 'scaling' || (st === 'testing' && r() < 0.5) || st === 'sold_nv';
            const roas = good ? 1.3 + r() * 2.4 : 0.15 + r() * 0.8;
            const rev = Math.round(spend * roas);
            const conv = Math.max(0, Math.round(rev / int(147, 297)));
            const start = Math.max(0, created - 2 - q * 4);
            const done = !(st === 'testing' && q === nt - 1);
            tests.push({
              id: uid('t'), ad: a.id, offer: o.id, start: daysAgo(start).slice(0, 10), end: done ? daysAgo(Math.max(0, start - 3)).slice(0, 10) : null,
              spend: Math.round(spend * 100) / 100, impressions: imp, clicks: clk, conversions: conv, revenue: rev,
              cls: done ? (good ? 'effective' : 'not_effective') : null, notes: '', src: 'manual',
            });
          }
        }
      }
    });

    // relançamentos: dois anúncios validados ganham cópia em outra VSL
    ads.filter((a) => a.status === 'validated').slice(0, 2).forEach((src) => {
      const o = offers.find((x) => x.id === src.offer);
      const tv = vsls.find((v) => !o.vsls.includes(v));
      const a = Object.assign({}, src, { id: uid('a'), status: 'test', reason: '', changed: daysAgo(1), created: daysAgo(1), origin: src.id, targetVsl: tv, name: src.name + 'R' });
      ads.push(a);
      log(o.id, a.created, 'u_admin', 'relaunched', { ad: src.name, vsl: tv });
    });
    // lixeira
    const tr = ads.find((a) => a.status === 'testing');
    if (tr) { tr.trashPrev = tr.status; tr.trashed = daysAgo(2); }

    const bodies = [
      ['update', 'Pushed the top 3 hooks to a CBO, letting it spend until Friday.'],
      ['update', 'Two creatives got stuck in review, resubmitted with a new thumbnail.'],
      ['report', 'Wife angle carried the first 48h.', 'Hook H2 with the kitchen scene', 'Doctor voice-over felt slow on mobile', 'Cut the intro by 3s and relaunch H2 on VSL1016'],
      ['update', 'CPM jumped after midnight, pausing the night schedule.'],
      ['report', 'Strong CTR, weak CVR.', 'Pop quiz opener', 'Landing headline mismatch', 'Ask copy for a congruent headline'],
    ];
    offers.forEach((o, i) => {
      if (i % 2) return;
      const b = bodies[i % bodies.length];
      const c = { id: uid('c'), offer: o.id, parent: null, kind: b[0], body: b[1], sold: b[2] || '', failed: b[3] || '', next: b[4] || '', links: [], author: o.assignee, at: daysAgo(int(0, 5), int(1, 12)), edited: null };
      comments.push(c);
      log(o.id, c.at, c.author, c.kind === 'report' ? 'report_added' : 'comment_added', {});
      if (i % 4 === 0) comments.push({ id: uid('c'), offer: o.id, parent: c.id, kind: 'update', body: 'Nice. Keep the budget, I will send two more hooks tomorrow.', sold: '', failed: '', next: '', links: [], author: 'u_admin', at: c.at, edited: null });
    });

    ads.filter((a) => a.status !== 'test').slice(0, 14).forEach((a, k) => {
      const o = offers.find((x) => x.id === a.offer);
      notifications.push({ id: uid('n'), user: 'u_admin', at: a.changed, offer: o.id, type: 'status', d: { ad: a.name, to: a.status }, read: k > 4 });
    });
    notifications.push({ id: uid('n'), user: 'u_kevin', at: daysAgo(0, 2), offer: offers[0].id, type: 'drive_ads', d: { n: 4 }, read: false });
    notifications.push({ id: uid('n'), user: 'u_kevin', at: daysAgo(0, 6), offer: offers[3].id, type: 'comment', read: false });

    // Drive
    const sources = [], batches = [], files = [];
    PRODUCTS.forEach(([pid, label], i) => {
      const v = vsls[i % vsls.length];
      const s = { id: uid('s'), name: 'EDIÇÃO - ADS', path: 'ShippingCaps / ' + label + ' / ' + catalog.find((c) => c.id === v).label + ' / EDIÇÃO - ADS', product: pid, niche: PRODUCTS[i][3], channel: 'c_meta', active: i !== 7, discovered: i !== 3, since: '2026-10-08', lastScan: daysAgo(0, 0.15), error: i === 5 ? 'Rate limit on files.list, retried in next scan' : '' };
      sources.push(s);
    });
    const mkFiles = (b, prefix, nf) => { for (let q = 0; q < nf; q++) files.push({ id: uid('f'), batch: b.id, name: prefix + int(10, 70) + 'H' + int(1, 6) + '.mp4', size: int(8, 140) * 1048576, at: b.arrived, ad: null, removed: null }); };
    offers.forEach((o, i) => {
      const s = sources.find((x) => x.product === o.products[0]);
      const b = { id: uid('b'), source: s.id, name: 'LOTE ' + String((i % 4) + 1).padStart(2, '0') + ' - ' + o.created.slice(5, 10), status: 'linked', reason: null, offer: o.id, removed: null, arrived: o.created };
      batches.push(b);
      ads.filter((a) => a.offer === o.id && !a.origin).forEach((a) => files.push({ id: uid('f'), batch: b.id, name: a.name + '.mp4', size: int(8, 140) * 1048576, at: b.arrived, ad: a.id, removed: null }));
    });
    const extra = [[0, 'LOTE 05 - 10-28', 'new', null, 0], [2, 'LOTE 03 - 10-29', 'new', null, 0], [6, 'LOTE 01 - 10-27', 'new', null, 1], [4, 'LOTE 04 - 10-28', 'new', null, 0],
      [1, 'LOTE 00 - 10-02', 'ignored', 'before_cutoff', 27], [4, 'LOTE 00 - 09-30', 'ignored', 'before_cutoff', 29], [7, 'TESTE THUMBS', 'ignored', 'manual', 3]];
    extra.forEach(([si, name, status, reason, d]) => {
      const s = sources[si];
      const b = { id: uid('b'), source: s.id, name, status, reason, offer: null, removed: null, arrived: daysAgo(d, int(1, 10)) };
      batches.push(b); mkFiles(b, PRODUCTS[si][2], int(4, 9));
    });

    // ClickUp (Ads per offer)
    const STAGES = ['copy', 'editing', 'dev', 'traffic', 'approved'];
    const tasks = [];
    PRODUCTS.forEach(([pid, label], i) => {
      [0, 1].forEach((k) => {
        const v = catalog.find((c) => c.id === vsls[(i + k * 3) % vsls.length]);
        const editing = int(0, 46), copy = int(0, 18);
        tasks.push({ id: uid('k'), name: '[' + label.toUpperCase() + '] ' + v.label + (k ? ' · V2' : ''), stage: STAGES[(i + k * 2) % 5], mechanism: pick(mechs), editing, copy, folder: 'https://drive.google.com/drive/folders/demo-vsl-' + v.label });
      });
    });

    const integrations = ['Meta Ads', 'Google Ads', 'YouTube', 'TikTok', 'Kwai', 'Taboola', 'Outbrain', 'NewsBreak'].map((p) => ({ platform: p, status: 'off', last: null }));

    return { v: window.SEED_VERSION, users, niches, catalog, offers, ads, tests, comments, activity, notifications, sources, batches, files, tasks, integrations, scans: { auto: daysAgo(0, 0.12), manual: null } };
  };
})();
