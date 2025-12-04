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

let drawing = false;
let history = [];
let historyStep = -1;
let usingEraser = false;
let strokePoints = [];
let baseSnapshot = null;
const strokeLayer = document.createElement("canvas");
const strokeCtx = strokeLayer.getContext("2d");

function setCanvasSize() {
  const dataUrl = canvas.toDataURL();
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width === width && canvas.height === height) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = width;
    canvas.height = height;
    syncStrokeLayerSize();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    saveSnapshot(true);
  };
  img.src = dataUrl;
}

function saveSnapshot(skipTruncate = false) {
  if (!skipTruncate) {
    history = history.slice(0, historyStep + 1);
  }
  history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  historyStep = history.length - 1;
}

function restoreSnapshot() {
  if (historyStep < 0) return;
  ctx.putImageData(history[historyStep], 0, 0);
}

function startDrawing(e) {
  drawing = true;
  const pos = getPos(e);
  strokePoints = [pos];
  baseSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  renderStroke();
}

function stopDrawing() {
  if (!drawing) return;
  drawing = false;
  renderStroke();
  strokePoints = [];
  baseSnapshot = null;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  saveSnapshot();
}

function draw(e) {
  if (!drawing) return;
  strokePoints.push(getPos(e));
  renderStroke();
}

function renderStroke() {
  if (!baseSnapshot || strokePoints.length === 0) return;

  ctx.putImageData(baseSnapshot, 0, 0);
  const [first, ...rest] = strokePoints;

  if (usingEraser) {
    ctx.globalCompositeOperation = "destination-out";
    ctx.lineWidth = Number(sizeInput.value);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    if (!rest.length) {
      ctx.beginPath();
      ctx.arc(first.x, first.y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (const point of rest) {
        ctx.lineTo(point.x, point.y);
      }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    return;
  }

  strokeCtx.clearRect(0, 0, strokeLayer.width, strokeLayer.height);
  strokeCtx.lineWidth = Number(sizeInput.value);
  strokeCtx.lineCap = "round";
  strokeCtx.lineJoin = "round";
  strokeCtx.strokeStyle = colorInput.value;
  strokeCtx.fillStyle = colorInput.value;

  if (!rest.length) {
    strokeCtx.beginPath();
    strokeCtx.arc(first.x, first.y, strokeCtx.lineWidth / 2, 0, Math.PI * 2);
    strokeCtx.fill();
  } else {
    strokeCtx.beginPath();
    strokeCtx.moveTo(first.x, first.y);
    for (const point of rest) {
      strokeCtx.lineTo(point.x, point.y);
    }
    strokeCtx.stroke();
  }

  ctx.globalAlpha = Number(opacityInput.value);
  ctx.drawImage(strokeLayer, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
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
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  saveSnapshot();
}

function undo() {
  if (historyStep <= 0) return;
  historyStep -= 1;
  restoreSnapshot();
}

function downloadImage() {
  const link = document.createElement("a");
  link.download = "sketch.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function init() {
  canvas.width = canvas.getBoundingClientRect().width;
  canvas.height = canvas.getBoundingClientRect().height;
  syncStrokeLayerSize();
  clearCanvas();
}

function syncStrokeLayerSize() {
  strokeLayer.width = canvas.width;
  strokeLayer.height = canvas.height;
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

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", draw);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);

window.addEventListener("resize", setCanvasSize);

init();
