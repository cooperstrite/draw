const canvas = document.getElementById("canvas");
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

const strokeLayer = document.createElement("canvas");
const strokeCtx = strokeLayer.getContext("2d");
const drawingLayer = document.createElement("canvas");
const drawingCtx = drawingLayer.getContext("2d");

function setCanvasSize() {
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width === width && canvas.height === height) return;

  const tempDrawing = document.createElement("canvas");
  tempDrawing.width = drawingLayer.width;
  tempDrawing.height = drawingLayer.height;
  const tempCtx = tempDrawing.getContext("2d");
  tempCtx.drawImage(drawingLayer, 0, 0);

  canvas.width = width;
  canvas.height = height;
  strokeLayer.width = width;
  strokeLayer.height = height;
  drawingLayer.width = width;
  drawingLayer.height = height;

  drawingCtx.drawImage(tempDrawing, 0, 0, width, height);
  drawBase();
  saveSnapshot(true);
}

function saveSnapshot(skipTruncate = false) {
  if (!skipTruncate) {
    history = history.slice(0, historyStep + 1);
  }
  history.push({
    imageData: drawingCtx.getImageData(0, 0, drawingLayer.width, drawingLayer.height),
    background: backgroundColor,
  });
  historyStep = history.length - 1;
}

function restoreSnapshot() {
  if (historyStep < 0) return;
  const snap = history[historyStep];
  backgroundColor = snap.background;
  backgroundInput.value = backgroundColor;
  drawingCtx.putImageData(snap.imageData, 0, 0);
  drawBase();
}

function startDrawing(e) {
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
  if (!drawing) return;
  strokePoints.push(getPos(e));
  renderStroke(false);
}

function renderStroke(commit = false) {
  drawBase();
  if (strokePoints.length === 0) return;

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
      drawingCtx.save();
      drawingCtx.globalCompositeOperation = "destination-out";
      drawingCtx.drawImage(strokeLayer, 0, 0);
      drawingCtx.restore();
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
    drawingCtx.save();
    drawingCtx.globalAlpha = alpha;
    drawingCtx.globalCompositeOperation = composite;
    drawingCtx.drawImage(strokeLayer, 0, 0);
    drawingCtx.restore();
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
  drawingCtx.clearRect(0, 0, drawingLayer.width, drawingLayer.height);
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
  canvas.width = canvas.getBoundingClientRect().width;
  canvas.height = canvas.getBoundingClientRect().height;
  strokeLayer.width = canvas.width;
  strokeLayer.height = canvas.height;
  drawingLayer.width = canvas.width;
  drawingLayer.height = canvas.height;
  drawingCtx.clearRect(0, 0, drawingLayer.width, drawingLayer.height);
  backgroundColor = backgroundInput.value;
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

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

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

function drawBase() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(drawingLayer, 0, 0);
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
    case "watercolor":
      const w = Math.max(width, 3.2);
      targetCtx.lineCap = "round";
      targetCtx.lineJoin = "round";
      // soft wash base
      targetCtx.filter = "blur(0.6px)";
      targetCtx.globalAlpha = 0.65;
      targetCtx.lineWidth = w * 1.12;
      drawPath(targetCtx, points);
      // main stroke with tiny jitter
      targetCtx.filter = "none";
      targetCtx.globalAlpha = 0.95;
      targetCtx.lineWidth = w * 1.02;
      drawPath(targetCtx, jitterPoints(points, w * 0.05));
      // bristly edge with dash gaps
      targetCtx.globalAlpha = 0.55;
      targetCtx.lineWidth = w * 1.1;
      targetCtx.setLineDash([w * 0.45, w * 0.45]);
      drawPath(targetCtx, jitterPoints(points, w * 0.14));
      targetCtx.setLineDash([]);
      // sparse speckles for texture
      targetCtx.globalAlpha = 0.35;
      scatterStroke(targetCtx, points, w * 0.2);
      // crisp core line for visibility on thin strokes
      targetCtx.globalAlpha = 0.5;
      targetCtx.lineWidth = Math.max(w * 0.55, 2.2);
      drawPath(targetCtx, points);
      break;
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
