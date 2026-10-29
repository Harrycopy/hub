/* Chuva de dólares do Painel: notas de US$ 100, 50 e 20 em 3D que giram, balançam com o vento e reagem ao mouse. */
(function () {
  'use strict';
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- sprites (desenhados uma vez só): notas de dólar US$ 100, 50 e 20, as maiores em circulação ----
  const BILL_W = 312, BILL_H = 132; // proporção da nota americana (156 x 66 mm)
  const DOLLARS = [
    { v: '100', words: 'ONE HUNDRED DOLLARS', base: ['#e2ead2', '#b3c59c'], tint: 'rgba(120,170,215,.18)', ink: '#24452f', ribbon: '#4f9ad6', shift: '#a6683a' },
    { v: '50', words: 'FIFTY DOLLARS', base: ['#e9e2dc', '#c1cab2'], tint: 'rgba(205,120,140,.16)', ink: '#2a3f35', ribbon: null, shift: '#2f6a52' },
    { v: '20', words: 'TWENTY DOLLARS', base: ['#e6ebd1', '#bbcaa2'], tint: 'rgba(230,160,110,.16)', ink: '#27432f', ribbon: null, shift: '#3d6b4a' },
  ];
  function bill(d) {
    const W = BILL_W, H = BILL_H;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    const base = g.createLinearGradient(0, 0, W, H); base.addColorStop(0, d.base[0]); base.addColorStop(1, d.base[1]);
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    // tinta de fundo colorida no meio (como nas notas novas)
    const tint = g.createRadialGradient(W * .5, H * .5, 4, W * .5, H * .5, W * .55); tint.addColorStop(0, d.tint); tint.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = tint; g.fillRect(0, 0, W, H);
    // guilhoché fino
    g.strokeStyle = d.ink; g.globalAlpha = .1; g.lineWidth = .8;
    for (let k = 0; k < 14; k++) { g.beginPath(); for (let x = 8; x <= W - 8; x += 3) { const y = 10 + k * 8.5 + Math.sin(x / 7 + k * .7) * 2.2; x === 8 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
    g.globalAlpha = 1;
    // molduras
    g.strokeStyle = d.ink; g.lineWidth = 2.2; g.strokeRect(5, 5, W - 10, H - 10);
    g.lineWidth = .8; g.globalAlpha = .7; g.strokeRect(10, 10, W - 20, H - 20); g.globalAlpha = 1;
    // faixa de segurança azul da nota de 100
    if (d.ribbon) { const rx = W * .6; const rb = g.createLinearGradient(rx, 0, rx + 10, 0); rb.addColorStop(0, d.ribbon); rb.addColorStop(.5, '#9fd0f3'); rb.addColorStop(1, d.ribbon); g.fillStyle = rb; g.globalAlpha = .85; g.fillRect(rx, 6, 10, H - 12); g.globalAlpha = 1; }
    // textos
    g.fillStyle = d.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '600 8.5px Georgia, serif'; g.fillText('FEDERAL RESERVE NOTE', W / 2, 19);
    g.font = '700 11px Georgia, serif'; g.fillText('THE UNITED STATES OF AMERICA', W / 2, 31);
    g.font = '700 10px Georgia, serif'; g.fillText(d.words, W / 2, H - 18);
    // medalhão central com o valor (sem retrato)
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(W / 2, H / 2 + 4, 36, 30, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = d.ink; g.lineWidth = 1.4; g.globalAlpha = .75; g.stroke();
    g.lineWidth = .6; g.beginPath(); g.ellipse(W / 2, H / 2 + 4, 31, 25, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1;
    g.fillStyle = d.ink; g.font = '700 26px Georgia, serif'; g.fillText(d.v, W / 2, H / 2 + 5);
    // numerais dos cantos
    g.font = '700 19px Georgia, serif';
    g.fillText(d.v, 30, 26); g.fillText(d.v, W - 30, 26); g.fillText(d.v, 30, H - 22);
    g.fillStyle = d.shift; g.font = '800 30px Georgia, serif'; g.fillText(d.v, W - 36, H - 26); // numeral que muda de cor
    // selos: Tesouro (verde) e Federal Reserve (escuro)
    g.fillStyle = '#2f6b47'; g.globalAlpha = .85; g.beginPath(); g.arc(W * .8, H / 2 + 2, 11, 0, Math.PI * 2); g.fill();
    g.globalAlpha = .7; g.fillStyle = '#1d2b24'; g.beginPath(); g.arc(W * .2, H / 2 + 2, 11, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = 1;
    g.beginPath(); g.arc(W * .8, H / 2 + 2, 7, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.arc(W * .2, H / 2 + 2, 7, 0, Math.PI * 2); g.stroke();
    // brilho de papel
    const sh = g.createLinearGradient(0, 0, W, H); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.42, 'rgba(255,255,255,.22)'); sh.addColorStop(.5, 'rgba(255,255,255,0)');
    g.fillStyle = sh; g.fillRect(0, 0, W, H);
    return cv;
  }
  let SPR = null;
  const sprites = () => SPR || (SPR = { bills: DOLLARS.map(bill) });

  // ---- partículas ----
  let parts = [], W = 0, H = 0, raf = 0, last = 0, wind = 0, windT = 0, mouse = null;
  const rnd = (a, b) => a + Math.random() * (b - a);
  function make(x, y, burst) {
    const z = rnd(0.35, 1.15);
    return {
      x: x == null ? rnd(-40, W + 40) : x, y: y == null ? rnd(-H, H) : y, z,
      s: Math.random() < 0.5 ? 0 : Math.random() < 0.6 ? 1 : 2, // mais notas de 100, depois 50 e 20
      vx: burst ? rnd(-260, 260) * z : 0, vy: burst ? rnd(-520, -180) * z : rnd(30, 70) * z,
      rot: rnd(0, Math.PI * 2), vr: rnd(-1.4, 1.4), flip: rnd(0, Math.PI * 2), vf: rnd(1.4, 3.4) * (Math.random() < .5 ? -1 : 1),
      sw: rnd(0.6, 1.6), ph: rnd(0, Math.PI * 2), life: burst ? 1 : 0,
    };
  }
  function seed() { const n = Math.round(Math.min(64, Math.max(24, (W * H) / 26000))); parts = []; for (let i = 0; i < n; i++) parts.push(make()); }

  function step(dt, t) {
    windT += dt; wind += ((Math.sin(windT * .35) * 22) - wind) * Math.min(1, dt * .8);
    for (const p of parts) {
      // nota cai devagar (resistência do ar); a explosão do clique sobe rápido e volta com gravidade forte
      p.vy += (p.life ? 760 : 56) * p.z * dt; p.vy = Math.min(p.vy, 85 * p.z);
      p.vx += ((wind * p.z) - p.vx) * dt * (p.life ? 0.6 : 1.2);
      if (mouse) { const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy; if (d2 < 140 * 140) { const f = (1 - Math.sqrt(d2) / 140) * 900 * dt; const d = Math.sqrt(d2) || 1; p.vx += dx / d * f; p.vy += dy / d * f * .6; p.vr += (dx > 0 ? 1 : -1) * f * .01; } }
      p.x += (p.vx + Math.sin(t * p.sw + p.ph) * 28 * p.z) * dt; p.y += p.vy * dt;
      p.rot += p.vr * dt; p.vr *= 1 - dt * .15; p.flip += p.vf * dt;
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
      ctx.globalAlpha = Math.min(0.82, 0.22 + p.z * 0.6); // de fundo: nota mais transparente para não brigar com o texto
      const w = 118 * p.z, h = w * BILL_H / BILL_W;
      ctx.rotate(p.rot); ctx.scale(1, sy);
      ctx.drawImage(sp.bills[p.s], -w / 2, -h / 2, w, h);
      if (fl < 0) { ctx.globalAlpha *= .28; ctx.fillStyle = '#20301f'; ctx.fillRect(-w / 2, -h / 2, w, h); } // verso mais escuro
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
    sprites: () => sprites().bills, // usado só para conferir o desenho das notas
    mount() {
      const cv = document.getElementById('money'); if (!cv) return;
      if (!window.__moneyBound) {
        // fundo da página inteira: o mouse sopra as notas e o clique em área vazia faz chover
        window.__moneyBound = true;
        window.addEventListener('pointermove', (e) => { if (document.getElementById('money')) mouse = { x: e.clientX, y: e.clientY }; }, { passive: true });
        document.addEventListener('pointerleave', () => { mouse = null; });
        document.addEventListener('click', (e) => {
          if (!document.getElementById('money') || e.target.closest('a,button,input,select,textarea,label,.pcard,.pl,.top,.pop,.modal-root')) return;
          window.MoneyRain.burst(e.clientX, e.clientY, 22);
        });
      }
      if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
    },
    burst(x, y, n) {
      if (reduce) return;
      if (x == null) { x = W / 2; y = H * 0.45; }
      for (let i = 0; i < (n || 30); i++) parts.push(make(x + rnd(-20, 20), y + rnd(-10, 10), true));
      if (!raf) raf = requestAnimationFrame(frame);
    },
  };
})();
