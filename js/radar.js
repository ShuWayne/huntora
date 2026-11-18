/* HUNTORA — radar.js
 * Animated canvas radar sweep. Blips are derived from real opportunity
 * data: angle from category hash, radius from probability (higher
 * probability = closer to centre), pulse when the sweep passes.
 * Pure 2D canvas — no dependency on Three.js.
 */

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function blipPosition(opp, index) {
  const h = hashStr(opp.id + opp.category);
  const angle = ((h % 360) / 360) * Math.PI * 2 + index * 0.7;
  // Higher probability sits closer to the centre (stronger signal).
  const r = 0.24 + (1 - opp.probability / 100) * 0.68 + ((h % 13) / 13) * 0.06;
  return { angle, r: Math.min(r, 0.94) };
}

export class Radar {
  constructor(canvas, opportunities, onSelect) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.opps = opportunities.filter(o => o.researched);
    this.onSelect = onSelect;
    this.angle = -Math.PI / 2;
    this.blips = this.opps.map((o, i) => ({ opp: o, ...blipPosition(o, i), lit: 0 }));
    this.running = false;
    this.raf = null;
    this.handleClick = this.handleClick.bind(this);
    canvas.addEventListener("click", this.handleClick);
    this.resize();
  }

  resize() {
    const size = this.canvas.width; // square canvas, CSS scales it
    this.cx = size / 2;
    this.cy = size / 2;
    this.R = size / 2 - 14;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const step = () => {
      if (!this.running) return;
      this.draw();
      this.raf = requestAnimationFrame(step);
    };
    step();
  }

  stop() {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  }

  draw() {
    const { ctx, cx, cy, R } = this;
    const size = this.canvas.width;
    ctx.clearRect(0, 0, size, size);

    // faint outer glow disc
    const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    disc.addColorStop(0, "rgba(34,211,238,0.05)");
    disc.addColorStop(0.85, "rgba(34,211,238,0.02)");
    disc.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = disc;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

    // rings + crosshair
    ctx.strokeStyle = "rgba(120,180,255,0.14)";
    ctx.lineWidth = 1;
    [0.25, 0.5, 0.75, 1].forEach(f => {
      ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, Math.PI * 2); ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    // sweep: leading edge + fading trail
    const sweepLen = Math.PI / 2.2;
    const grad = ctx.createConicGradient ? null : null;
    for (let i = 0; i < 46; i++) {
      const a = this.angle - (i / 46) * sweepLen;
      ctx.strokeStyle = `rgba(34,211,238,${0.55 * (1 - i / 46)})`;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(34,211,238,0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(this.angle) * R, cy + Math.sin(this.angle) * R);
    ctx.stroke();

    // blips
    for (const b of this.blips) {
      const x = cx + Math.cos(b.angle) * R * b.r;
      const y = cy + Math.sin(b.angle) * R * b.r;
      // light up when sweep passes
      let d = (this.angle - b.angle) % (Math.PI * 2);
      if (d < 0) d += Math.PI * 2;
      if (d < 0.35) b.lit = 1;
      b.lit = Math.max(0, b.lit - 0.008);
      const blocked = b.opp.status === "Blocked — legal";
      const col = blocked ? "248,113,113" : (b.opp.probability >= 60 ? "52,211,153" : "34,211,238");
      if (b.lit > 0.05) {
        ctx.beginPath(); ctx.arc(x, y, 4 + b.lit * 9, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${col},${b.lit * 0.55})`; ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},${0.55 + b.lit * 0.45})`; ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},0.9)`; ctx.lineWidth = 1; ctx.stroke();
    }

    // centre hub
    ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#22d3ee"; ctx.fill();

    this.angle += 0.011;
    if (this.angle > Math.PI * 2) this.angle -= Math.PI * 2;
  }

  handleClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (this.canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (this.canvas.height / rect.height);
    let best = null, bestD = 22;
    for (const b of this.blips) {
      const x = this.cx + Math.cos(b.angle) * this.R * b.r;
      const y = this.cy + Math.sin(b.angle) * this.R * b.r;
      const d = Math.hypot(px - x, py - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best && this.onSelect) this.onSelect(best.opp);
  }

  destroy() {
    this.stop();
    this.canvas.removeEventListener("click", this.handleClick);
  }
}
