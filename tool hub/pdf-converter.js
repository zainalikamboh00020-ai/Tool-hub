"use strict";

pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");
const selectBtn = document.getElementById("selectBtn");
const result = document.getElementById("result");
const fileInfo = document.getElementById("fileInfo");
const formatSelect = document.getElementById("formatSelect");
const convertBtn = document.getElementById("convertBtn");
const downloadBtn = document.getElementById("downloadBtn");
const resetBtn = document.getElementById("resetBtn");
const statusEl = document.getElementById("status");

let pdfDoc = null;
let pdfFile = null;
let textPages = null;
let lastUrl = null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function baseName() {
  return pdfFile.name.replace(/\.pdf$/i, "") || "document";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Group PDF text items into rows, and rows into cells
function buildRows(items) {
  const list = items
    .filter((i) => i.str.trim() !== "")
    .map((i) => ({ x: i.transform[4], y: i.transform[5], w: i.width, s: i.str }));
  list.sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  list.forEach((it) => {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) last.items.push(it);
    else rows.push({ y: it.y, items: [it] });
  });

  return rows.map((r) => {
    r.items.sort((a, b) => a.x - b.x);
    const cells = [];
    let cur = null;
    r.items.forEach((it) => {
      const gap = cur ? it.x - (cur.x + cur.w) : 0;
      if (cur && gap <= 8) {
        const space = gap > 1 && !cur.s.endsWith(" ") && !it.s.startsWith(" ") ? " " : "";
        cur.s += space + it.s;
        cur.w = it.x + it.w - cur.x;
      } else {
        cur = { x: it.x, w: it.w, s: it.s };
        cells.push(cur);
      }
    });
    return cells.map((c) => c.s.trim());
  });
}

async function ensureText() {
  if (textPages) return;
  const pages = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    statusEl.textContent = "Reading page " + i + " of " + pdfDoc.numPages + "...";
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    pages.push(buildRows(content.items));
  }
  textPages = pages;
  const hasText = pages.some((rows) => rows.length > 0);
  if (!hasText) {
    textPages = null;
    throw new Error("No text found in this PDF. It looks scanned, so use the JPG or PNG option.");
  }
}

const lineText = (cells) => cells.join("  ");

const builders = {
  txt() {
    const text = textPages
      .map((rows, i) => "----- Page " + (i + 1) + " -----\n\n" + rows.map(lineText).join("\n"))
      .join("\n\n");
    return { data: text, mime: "text/plain", ext: "txt" };
  },
  md() {
    const text = textPages
      .map((rows, i) => "## Page " + (i + 1) + "\n\n" + rows.map(lineText).join("\n\n"))
      .join("\n\n");
    return { data: text, mime: "text/markdown", ext: "md" };
  },
  html() {
    const body = textPages
      .map((rows, i) => "<h2>Page " + (i + 1) + "</h2>\n" + rows.map((r) => "<p>" + esc(lineText(r)) + "</p>").join("\n"))
      .join("\n");
    const data = '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>' + esc(baseName()) +
      "</title></head><body>\n" + body + "\n</body></html>";
    return { data, mime: "text/html", ext: "html" };
  },
  doc() {
    const body = textPages
      .map((rows, i) =>
        (i > 0 ? '<br clear="all" style="page-break-before:always">' : "") +
        rows.map((r) => "<p>" + esc(lineText(r)) + "</p>").join("\n"))
      .join("\n");
    const data = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
      '<head><meta charset="UTF-8"><title>' + esc(baseName()) + "</title></head><body>\n" + body + "\n</body></html>";
    return { data, mime: "application/msword", ext: "doc" };
  },
  xls() {
    const body = textPages
      .map((rows, i) =>
        "<h3>Page " + (i + 1) + "</h3><table border=\"1\">" +
        rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
        "</table>")
      .join("\n");
    const data = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>\n' + body + "\n</body></html>";
    return { data, mime: "application/vnd.ms-excel", ext: "xls" };
  },
  csv() {
    const q = (c) => '"' + String(c).replace(/"/g, '""') + '"';
    const lines = [];
    textPages.forEach((rows, i) => {
      if (i > 0) lines.push("");
      rows.forEach((r) => lines.push(r.map(q).join(",")));
    });
    return { data: "\ufeff" + lines.join("\r\n"), mime: "text/csv", ext: "csv" };
  },
  json() {
    const obj = {
      file: pdfFile.name,
      pages: textPages.map((rows, i) => ({ page: i + 1, lines: rows.map(lineText), rows }))
    };
    return { data: JSON.stringify(obj, null, 2), mime: "application/json", ext: "json" };
  }
};

async function toImages(fmt) {
  const mime = fmt === "jpg" ? "image/jpeg" : "image/png";
  const blobs = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    statusEl.textContent = "Rendering page " + i + " of " + pdfDoc.numPages + "...";
    const page = await pdfDoc.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    blobs.push(await new Promise((resolve) => canvas.toBlob(resolve, mime, 0.92)));
  }
  if (blobs.length === 1) return { blob: blobs[0], name: baseName() + "." + fmt };
  if (typeof JSZip === "undefined") throw new Error("ZIP library did not load. Check internet and refresh.");
  const zip = new JSZip();
  blobs.forEach((b, i) => zip.file(baseName() + "-page-" + (i + 1) + "." + fmt, b));
  statusEl.textContent = "Creating ZIP...";
  const blob = await zip.generateAsync({ type: "blob" });
  return { blob, name: baseName() + "-images.zip" };
}

async function convert() {
  if (!pdfDoc) return;
  const fmt = formatSelect.value;
  convertBtn.disabled = true;
  downloadBtn.hidden = true;
  try {
    let out;
    if (fmt === "jpg" || fmt === "png") {
      out = await toImages(fmt);
    } else {
      await ensureText();
      const b = builders[fmt]();
      out = { blob: new Blob([b.data], { type: b.mime + ";charset=utf-8" }), name: baseName() + "." + b.ext };
    }
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    lastUrl = URL.createObjectURL(out.blob);
    downloadBtn.href = lastUrl;
    downloadBtn.download = out.name;
    downloadBtn.textContent = "Download " + out.name;
    downloadBtn.hidden = false;
    statusEl.textContent = "Done. " + out.name + " (" + formatSize(out.blob.size) + ")";
  } catch (error) {
    console.error(error);
    statusEl.textContent = error.message || "Conversion failed. Try another PDF.";
  } finally {
    convertBtn.disabled = false;
  }
}

async function handleFile(file) {
  if (!file || (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name))) {
    alert("Please select a PDF file.");
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch (error) {
    console.error(error);
    alert("This PDF could not be opened. It may be damaged or password protected.");
    return;
  }
  pdfFile = file;
  textPages = null;
  fileInfo.textContent = file.name + " - " + pdfDoc.numPages + " page(s), " + formatSize(file.size);
  statusEl.textContent = "";
  downloadBtn.hidden = true;
  dropzone.hidden = true;
  result.hidden = false;
}

function reset() {
  pdfDoc = null;
  pdfFile = null;
  textPages = null;
  fileInput.value = "";
  downloadBtn.hidden = true;
  statusEl.textContent = "";
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
formatSelect.addEventListener("change", () => { downloadBtn.hidden = true; statusEl.textContent = ""; });
convertBtn.addEventListener("click", convert);
resetBtn.addEventListener("click", reset);