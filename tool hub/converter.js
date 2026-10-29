const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const result = document.getElementById("result");
const formatSelect = document.getElementById("formatSelect");
const originalImg = document.getElementById("originalImg");
const convertedImg = document.getElementById("convertedImg");
const originalInfo = document.getElementById("originalInfo");
const convertedInfo = document.getElementById("convertedInfo");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");

let sourceImage = null;
let sourceFile = null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function typeName(mime) {
  if (mime === "image/jpeg") return "JPG";
  if (mime === "image/png") return "PNG";
  return "WebP";
}

function convertImage() {
  if (!sourceImage) return;
  const mime = formatSelect.value;
  const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "webp";

  const canvas = document.createElement("canvas");
  canvas.width = sourceImage.width;
  canvas.height = sourceImage.height;
  const ctx = canvas.getContext("2d");

  if (mime === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(sourceImage, 0, 0);

  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    convertedImg.src = url;
    convertedInfo.textContent = typeName(mime) + ", " + formatSize(blob.size);
    downloadBtn.href = url;
    downloadBtn.download = "converted-image." + ext;
  }, mime, 0.92);
}

function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    alert("Please select an image file (JPG, PNG or WebP).");
    return;
  }
  sourceFile = file;
  const img = new Image();
  img.onload = () => {
    sourceImage = img;
    originalImg.src = img.src;
    originalInfo.textContent = typeName(file.type) + ", " + formatSize(file.size);
    dropzone.hidden = true;
    result.hidden = false;
    convertImage();
  };
  img.src = URL.createObjectURL(file);
}

formatSelect.addEventListener("change", convertImage);
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
  sourceFile = null;
  fileInput.value = "";
  result.hidden = true;
  dropzone.hidden = false;
});