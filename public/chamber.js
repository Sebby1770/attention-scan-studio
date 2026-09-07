const SEVERITY_COLOR = {
  critical: "#ff5a4a",
  high: "#ffbf47",
  medium: "#9dff6b",
  low: "#7aa0b8",
};

export function hashAngle(id) {
  let hash = 2166136261;
  const text = String(id || "");
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return ((hash >>> 0) / 4294967296) * Math.PI * 2;
}

export function blipRadius(score, maxRadius) {
  const clamped = Math.max(0, Math.min(140, Number(score) || 0));
  const t = 1 - clamped / 140;
  return Math.max(22, 30 + t * (maxRadius - 42));
}

export function blipPoint(item, cx, cy, maxRadius) {
  const angle = hashAngle(item.id || item.title);
  const radius = blipRadius(item.score || severityScore(item.severity), maxRadius);
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
    angle,
    radius,
    color: SEVERITY_COLOR[item.severity] || SEVERITY_COLOR.medium,
    size: item.severity === "critical" ? 5.5 : item.severity === "high" ? 4.4 : 3.2,
  };
}

function severityScore(severity) {
  if (severity === "critical") return 120;
  if (severity === "high") return 88;
  if (severity === "medium") return 52;
  return 24;
}

export function createChamber({
  canvas,
  readout,
  reducedMotion = false,
  onSelect = () => {},
} = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return { sync() {}, dispose() {} };
  }

  const ctx = canvas.getContext("2d");
  let items = [];
  let points = [];
  let sweep = 0;
  let raf = 0;
  let hover = -1;
  let pulse = "calm";
  let score = 0;
  let metrics = { width: 0, height: 0, cx: 0, cy: 0, maxRadius: 120 };

  function sizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(240, Math.floor(rect.width || 420));
    const height = Math.max(240, Math.floor(rect.height || 420));
    canvas.width = Math.floor(width * scale);
    canvas.height = Math.floor(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    metrics = {
      width,
      height,
      cx: width / 2,
      cy: height / 2,
      maxRadius: Math.min(width, height) * 0.42,
    };
    return metrics;
  }

  function layout() {
    if (!metrics.width) sizeCanvas();
    const { cx, cy, maxRadius } = metrics;
    points = items.map((item) => ({ item, ...blipPoint(item, cx, cy, maxRadius) }));
    return metrics;
  }

  function drawGrid(width, height, cx, cy, maxRadius) {
    ctx.clearRect(0, 0, width, height);
    const wash = ctx.createRadialGradient(cx, cy, 8, cx, cy, maxRadius * 1.35);
    wash.addColorStop(0, "rgba(20, 42, 18, 0.55)");
    wash.addColorStop(1, "rgba(5, 7, 10, 0.05)");
    ctx.fillStyle = wash;
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius + 18, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(157, 255, 107, 0.16)";
    ctx.lineWidth = 1;
    for (let ring = 1; ring <= 4; ring += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, (maxRadius * ring) / 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let spoke = 0; spoke < 8; spoke += 1) {
      const angle = (spoke / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * maxRadius, cy + Math.sin(angle) * maxRadius);
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(255, 191, 71, 0.45)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, maxRadius + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawSweep(cx, cy, maxRadius) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sweep);
    const fan = ctx.createLinearGradient(0, 0, maxRadius, 0);
    fan.addColorStop(0, "rgba(157, 255, 107, 0)");
    fan.addColorStop(0.7, "rgba(157, 255, 107, 0.05)");
    fan.addColorStop(1, "rgba(157, 255, 107, 0.28)");
    ctx.fillStyle = fan;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, maxRadius, -0.42, 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(157, 255, 107, 0.85)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(maxRadius, 0);
    ctx.stroke();
    ctx.restore();
  }

  function drawBlips() {
    points.forEach((point, index) => {
      const lit = hover === index;
      ctx.beginPath();
      ctx.fillStyle = point.color;
      ctx.globalAlpha = lit ? 1 : 0.88;
      ctx.arc(point.x, point.y, lit ? point.size + 2 : point.size, 0, Math.PI * 2);
      ctx.fill();
      if (lit || point.item.severity === "critical") {
        ctx.strokeStyle = point.color;
        ctx.globalAlpha = 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(point.x, point.y, point.size + 6, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });
  }

  function paint() {
    const { width, height, cx, cy, maxRadius } = layout();
    drawGrid(width, height, cx, cy, maxRadius);
    if (!reducedMotion) drawSweep(cx, cy, maxRadius);
    drawBlips();
    ctx.fillStyle = "rgba(157, 255, 107, 0.7)";
    ctx.font = "11px 'Share Tech Mono', ui-monospace, monospace";
    ctx.fillText(`PULSE ${String(pulse).toUpperCase()}`, 16, 22);
    ctx.fillText(`ATTN ${score}`, 16, 38);
    ctx.fillText(`${items.length} BLIPS`, 16, height - 16);
  }

  function tick() {
    if (!reducedMotion) sweep = (sweep + 0.018) % (Math.PI * 2);
    paint();
    raf = requestAnimationFrame(tick);
  }

  function hitTest(event) {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    let best = -1;
    let bestDist = 14;
    points.forEach((point, index) => {
      const dist = Math.hypot(point.x - x, point.y - y);
      if (dist < bestDist) {
        best = index;
        bestDist = dist;
      }
    });
    return best;
  }

  function setReadout(index) {
    if (!readout) return;
    if (index < 0 || !points[index]) {
      readout.textContent = items.length ? `${items.length} contacts on scope` : "Sweep idle — no contacts";
      return;
    }
    const item = points[index].item;
    readout.textContent = `${String(item.severity || "signal").toUpperCase()} · ${item.title}`;
  }

  function onMove(event) {
    hover = hitTest(event);
    canvas.style.cursor = hover >= 0 ? "pointer" : "crosshair";
    setReadout(hover);
  }

  function onClick(event) {
    const index = hitTest(event);
    if (index < 0) return;
    onSelect(points[index].item);
  }

  function onResize() {
    sizeCanvas();
    paint();
  }

  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerleave", () => {
    hover = -1;
    canvas.style.cursor = "crosshair";
    setReadout(-1);
  });
  canvas.addEventListener("click", onClick);
  window.addEventListener("resize", onResize);

  function sync(nextItems, meta = {}) {
    items = Array.isArray(nextItems) ? nextItems : [];
    pulse = meta.pulse || "calm";
    score = Number(meta.score) || items.length;
    setReadout(-1);
    paint();
  }

  function dispose() {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
  }

  canvas.style.cursor = "crosshair";
  sizeCanvas();
  raf = requestAnimationFrame(tick);
  return { sync, dispose };
}
