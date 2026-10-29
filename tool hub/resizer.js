const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const result = document.getElementById("result");
const widthInput = document.getElementById("widthInput");
const heightInput = document.getElementById("heightInput");
const keepRatio = document.getElementById("keepRatio");
const applyBtn = document.getElementById("applyBtn");
const originalImg = document.getElementById("originalImg");
const resizedImg = document.getElementById("resizedImg");
const originalInfo = document.getElementById("originalInfo");
const resizedInfo = document.getElementById("resizedInfo");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

let sourceImage = null;
let ratio = 1;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function resizeImage() {
  const w = parseInt(widthInput.value);
  const h = parseInt(heightInput.value);
  if (!sourceImage || !w || !h) return;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(sourceImage, 0, 0, w, h);
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    resizedImg.src = url;
    resizedInfo.textContent = w + " x " + h + " px, " + formatSize(blob.size);
    downloadBtn.href = url;
  }, "image/jpeg", 0.92);
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select an image file (JPG, PNG or WebP).");
    return;
  }
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    ratio = img.width / img.height;
    widthInput.value = img.width;
    heightInput.value = img.height;
    originalImg.src = img.src;
    originalInfo.textContent = img.width + " x " + img.height + " px, " + formatSize(file.size);
    dropzone.hidden = true;
    result.hidden = false;
    resizeImage();
  };
  img.src = URL.createObjectURL(file);
}

widthInput.addEventListener("input", () => {
  if (keepRatio.checked && widthInput.value) heightInput.value = Math.round(widthInput.value / ratio);
});
heightInput.addEventListener("input", () => {
  if (keepRatio.checked && heightInput.value) widthInput.value = Math.round(heightInput.value * ratio);
});
applyBtn.addEventListener("click", resizeImage);
selectBtn.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("active"); });
dropzone.addEventListener("dragleave", () => dropzone.classList.remove("active"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("active");
  handleFile(e.dataTransfer.files[0]);
});
resetBtn.addEventListener("click", () => {
  sourceImage = null;
  fileInput.value = "";
  result.hidden = true;
  dropzone.hidden = false;
});