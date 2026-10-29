"use strict";

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

let docxFile = null;
let docData = null;
let lastUrl = null;

function formatSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

function baseName() {
  return docxFile.name.replace(/\.docx$/i, "") || "document";
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function loadDoc() {
  if (docData) return docData;
  statusEl.textContent = "Reading document...";
  const arrayBuffer = await docxFile.arrayBuffer();
  const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
  const textResult = await mammoth.extractRawText({ arrayBuffer });
  docData = { html: htmlResult.value, text: textResult.value.trim() };
  if (!docData.text && !docData.html) throw new Error("This document is empty.");
  return docData;
}

function getTables(html) {
  const dom = new DOMParser().parseFromString(html, "text/html");
  return Array.from(dom.querySelectorAll("table")).map((table) =>
    Array.from(table.querySelectorAll("tr")).map((tr) =>
      Array.from(tr.children).map((cell) => cell.textContent.trim())
    )
  );
}

function mdNode(node) {
  if (node.nodeType === 3) return node.textContent.replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  const kids = () => Array.from(node.childNodes).map(mdNode).join("");
  switch (tag) {
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      return "\n\n" + "#".repeat(Number(tag[1])) + " " + kids().trim() + "\n\n";
    case "p":
      return "\n\n" + kids().trim() + "\n\n";
    case "strong": case "b": {
      const t = kids().trim();
      return t ? "**" + t + "**" : "";
    }
    case "em": case "i": {
      const t = kids().trim();
      return t ? "*" + t + "*" : "";
    }
    case "a":
      return "[" + kids() + "](" + (node.getAttribute("href") || "") + ")";
    case "br":
      return "  \n";
    case "img":
      return "![image]()";
    case "ul": case "ol": {
      let n = 0;
      const items = Array.from(node.children).map((li) => {
        n++;
        return (tag === "ol" ? n + ". " : "- ") + mdNode(li).trim();
      });
      return "\n\n" + items.join("\n") + "\n\n";
    }
    case "table": {
      const rows = Array.from(node.querySelectorAll("tr")).map((tr) =>
        Array.from(tr.children).map((c) => c.textContent.trim().replace(/\|/g, "\\|").replace(/\s+/g, " "))
      );
      if (!rows.length) return "";
      const cols = Math.max(...rows.map((r) => r.length));
      const line = (r) => "| " + Array.from({ length: cols }, (_, i) => r[i] || "").join(" | ") + " |";
      const sep = "| " + Array.from({ length: cols }, () => "---").join(" | ") + " |";
      return "\n\n" + [line(rows[0]), sep, ...rows.slice(1).map(line)].join("\n") + "\n\n";
    }
    default:
      return kids();
  }
}

function toMarkdown(html) {
  const dom = new DOMParser().parseFromString(html, "text/html");
  return mdNode(dom.body).replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

const pageStyle =
  "body{font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#111;max-width:800px;margin:30px auto;padding:0 20px}" +
  "table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #999;padding:5px 8px}img{max-width:100%}";

async function buildPdf(html) {
  if (typeof html2pdf === "undefined") throw new Error("PDF library did not load. Check internet and refresh.");
  statusEl.textContent = "Creating PDF...";
  const stage = document.createElement("div");
  stage.style.cssText =
    "position:fixed;top:0;left:0;width:794px;padding:0;background:#fff;color:#111;z-index:-1;pointer-events:none;" +
    "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6";
  stage.innerHTML =
    "<style>.pdf-stage table{border-collapse:collapse;margin:10px 0}.pdf-stage td,.pdf-stage th{border:1px solid #999;padding:4px 6px}" +
    ".pdf-stage img{max-width:100%}</style><div class=\"pdf-stage\">" + html + "</div>";
  document.body.appendChild(stage);
  try {
    const blob = await html2pdf()
      .set({
        margin: 15,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] }
      })
      .from(stage)
      .outputPdf("blob");
    return { blob, name: baseName() + ".pdf" };
  } finally {
    stage.remove();
  }
}

function tableOutput(tables, type) {
  if (!tables.length) throw new Error("No tables found in this document.");
  if (type === "csv") {
    const q = (c) => '"' + String(c).replace(/"/g, '""') + '"';
    const lines = [];
    tables.forEach((rows, i) => {
      if (i > 0) lines.push("");
      rows.forEach((r) => lines.push(r.map(q).join(",")));
    });
    return { data: "\ufeff" + lines.join("\r\n"), mime: "text/csv", ext: "csv" };
  }
  const body = tables
    .map((rows, i) =>
      "<h3>Table " + (i + 1) + "</h3><table border=\"1\">" +
      rows.map((r) => "<tr>" + r.map((c) => "<td>" + esc(c) + "</td>").join("") + "</tr>").join("") +
      "</table>")
    .join("\n");
  const data = '<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="UTF-8"></head><body>\n' + body + "\n</body></html>";
  return { data, mime: "application/vnd.ms-excel", ext: "xls" };
}

async function convert() {
  if (!docxFile) return;
  const fmt = formatSelect.value;
  convertBtn.disabled = true;
  downloadBtn.hidden = true;
  try {
    const doc = await loadDoc();
    let out;

    if (fmt === "pdf") {
      out = await buildPdf(doc.html);
    } else {
      let b;
      if (fmt === "txt") {
        b = { data: doc.text, mime: "text/plain", ext: "txt" };
      } else if (fmt === "html") {
        b = {
          data: '<!DOCTYPE html>\n<html><head><meta charset="UTF-8"><title>' + esc(baseName()) +
            "</title><style>" + pageStyle + "</style></head><body>\n" + doc.html + "\n</body></html>",
          mime: "text/html",
          ext: "html"
        };
      } else if (fmt === "md") {
        b = { data: toMarkdown(doc.html), mime: "text/markdown", ext: "md" };
      } else if (fmt === "json") {
        const obj = {
          file: docxFile.name,
          text: doc.text,
          paragraphs: doc.text.split(/\n+/).filter(Boolean),
          tables: getTables(doc.html),
          html: doc.html
        };
        b = { data: JSON.stringify(obj, null, 2), mime: "application/json", ext: "json" };
      } else {
        b = tableOutput(getTables(doc.html), fmt);
      }
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
    statusEl.textContent = error.message || "Conversion failed. Try another file.";
  } finally {
    convertBtn.disabled = false;
  }
}

function handleFile(file) {
  if (!file) return;
  if (!/\.docx$/i.test(file.name)) {
    alert("Please select a .docx file. For old .doc files, save them as .docx in Word first.");
    return;
  }
  docxFile = file;
  docData = null;
  fileInfo.textContent = file.name + " - " + formatSize(file.size);
  statusEl.textContent = "";
  downloadBtn.hidden = true;
  dropzone.hidden = true;
  result.hidden = false;
}

function reset() {
  docxFile = null;
  docData = null;
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