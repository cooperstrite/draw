const canvas = document.getElementById("canvas");
const viewport = document.querySelector(".canvas-viewport");
const ctx = canvas.getContext("2d");
const colorInput = document.getElementById("color");
const sizeInput = document.getElementById("size");
const opacityInput = document.getElementById("opacity");
const sizeValue = document.getElementById("sizeValue");
const opacityValue = document.getElementById("opacityValue");
const clearBtn = document.getElementById("clear");
const downloadBtn = document.getElementById("download");
const undoBtn = document.getElementById("undo");
const eraserBtn = document.getElementById("eraser");
const toolButtons = Array.from(document.querySelectorAll(".tool"));
const backgroundInput = document.getElementById("background");
const setBackgroundBtn = document.getElementById("setBackground");
const addLayerBtn = document.getElementById("addLayer");
const layerList = document.getElementById("layerList");
const layerUpBtn = document.getElementById("layerUp");
const layerDownBtn = document.getElementById("layerDown");
const deleteLayerBtn = document.getElementById("deleteLayer");
const zoomRange = document.getElementById("zoomRange");
const zoomValue = document.getElementById("zoomValue");
const zoomInBtn = document.getElementById("zoomIn");
const zoomOutBtn = document.getElementById("zoomOut");

const tools = {
  brush: { widthScale: 1, opacityScale: 1, composite: "source-over", lineCap: "round", mode: "watercolor" },
  pen: { widthScale: 0.75, opacityScale: 1, composite: "source-over", lineCap: "butt", mode: "ink" },
  pencil: { widthScale: 0.5, opacityScale: 0.5, composite: "source-over", lineCap: "round", mode: "jitter" },
  marker: { widthScale: 1.25, opacityScale: 0.8, composite: "source-over", lineCap: "square", mode: "marker" },
  highlighter: { widthScale: 1.6, opacityScale: 0.35, composite: "multiply", lineCap: "butt", mode: "highlighter" },
};

let drawing = false;
let history = [];
let historyStep = -1;
let usingEraser = false;
let strokePoints = [];
let backgroundColor = "#ffffff";
let selectedTool = "brush";
let layers = [];
let activeLayerId = null;
let layerCounter = 1;
let workspaceSize = 3200;
let spaceHeld = false;
let isPanning = false;
let lastPanPoint = { x: 0, y: 0 };

const strokeLayer = document.createElement("canvas");
const strokeCtx = strokeLayer.getContext("2d");

function createLayer(name, id) {
  const layerCanvas = document.createElement("canvas");
  layerCanvas.width = workspaceSize;
  layerCanvas.height = workspaceSize;
  const layerCtx = layerCanvas.getContext("2d");
  return { id: id ?? `layer-${Date.now()}-${Math.random()}`, name, visible: true, canvas: layerCanvas, ctx: layerCtx };
}

function setCanvasSize() {
  applyWorkspaceSize(workspaceSize, true);
}

function saveSnapshot(skipTruncate = false) {
  if (!skipTruncate) {
    history = history.slice(0, historyStep + 1);
  }
  const layerData = layers.map((l) => ({
    id: l.id,
    name: l.name,
    visible: l.visible,
    imageData: l.ctx.getImageData(0, 0, l.canvas.width, l.canvas.height),
  }));
  history.push({ background: backgroundColor, activeId: activeLayerId, layers: layerData, size: workspaceSize });
  historyStep = history.length - 1;
}

function restoreSnapshot() {
  if (historyStep < 0) return;
  const snap = history[historyStep];
  backgroundColor = snap.background;
  backgroundInput.value = backgroundColor;
  if (snap.size) {
    applyWorkspaceSize(snap.size, true);
  }

  layers = snap.layers.map((l) => {
    const layer = createLayer(l.name, l.id);
    layer.visible = l.visible;
    if (layer.canvas.width !== l.imageData.width || layer.canvas.height !== l.imageData.height) {
      layer.canvas.width = l.imageData.width;
      layer.canvas.height = l.imageData.height;
    }
    layer.ctx.putImageData(l.imageData, 0, 0);
    return layer;
  });
  layerCounter = layers.length;
  activeLayerId = snap.activeId && layers.find((l) => l.id === snap.activeId) ? snap.activeId : layers[0]?.id || null;
  renderLayerList();
  drawBase();
}

function startDrawing(e) {
  if (isPanning || spaceHeld || e.button === 1) return;
  if (!getActiveLayer()) return;
  drawing = true;
  strokePoints = [getPos(e)];
  renderStroke(false);
}

function stopDrawing() {
  if (!drawing) return;
  drawing = false;
  renderStroke(true);
  strokePoints = [];
}

function draw(e) {
  if (isPanning) return;
  if (!drawing) return;
  strokePoints.push(getPos(e));
  renderStroke(false);
}

function renderStroke(commit = false) {
  drawBase();
  if (strokePoints.length === 0) return;
  const activeLayer = getActiveLayer();
  if (!activeLayer) return;

  const tool = tools[selectedTool] || tools.brush;
  const width = Number(sizeInput.value) * (tool.widthScale || 1);
  const alpha = Number(opacityInput.value) * (tool.opacityScale || 1);

  strokeCtx.clearRect(0, 0, strokeLayer.width, strokeLayer.height);

  if (usingEraser) {
    paintStroke(strokeCtx, strokePoints, { mode: "smooth", lineCap: "round" }, width, "#000000");
    ctx.globalCompositeOperation = "destination-out";
    ctx.drawImage(strokeLayer, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    if (commit) {
      activeLayer.ctx.save();
      activeLayer.ctx.globalCompositeOperation = "destination-out";
      activeLayer.ctx.drawImage(strokeLayer, 0, 0);
      activeLayer.ctx.restore();
      drawBase();
      saveSnapshot();
    }
    return;
  }

  paintStroke(strokeCtx, strokePoints, tool, width, colorInput.value);

  const composite = tool.composite || "source-over";
  ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = composite;
  ctx.drawImage(strokeLayer, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";

  if (commit) {
    activeLayer.ctx.save();
    activeLayer.ctx.globalAlpha = alpha;
    activeLayer.ctx.globalCompositeOperation = composite;
    activeLayer.ctx.drawImage(strokeLayer, 0, 0);
    activeLayer.ctx.restore();
    drawBase();
    saveSnapshot();
  }
}

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: ((clientX - rect.left) / rect.width) * canvas.width,
    y: ((clientY - rect.top) / rect.height) * canvas.height,
  };
}

function clearCanvas() {
  layers.forEach((layer) => layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height));
  drawBase();
  saveSnapshot();
}

function undo() {
  if (historyStep <= 0) return;
  historyStep -= 1;
  restoreSnapshot();
}

function downloadImage() {
  drawBase();
  const link = document.createElement("a");
  link.download = "sketch.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function init() {
  applyWorkspaceSize(workspaceSize, true);
  backgroundColor = backgroundInput.value;

  const baseLayer = createLayer(`Layer ${layerCounter++}`);
  layers.push(baseLayer);
  activeLayerId = baseLayer.id;

  renderLayerList();
  drawBase();
  saveSnapshot(true);
  selectTool(selectedTool);
}

sizeInput.addEventListener("input", () => {
  sizeValue.textContent = `${sizeInput.value}px`;
});

opacityInput.addEventListener("input", () => {
  opacityValue.textContent = `${Math.round(Number(opacityInput.value) * 100)}%`;
});

clearBtn.addEventListener("click", clearCanvas);
downloadBtn.addEventListener("click", downloadImage);
undoBtn.addEventListener("click", undo);
eraserBtn.addEventListener("click", () => {
  usingEraser = !usingEraser;
  eraserBtn.classList.toggle("primary", usingEraser);
  eraserBtn.textContent = usingEraser ? "Eraser (on)" : "Eraser";
});

setBackgroundBtn.addEventListener("click", () => {
  backgroundColor = backgroundInput.value;
  drawBase();
  saveSnapshot();
});

toolButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    selectTool(btn.dataset.tool);
  });
});

addLayerBtn.addEventListener("click", () => {
  const layer = createLayer(`Layer ${layerCounter++}`);
  const idx = findLayerIndex(activeLayerId);
  const insertAt = idx >= 0 ? idx + 1 : layers.length;
  layers.splice(insertAt, 0, layer);
  activeLayerId = layer.id;
  renderLayerList();
  drawBase();
  saveSnapshot();
});

layerUpBtn.addEventListener("click", () => moveLayer(1));
layerDownBtn.addEventListener("click", () => moveLayer(-1));
deleteLayerBtn.addEventListener("click", () => {
  if (layers.length <= 1) return;
  const idx = findLayerIndex(activeLayerId);
  if (idx === -1) return;
  layers.splice(idx, 1);
  const newIdx = Math.max(0, idx - 1);
  activeLayerId = layers[newIdx]?.id || layers[0]?.id || null;
  renderLayerList();
  drawBase();
  saveSnapshot();
});

layerList.addEventListener("click", (e) => {
  const actionBtn = e.target.closest("[data-action]");
  const row = e.target.closest(".layer-row");
  const id = actionBtn?.dataset.id || row?.dataset.id;
  if (!id) return;

  if (actionBtn?.dataset.action === "toggle") {
    const layer = layers.find((l) => l.id === id);
    if (!layer) return;
    layer.visible = !layer.visible;
    renderLayerList();
    drawBase();
    saveSnapshot();
    return;
  }

  activeLayerId = id;
  renderLayerList();
});

if (zoomRange) {
  zoomRange.addEventListener("input", (e) => {
    resizeWorkspace(Number(e.target.value));
  });
}

zoomInBtn?.addEventListener("click", () => {
  resizeWorkspace(workspaceSize + 400);
});

zoomOutBtn?.addEventListener("click", () => {
  resizeWorkspace(workspaceSize - 400);
});

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

canvas.addEventListener("pointerdown", startPan);
canvas.addEventListener("pointermove", panMove);
canvas.addEventListener("pointerup", stopPan);
canvas.addEventListener("pointerleave", stopPan);
canvas.addEventListener("pointercancel", stopPan);

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    spaceHeld = true;
    viewport?.classList.add("panning-ready");
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spaceHeld = false;
    isPanning = false;
    viewport?.classList.remove("panning");
    viewport?.classList.remove("panning-ready");
  }
});

window.addEventListener("resize", setCanvasSize);

init();

function selectTool(toolName) {
  if (!tools[toolName]) return;
  selectedTool = toolName;
  usingEraser = false;
  eraserBtn.classList.remove("primary");
  eraserBtn.textContent = "Eraser";
  toolButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tool === toolName));
}

function getActiveLayer() {
  return layers.find((l) => l.id === activeLayerId) || null;
}

function drawBase() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  layers.forEach((layer) => {
    if (layer.visible) {
      ctx.drawImage(layer.canvas, 0, 0);
    }
  });
}

function moveLayer(delta) {
  const idx = findLayerIndex(activeLayerId);
  if (idx === -1) return;
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= layers.length) return;
  const [layer] = layers.splice(idx, 1);
  layers.splice(newIdx, 0, layer);
  renderLayerList();
  drawBase();
  saveSnapshot();
}

function findLayerIndex(id) {
  return layers.findIndex((l) => l.id === id);
}

function renderLayerList() {
  const rows = [...layers]
    .map((layer, i) => {
      const isActive = layer.id === activeLayerId;
      const topIndex = layers.length - i;
      return `<div class="layer-row ${isActive ? "active" : ""}" data-id="${layer.id}">
        <span class="name">${layer.name} ( #${topIndex} )</span>
        <span class="hint">${layer.visible ? "Visible" : "Hidden"}</span>
        <div class="controls">
          <button class="mini-btn ghost" data-action="toggle" data-id="${layer.id}">${layer.visible ? "Hide" : "Show"}</button>
        </div>
      </div>`;
    })
    .reverse()
    .join("");
  layerList.innerHTML = rows || "<p class='hint'>No layers</p>";
}

function updateSizeUI() {
  if (zoomValue) {
    zoomValue.textContent = `${workspaceSize}px`;
  }
  if (zoomRange) {
    if (workspaceSize > Number(zoomRange.max)) zoomRange.max = workspaceSize;
    zoomRange.value = workspaceSize;
  }
}

function resizeWorkspace(nextSize) {
  const minSize = 1200;
  const maxSize = 12000;
  const target = Math.min(maxSize, Math.max(minSize, Math.round(nextSize)));
  if (target === workspaceSize) return;
  const previousSize = workspaceSize;
  workspaceSize = target;
  applyWorkspaceSize(workspaceSize);
  updateSizeUI();
  // Try to keep viewport centered on the same relative spot.
  const ratio = workspaceSize / previousSize;
  if (viewport) {
    viewport.scrollLeft *= ratio;
    viewport.scrollTop *= ratio;
  }
  saveSnapshot(true);
}

function applyWorkspaceSize(size, initializing = false) {
  const targetSize = Math.round(size);
  workspaceSize = targetSize;
  canvas.width = targetSize;
  canvas.height = targetSize;
  canvas.style.setProperty("--workspace-size", `${targetSize}px`);
  strokeLayer.width = targetSize;
  strokeLayer.height = targetSize;

  layers.forEach((layer) => {
    const temp = document.createElement("canvas");
    temp.width = targetSize;
    temp.height = targetSize;
    temp.getContext("2d").drawImage(layer.canvas, 0, 0);
    layer.canvas = temp;
    layer.ctx = temp.getContext("2d");
  });

  drawBase();
  if (!initializing) {
    renderLayerList();
  }
  updateSizeUI();
}

function startPan(e) {
  if (!(spaceHeld || e.button === 1)) return;
  isPanning = true;
  lastPanPoint = { x: e.clientX, y: e.clientY };
  viewport?.classList.add("panning");
  canvas.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

function panMove(e) {
  if (!isPanning || !viewport) return;
  const dx = e.clientX - lastPanPoint.x;
  const dy = e.clientY - lastPanPoint.y;
  viewport.scrollLeft -= dx;
  viewport.scrollTop -= dy;
  lastPanPoint = { x: e.clientX, y: e.clientY };
  e.preventDefault();
}

function stopPan(e) {
  if (!isPanning) return;
  isPanning = false;
  viewport?.classList.remove("panning");
  canvas.releasePointerCapture?.(e.pointerId);
  e.preventDefault();
}

function paintStroke(targetCtx, points, tool, width, color) {
  targetCtx.save();
  targetCtx.clearRect(0, 0, strokeLayer.width, strokeLayer.height);
  targetCtx.lineWidth = width;
  targetCtx.lineCap = tool.lineCap || "round";
  targetCtx.lineJoin = "round";
  targetCtx.strokeStyle = color;
  targetCtx.fillStyle = color;
  targetCtx.setLineDash([]);
  targetCtx.shadowBlur = 0;
  targetCtx.globalAlpha = 1;

  switch (tool.mode) {
    case "watercolor": {
      const w = Math.max(width, 3.2);
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
      targetCtx.filter = "blur(0.6px)";
      targetCtx.globalAlpha = 0.65;
      targetCtx.lineWidth = w * 1.12;
      drawPath(targetCtx, points);
      targetCtx.filter = "none";
      targetCtx.globalAlpha = 0.95;
      targetCtx.lineWidth = w * 1.02;
      drawPath(targetCtx, jitterPoints(points, w * 0.05));
      targetCtx.globalAlpha = 0.55;
      targetCtx.lineWidth = w * 1.1;
      targetCtx.setLineDash([w * 0.45, w * 0.45]);
      drawPath(targetCtx, jitterPoints(points, w * 0.14));
      targetCtx.setLineDash([]);
      targetCtx.globalAlpha = 0.35;
      scatterStroke(targetCtx, points, w * 0.2);
      targetCtx.globalAlpha = 0.5;
      targetCtx.lineWidth = Math.max(w * 0.55, 2.2);
      drawPath(targetCtx, points);
      break;
    }
    case "jitter":
      drawPath(targetCtx, points);
      targetCtx.globalAlpha = 0.5;
      drawPath(targetCtx, jitterPoints(points, width * 0.15));
      targetCtx.globalAlpha = 0.35;
      drawPath(targetCtx, jitterPoints(points, width * 0.2));
      break;
    case "marker":
      targetCtx.lineCap = "square";
      targetCtx.lineJoin = "bevel";
      targetCtx.shadowColor = hexToRgba(color, 0.25);
      targetCtx.shadowBlur = width * 0.35;
      drawPath(targetCtx, points);
      break;
    case "highlighter":
      targetCtx.lineCap = "butt";
      targetCtx.lineJoin = "miter";
      targetCtx.setLineDash([width * 0.8, width * 0.4]);
      drawPath(targetCtx, points);
      break;
    case "ink":
      targetCtx.lineCap = "butt";
      targetCtx.lineJoin = "round";
      drawPath(targetCtx, points);
      targetCtx.lineWidth = Math.max(1, width * 0.6);
      targetCtx.globalAlpha = 0.6;
      targetCtx.setLineDash([width * 2, width * 1.3]);
      drawPath(targetCtx, points);
      break;
    default:
      drawPath(targetCtx, points);
  }

  targetCtx.restore();
}

function drawPath(targetCtx, points) {
  if (!points.length) return;
  const [first, ...rest] = points;
  if (!rest.length) {
    targetCtx.beginPath();
    targetCtx.arc(first.x, first.y, targetCtx.lineWidth / 2, 0, Math.PI * 2);
    targetCtx.fill();
    return;
  }
  targetCtx.beginPath();
  targetCtx.moveTo(first.x, first.y);
  for (const p of rest) {
    targetCtx.lineTo(p.x, p.y);
  }
  targetCtx.stroke();
}

function jitterPoints(points, amount) {
  return points.map((p) => ({
    x: p.x + (Math.random() - 0.5) * amount,
    y: p.y + (Math.random() - 0.5) * amount,
  }));
}

function hexToRgba(hex, alpha = 1) {
  const int = parseInt(hex.replace("#", ""), 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function scatterStroke(targetCtx, points, radius) {
  for (let i = 0; i < points.length; i += Math.max(1, Math.floor(points.length / 25))) {
    const p = points[i];
    const count = 3;
    for (let j = 0; j < count; j++) {
      const offsetX = (Math.random() - 0.5) * radius * 2;
      const offsetY = (Math.random() - 0.5) * radius * 2;
      const r = Math.max(0.5, (Math.random() * radius) / 2);
      targetCtx.beginPath();
      targetCtx.arc(p.x + offsetX, p.y + offsetY, r, 0, Math.PI * 2);
      targetCtx.fill();
    }
  }
}
