"use strict";

const AI_URL = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.5/+esm";
const MAX_SIDE = 4096;

const $ = (id) => document.getElementById(id);
const dropzone = $("dropzone");
const fileInput = $("fileInput");
const selectBtn = $("selectBtn");
const result = $("result");
const methodSelect = $("methodSelect");
const bgSelect = $("bgSelect");
const bgColor = $("bgColor");
const colorWrap = $("colorWrap");
const tolWrap = $("tolWrap");
const tolerance = $("tolerance");
const tolValue = $("tolValue");
const runBtn = $("runBtn");
const methodNote = $("methodNote");
const originalImg = $("originalImg");
const originalInfo = $("originalInfo");
const resultImg = $("resultImg");
const resultInfo = $("resultInfo");
const statusEl = $("status");
const downloadBtn = $("downloadBtn");
const resetBtn = $("resetBtn");

let srcFile = null;
let srcImg = null;
let srcUrl = null;
let cutout = null;
let resultUrl = null;
let aiModule = null;
let busy = false;
let again = false;
let tolTimer = null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function setStatus(text) {
  statusEl.textContent = text;
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 30));

function baseName() {
  return (srcFile ? srcFile.name.replace(/\.[^.]+$/, "") : "image") || "image";
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const url = source instanceof Blob ? URL.createObjectURL(source) : source;
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image could not be read."));
    img.src = url;
  });
}

function sourceCanvas() {
  const scale = Math.min(1, MAX_SIDE / Math.max(srcImg.naturalWidth, srcImg.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(srcImg.naturalWidth * scale);
  canvas.height = Math.round(srcImg.naturalHeight * scale);
  canvas.getContext("2d").drawImage(srcImg, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/* ---------- Quick mode: remove plain background by color ---------- */

function quickRemove(src, tol) {
  const w = src.width;
  const h = src.height;
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  ctx.drawImage(src, 0, 0);
  const image = ctx.getImageData(0, 0, w, h);
  const d = image.data;

  // Average color of the image border = background color
  let r = 0, g = 0, b = 0, n = 0;
  const sample = (x, y) => {
    const i = (y * w + x) * 4;
    r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
  };
  for (let x = 0; x < w; x++) { sample(x, 0); sample(x, h - 1); }
  for (let y = 1; y < h - 1; y++) { sample(0, y); sample(w - 1, y); }
  r /= n; g /= n; b /= n;

  const tol2 = tol * tol;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;

  const match = (p) => {
    const i = p * 4;
    const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
    return dr * dr + dg * dg + db * db <= tol2;
  };
  const push = (p) => {
    if (!seen[p] && match(p)) { seen[p] = 1; stack[sp++] = p; }
  };

  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

  while (sp > 0) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p / w) | 0;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      const i = p * 4;
      if (seen[p]) { d[i + 3] = 0; continue; }
      const edge = (x > 0 && seen[p - 1]) || (x < w - 1 && seen[p + 1]) || (y > 0 && seen[p - w]) || (y < h - 1 && seen[p + w]);
      if (edge) {
        const dr = d[i] - r, dg = d[i + 1] - g, db = d[i + 2] - b;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        const a = Math.max(0, Math.min(1, (dist - tol) / (0.6 * tol + 1)));
        d[i + 3] = Math.round(255 * a);
      }
    }
  }

  ctx.putImageData(image, 0, 0);
  return out;
}

/* ---------- AI mode ---------- */

async function aiRemove() {
  if (!aiModule) {
    setStatus("Loading AI engine...");
    aiModule = await import(AI_URL);
  }
  const removeBackground = aiModule.removeBackground || aiModule.default;
  const blob = await removeBackground(srcFile, {
    progress: (key, current, total) => {
      const pct = total ? Math.round((current / total) * 100) : 0;
      setStatus(String(key).indexOf("fetch") === 0
        ? "Downloading AI model... " + pct + "%"
        : "Removing background...");
    }
  });
  const img = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext("2d").drawImage(img, 0, 0);
  URL.revokeObjectURL(img.src);
  return canvas;
}

/* ---------- Result ---------- */

function compose() {
  const canvas = document.createElement("canvas");
  canvas.width = cutout.width;
  canvas.height = cutout.height;
  const ctx = canvas.getContext("2d");
  const bg = bgSelect.value;
  if (bg !== "transparent") {
    ctx.fillStyle = bg === "custom" ? bgColor.value : bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(cutout, 0, 0);
  return canvas;
}

function updateResult() {
  if (!cutout) return;
  compose().toBlob((blob) => {
    if (!blob) return;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(blob);
    resultImg.src = resultUrl;
    downloadBtn.href = resultUrl;
    downloadBtn.download = baseName() + "-no-bg.png";
    downloadBtn.hidden = false;
    resultInfo.textContent = cutout.width + " x " + cutout.height + " px, " + formatSize(blob.size);
  }, "image/png");
}

async function run() {
  if (!srcImg) return;
  if (busy) { again = true; return; }
  busy = true;
  runBtn.disabled = true;
  try {
    if (methodSelect.value === "ai") {
      cutout = await aiRemove();
    } else {
      setStatus("Removing background...");
      await tick();
      cutout = quickRemove(sourceCanvas(), Number(tolerance.value));
    }
    updateResult();
    setStatus("Done. Download your image below.");
  } catch (error) {
    console.error(error);
    setStatus(methodSelect.value === "ai"
      ? "AI engine could not load. Check your internet and try again, or switch to Quick mode."
      : "Something went wrong. Please try another image.");
  } finally {
    busy = false;
    runBtn.disabled = false;
    if (again) { again = false; run(); }
  }
}

function updateMethodUI() {
  const quick = methodSelect.value === "quick";
  tolWrap.hidden = !quick;
  methodNote.textContent = quick
    ? "Quick mode works best when the background is one solid color. Move the slider if parts are left behind or removed."
    : "AI mode downloads a small model the first time (needs internet) and is faster afterwards. Your image is never uploaded.";
}

/* ---------- File handling ---------- */

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select an image file (JPG, PNG or WebP).");
    return;
  }
  try {
    const img = await loadImage(file);
    if (srcUrl) URL.revokeObjectURL(srcUrl);
    srcUrl = img.src;
    srcFile = file;
    srcImg = img;
  } catch (error) {
    alert(error.message);
    return;
  }
  cutout = null;
  downloadBtn.hidden = true;
  resultImg.removeAttribute("src");
  resultInfo.textContent = "";
  originalImg.src = srcUrl;
  originalInfo.textContent = srcImg.naturalWidth + " x " + srcImg.naturalHeight + " px, " + formatSize(file.size);
  setStatus("");
  dropzone.hidden = true;
  result.hidden = false;
  updateMethodUI();
  run();
}

function reset() {
  srcFile = null;
  srcImg = null;
  cutout = null;
  fileInput.value = "";
  downloadBtn.hidden = true;
  resultImg.removeAttribute("src");
  setStatus("");
  result.hidden = true;
  dropzone.hidden = false;
}

selectBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("active"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("active"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("active");
  handleFile(e.dataTransfer.files[0]);
});
methodSelect.addEventListener("change", () => { updateMethodUI(); run(); });
bgSelect.addEventListener("change", () => {
  colorWrap.hidden = bgSelect.value !== "custom";
  updateResult();
});
bgColor.addEventListener("input", updateResult);
tolerance.addEventListener("input", () => {
  tolValue.textContent = tolerance.value;
  clearTimeout(tolTimer);
  tolTimer = setTimeout(run, 120);
});
runBtn.addEventListener("click", run);
resetBtn.addEventListener("click", reset);