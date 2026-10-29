const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const result = document.getElementById("result");
const quality = document.getElementById("quality");
const qualityValue = document.getElementById("qualityValue");
const originalImg = document.getElementById("originalImg");
const compressedImg = document.getElementById("compressedImg");
const originalSize = document.getElementById("originalSize");
const compressedSize = document.getElementById("compressedSize");
const savedText = document.getElementById("savedText");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

let currentFile = null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function compressImage(file, qualityPercent) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => resolve(blob), "image/jpeg", qualityPercent / 100);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function processImage() {
  if (!currentFile) return;
  const blob = await compressImage(currentFile, quality.value);
  const url = URL.createObjectURL(blob);
  compressedImg.src = url;
  compressedSize.textContent = "Size: " + formatSize(blob.size);
  const saved = ((currentFile.size - blob.size) / currentFile.size) * 100;
  savedText.textContent = saved > 0 ? "Saved " + saved.toFixed(0) + "%" : "Already optimized. Try lower quality.";
  downloadBtn.href = url;
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select an image file (JPG, PNG or WebP).");
    return;
  }
  currentFile = file;
  originalImg.src = URL.createObjectURL(file);
  originalSize.textContent = "Size: " + formatSize(file.size);
  dropzone.hidden = true;
  result.hidden = false;
  processImage();
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
quality.addEventListener("input", () => {
  qualityValue.textContent = quality.value;
  processImage();
});
resetBtn.addEventListener("click", () => {
  currentFile = null;
  fileInput.value = "";
  result.hidden = true;
  dropzone.hidden = false;
});