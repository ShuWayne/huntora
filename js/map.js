/* HUNTORA — map.js
 * Stylised SVG world map (abstract continent shapes, 2050 aesthetic)
 * with pulsing region markers. Markers are placed by region, not exact
 * coordinates; counts are real researched-prospect counts.
 */

const CONTINENTS = [
  // North America
  "M8,14 L14,8 L24,6 L30,10 L27,16 L22,20 L18,26 L14,24 L10,20 Z",
  // South America
  "M22,34 L27,33 L30,38 L27,46 L24,44 L21,38 Z",
  // Europe
  "M46,12 L53,8 L58,11 L55,16 L49,17 L45,15 Z",
  // Africa
  "M48,24 L56,22 L61,27 L59,36 L54,40 L50,33 L47,28 Z",
  // Asia
  "M62,8 L78,6 L90,10 L92,18 L84,24 L74,26 L66,20 L60,14 Z",
  // Australia
  "M82,44 L90,42 L94,46 L90,50 L83,49 Z",
];

export function renderMap(svg, regions, onSelect) {
  const NS = "http://www.w3.org/2000/svg";
  svg.innerHTML = "";

  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `
    <radialGradient id="mapGlow" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#22d3ee" stop-opacity="0"/>
    </radialGradient>`;
  svg.appendChild(defs);

  const bg = document.createElementNS(NS, "rect");
  bg.setAttribute("x", 0); bg.setAttribute("y", 0);
  bg.setAttribute("width", 100); bg.setAttribute("height", 62);
  bg.setAttribute("rx", 2); bg.setAttribute("fill", "url(#mapGlow)");
  svg.appendChild(bg);

  // graticule
  for (let x = 10; x < 100; x += 10) {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", x); l.setAttribute("y1", 0);
    l.setAttribute("x2", x); l.setAttribute("y2", 62);
    l.setAttribute("stroke", "rgba(120,180,255,0.07)");
    l.setAttribute("stroke-width", 0.25);
    svg.appendChild(l);
  }
  for (let y = 10; y < 62; y += 10) {
    const l = document.createElementNS(NS, "line");
    l.setAttribute("x1", 0); l.setAttribute("y1", y);
    l.setAttribute("x2", 100); l.setAttribute("y2", y);
    l.setAttribute("stroke", "rgba(120,180,255,0.07)");
    l.setAttribute("stroke-width", 0.25);
    svg.appendChild(l);
  }

  for (const d of CONTINENTS) {
    const p = document.createElementNS(NS, "path");
    p.setAttribute("d", d);
    p.setAttribute("fill", "rgba(96,165,250,0.14)");
    p.setAttribute("stroke", "rgba(120,180,255,0.35)");
    p.setAttribute("stroke-width", 0.3);
    p.setAttribute("stroke-linejoin", "round");
    svg.appendChild(p);
  }

  for (const r of regions) {
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", "map-marker");
    g.setAttribute("data-region", r.id);
    const hasData = r.prospects > 0;
    const col = hasData ? "#22d3ee" : "#5b6a82";
    if (hasData) {
      const pulse = document.createElementNS(NS, "circle");
      pulse.setAttribute("class", "pulse");
      pulse.setAttribute("cx", r.x); pulse.setAttribute("cy", r.y);
      pulse.setAttribute("r", 1.6); pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", "#22d3ee"); pulse.setAttribute("stroke-width", 0.4);
      g.appendChild(pulse);
    }
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", r.x); dot.setAttribute("cy", r.y);
    dot.setAttribute("r", hasData ? 1.5 : 1.1);
    dot.setAttribute("fill", col);
    dot.setAttribute("stroke", "#05070d"); dot.setAttribute("stroke-width", 0.3);
    g.appendChild(dot);
    const label = document.createElementNS(NS, "text");
    label.setAttribute("x", r.x + 2.2); label.setAttribute("y", r.y + 0.9);
    label.textContent = `${r.name} · ${r.prospects}`;
    g.appendChild(label);
    g.addEventListener("click", () => onSelect && onSelect(r));
    svg.appendChild(g);
  }
}
