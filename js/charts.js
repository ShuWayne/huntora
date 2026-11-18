/* HUNTORA — charts.js
 * Minimal dependency-free canvas charts (bar + horizontal bar).
 * Handles HiDPI, empty/zero data, and redraw on resize.
 */

function setupCanvas(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(rect.width, 200);
  const h = Math.max(rect.height, 120);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { ctx, w, h };
}

const PALETTE = ["#22d3ee", "#8b5cf6", "#34d399", "#fbbf24", "#60a5fa", "#f87171"];

export function drawBarChart(canvas, items) {
  // items: [{label, value, color?}] — vertical bars
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const padL = 8, padB = 26, padT = 14;
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = Math.min(54, (w - padL * 2) / items.length * 0.55);
  const gap = (w - padL * 2) / items.length;
  ctx.font = "11px Inter, system-ui, sans-serif";
  items.forEach((item, i) => {
    const x = padL + gap * i + (gap - bw) / 2;
    const bh = Math.max(item.value > 0 ? 4 : 0, ((h - padB - padT) * item.value) / max);
    const y = h - padB - bh;
    const grad = ctx.createLinearGradient(0, y, 0, h - padB);
    const col = item.color || PALETTE[i % PALETTE.length];
    grad.addColorStop(0, col);
    grad.addColorStop(1, col + "55");
    ctx.fillStyle = item.value > 0 ? grad : "rgba(255,255,255,0.06)";
    ctx.beginPath();
    ctx.roundRect(x, y, bw, Math.max(bh, item.value > 0 ? 4 : 2), [4, 4, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#e6edf7";
    ctx.textAlign = "center";
    ctx.fillText(item.value > 0 ? "$" + item.value : "$0", x + bw / 2, y - 5);
    ctx.fillStyle = "#8b98ad";
    const label = item.label.length > 12 ? item.label.slice(0, 11) + "…" : item.label;
    ctx.fillText(label, x + bw / 2, h - 9);
  });
}

export function drawHBarChart(canvas, items) {
  // items: [{label, value, color?}] — horizontal bars, best for stage values
  const { ctx, w, h } = setupCanvas(canvas);
  ctx.clearRect(0, 0, w, h);
  const rowH = Math.min(34, (h - 8) / items.length);
  const max = Math.max(...items.map(i => i.value), 1);
  ctx.font = "12px Inter, system-ui, sans-serif";
  items.forEach((item, i) => {
    const y = 6 + i * rowH;
    ctx.fillStyle = "#8b98ad";
    ctx.textAlign = "left";
    ctx.fillText(item.label, 2, y + rowH / 2 + 4);
    const barX = 108;
    const barW = w - barX - 64;
    const bw = Math.max(item.value > 0 ? 3 : 0, (barW * item.value) / max);
    ctx.fillStyle = "rgba(255,255,255,0.07)";
    ctx.beginPath(); ctx.roundRect(barX, y + 5, barW, rowH - 12, 4); ctx.fill();
    if (item.value > 0) {
      const col = item.color || PALETTE[i % PALETTE.length];
      const grad = ctx.createLinearGradient(barX, 0, barX + bw, 0);
      grad.addColorStop(0, col); grad.addColorStop(1, col + "88");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.roundRect(barX, y + 5, bw, rowH - 12, 4); ctx.fill();
    }
    ctx.fillStyle = "#e6edf7";
    ctx.textAlign = "right";
    ctx.fillText(item.value > 0 ? "$" + item.value : "$0", w - 4, y + rowH / 2 + 4);
  });
}
