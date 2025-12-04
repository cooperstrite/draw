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
let lastX = 0;
let lastY = 0;
let history = [];
let historyStep = -1;
let usingEraser = false;

function setCanvasSize() {
  const dataUrl = canvas.toDataURL();
  const { width, height } = canvas.getBoundingClientRect();
  if (canvas.width === width && canvas.height === height) return;

  const img = new Image();
  img.onload = () => {
    canvas.width = width;
    canvas.height = height;
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
  lastX = pos.x;
  lastY = pos.y;
}

function stopDrawing() {
  if (!drawing) return;
  drawing = false;
  saveSnapshot();
}

function draw(e) {
  if (!drawing) return;
  const { x, y } = getPos(e);
  ctx.strokeStyle = usingEraser ? "#ffffff" : withOpacity(colorInput.value, opacityInput.value);
  ctx.lineWidth = Number(sizeInput.value);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.stroke();
  lastX = x;
  lastY = y;
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

function withOpacity(hex, alpha) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  clearCanvas();
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
