/* Chuva de dinheiro do Painel: notas em 3D que giram, balançam com o vento e reagem ao mouse. */
(function () {
  'use strict';
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- sprites (desenhados uma vez só) ----
  const BILL_W = 240, BILL_H = 112;
  function bill(sym, value, c1, c2, ink) {
    const cv = document.createElement('canvas'); cv.width = BILL_W; cv.height = BILL_H;
    const g = cv.getContext('2d');
    const r = 10;
    const grad = g.createLinearGradient(0, 0, BILL_W, BILL_H); grad.addColorStop(0, c1); grad.addColorStop(1, c2);
    g.fillStyle = grad; g.beginPath(); g.roundRect(2, 2, BILL_W - 4, BILL_H - 4, r); g.fill();
    g.strokeStyle = ink; g.globalAlpha = .55; g.lineWidth = 2; g.beginPath(); g.roundRect(9, 9, BILL_W - 18, BILL_H - 18, 6); g.stroke();
    // guilhoché
    g.globalAlpha = .18; g.lineWidth = 1;
    for (let k = 0; k < 7; k++) { g.beginPath(); for (let x = 12; x <= BILL_W - 12; x += 4) { const y = 22 + k * 11 + Math.sin(x / 9 + k) * 3; x === 12 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
    // medalhão
    g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.42)'; g.beginPath(); g.ellipse(BILL_W / 2, BILL_H / 2, 34, 30, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.globalAlpha = .6; g.lineWidth = 1.5; g.stroke();
    g.globalAlpha = .9; g.fillStyle = ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 30px Georgia, serif'; g.fillText(sym, BILL_W / 2, BILL_H / 2 + 1);
    g.font = '700 17px Georgia, serif'; g.fillText(value, 30, 26); g.fillText(value, BILL_W - 30, BILL_H - 24);
    g.font = '600 9px Arial, sans-serif'; g.globalAlpha = .55; g.fillText('SHIPPINGCAPS', BILL_W / 2, BILL_H - 15);
    // brilho
    const sh = g.createLinearGradient(0, 0, BILL_W, 0); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.45, 'rgba(255,255,255,.28)'); sh.addColorStop(.55, 'rgba(255,255,255,0)');
    g.globalAlpha = 1; g.fillStyle = sh; g.beginPath(); g.roundRect(2, 2, BILL_W - 4, BILL_H - 4, r); g.fill();
    return cv;
  }
  function coin() {
    const S = 72; const cv = document.createElement('canvas'); cv.width = S; cv.height = S; const g = cv.getContext('2d');
    const gr = g.createRadialGradient(S * .38, S * .35, 4, S / 2, S / 2, S / 2); gr.addColorStop(0, '#fff3c4'); gr.addColorStop(.45, '#f0c96a'); gr.addColorStop(1, '#c4913a');
    g.fillStyle = gr; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(120,80,20,.55)'; g.lineWidth = 2; g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(110,72,18,.8)'; g.font = '700 26px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', S / 2, S / 2 + 1);
    return cv;
  }
  let SPR = null;
  const sprites = () => SPR || (SPR = {
    bills: [bill('R$', '100', '#d6f0dc', '#8fcfa3', '#2f6b46'), bill('R$', '50', '#f6e2cf', '#e6b98f', '#7a4a24'), bill('$', '100', '#e3ecd2', '#a9c98d', '#3f5f2c'), bill('R$', '200', '#dfdcf1', '#b3aad6', '#463d78')],
    coin: coin(),
  });

  // ---- partículas ----
  let parts = [], W = 0, H = 0, raf = 0, last = 0, wind = 0, windT = 0, mouse = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function make(x, y, burst) {
    const isCoin = Math.random() < 0.12;
    const z = rnd(0.35, 1.15);
    return {
      x: x == null ? rnd(-40, W + 40) : x, y: y == null ? rnd(-H, H) : y, z, isCoin,
      s: Math.floor(Math.random() * 4),
      vx: burst ? rnd(-260, 260) * z : 0, vy: burst ? rnd(-520, -180) * z : rnd(30, 70) * z,
      rot: rnd(0, Math.PI * 2), vr: rnd(-1.4, 1.4), flip: rnd(0, Math.PI * 2), vf: rnd(1.4, 3.4) * (Math.random() < .5 ? -1 : 1),
      sw: rnd(0.6, 1.6), ph: rnd(0, Math.PI * 2), life: burst ? 1 : 0,
    };
  }
  function seed() { const n = Math.round(Math.min(60, Math.max(26, W / 22))); parts = []; for (let i = 0; i < n; i++) parts.push(make()); }

  function step(dt, t) {
    windT += dt; wind += ((Math.sin(windT * .35) * 22) - wind) * Math.min(1, dt * .8);
    for (const p of parts) {
      // nota cai devagar (resistência do ar); a explosão do clique sobe rápido e volta com gravidade forte
      p.vy += (p.life ? 760 : 56) * p.z * dt; p.vy = Math.min(p.vy, (p.isCoin ? 150 : 85) * p.z);
      p.vx += ((wind * p.z) - p.vx) * dt * (p.life ? 0.6 : 1.2);
      if (mouse) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy; if (d2 < 140 * 140) { const f = (1 - Math.sqrt(d2) / 140) * 900 * dt; const d = Math.sqrt(d2) || 1; p.vx += dx / d * f; p.vy += dy / d * f * .6; p.vr += (dx > 0 ? 1 : -1) * f * .01; } }
      p.x += (p.vx + Math.sin(t * p.sw + p.ph) * 28 * p.z) * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt * (p.isCoin ? 0 : 1); p.vr *= 1 - dt * .15; p.flip += p.vf * dt;
      if (p.y > H + 90 || p.x < -160 || p.x > W + 160) { if (p.life) { p.dead = true; continue; } Object.assign(p, make(rnd(-40, W + 40), rnd(-160, -60))); }
    }
    parts = parts.filter((p) => !p.dead);
  }
  function draw(ctx) {
    ctx.clearRect(0, 0, W, H);
    const sp = sprites();
    parts.sort((a, b) => a.z - b.z);
    for (const p of parts) {
      const fl = Math.cos(p.flip); const sy = Math.max(0.06, Math.abs(fl));
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.globalAlpha = Math.min(1, 0.35 + p.z * 0.6);
      if (p.isCoin) {
        const sz = 30 * p.z; ctx.scale(Math.max(0.08, Math.abs(Math.cos(p.flip * 1.3))), 1);
        ctx.drawImage(sp.coin, -sz / 2, -sz / 2, sz, sz);
      } else {
        const w = 104 * p.z, h = w * BILL_H / BILL_W;
        ctx.rotate(p.rot); ctx.scale(1, sy);
        ctx.drawImage(sp.bills[p.s], -w / 2, -h / 2, w, h);
        if (fl < 0) { ctx.globalAlpha *= .28; ctx.fillStyle = '#1d2a22'; ctx.fillRect(-w / 2, -h / 2, w, h); } // verso mais escuro
      }
      ctx.restore();
    }
  }
  function frame(ts) {
    const cv = document.getElementById('money');
    if (!cv) { raf = 0; return; }
    const r = cv.getBoundingClientRect();
    // o Painel é redesenhado de tempos em tempos: canvas novo também precisa do tamanho certo
    if (Math.round(r.width) !== W || Math.round(r.height) !== H || cv.width !== Math.round(W * DPR)) {
      const first = !W; W = Math.round(r.width); H = Math.round(r.height);
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); if (first || !parts.length) seed();
    }
    const ctx = cv.getContext('2d'); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts;
    if (!reduce) step(dt, ts / 1000);
    draw(ctx);
    raf = reduce ? 0 : requestAnimationFrame(frame);
  }

  window.MoneyRain = {
    mount() {
      const cv = document.getElementById('money'); if (!cv) return;
      if (!cv.dataset.bound) {
        cv.dataset.bound = '1';
        const stage = cv.parentElement;
        stage.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
        stage.addEventListener('pointerleave', () => { mouse = null; });
        stage.addEventListener('click', (e) => { if (e.target.closest('a,button')) return; const r = cv.getBoundingClientRect(); window.MoneyRain.burst(e.clientX - r.left, e.clientY - r.top, 26); });
      }
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    },
    burst(x, y, n) {
      if (reduce) return;
      if (x == null) { x = W / 2; y = H * 0.55; }
      for (let i = 0; i < (n || 30); i++) parts.push(make(x + rnd(-20, 20), y + rnd(-10, 10), true));
      if (!raf) raf = requestAnimationFrame(frame);
    },
  };
})();
