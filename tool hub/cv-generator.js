"use strict";

const $ = (id) => document.getElementById(id);
const form = $("cvForm");
const preview = $("cvPreview");
const previewWrap = $("previewWrap");
const statusEl = $("status");
const eduList = $("eduList");
const expList = $("expList");

let photo = null; // JPEG data URI (square cropped)
let renderTimer = null;

function esc(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const nl2br = (s) => esc(s).replace(/\r?\n/g, "<br>");
const lines = (s) => String(s || "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
const list = (s) => String(s || "").split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
const bullet = (s) => s.replace(/^[-\u2022*]\s*/, "");

/* ---------- Dynamic rows ---------- */

function addRow(container, fields, values) {
  const box = document.createElement("div");
  box.className = "cv-row-box";
  const grid = document.createElement("div");
  grid.className = "cvf-grid";
  fields.forEach((f) => {
    const el = document.createElement(f.area ? "textarea" : "input");
    if (!f.area) el.type = "text";
    el.dataset.k = f.key;
    el.placeholder = f.label;
    if (f.full) el.className = "full";
    if (values && values[f.key]) el.value = values[f.key];
    grid.appendChild(el);
  });
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "cvf-remove";
  remove.textContent = "Remove";
  box.appendChild(grid);
  box.appendChild(remove);
  container.appendChild(box);
}

const eduFields = [
  { key: "degree", label: "Degree (e.g. BS Computer Science)", full: true },
  { key: "institute", label: "University / School" },
  { key: "year", label: "Year (e.g. 2018 - 2022)" },
  { key: "grade", label: "Grade / CGPA (optional)", full: true }
];
const expFields = [
  { key: "role", label: "Job title" },
  { key: "company", label: "Company" },
  { key: "period", label: "Period (e.g. Jan 2022 - Present)", full: true },
  { key: "details", label: "What you did (one point per line)", full: true, area: true }
];

function getRows(container) {
  return Array.from(container.children)
    .map((box) => {
      const o = {};
      box.querySelectorAll("[data-k]").forEach((el) => { o[el.dataset.k] = el.value.trim(); });
      return o;
    })
    .filter((o) => Object.values(o).some(Boolean));
}

function collect() {
  return {
    name: $("fullName").value.trim(),
    title: $("jobTitle").value.trim(),
    email: $("email").value.trim(),
    phone: $("phone").value.trim(),
    address: $("address").value.trim(),
    website: $("website").value.trim(),
    summary: $("summary").value.trim(),
    skills: list($("skills").value),
    languages: list($("languages").value),
    certs: lines($("certs").value),
    edu: getRows(eduList),
    exp: getRows(expList)
  };
}

/* ---------- CV building blocks ---------- */

function cvCss(c) {
  return `
.cv-root{font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.45;color:#1f2937;width:794px;background:#ffffff}
.cv-root table{border-collapse:collapse;width:100%}
.cv-root td{vertical-align:top;padding:0}
.cv-root p,.cv-root ul{margin:0;padding:0}
.cv-root ul{margin-left:16px;margin-top:3px}
.cv-root li{margin-bottom:2px}
.cv-name{font-size:30px;font-weight:bold;line-height:1.15}
.cv-title{font-size:15px;margin-top:4px}
.cv-h{font-size:13px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin:18px 0 8px 0;padding-bottom:3px;color:${c};border-bottom:1px solid #d1d5db}
.cv-side .cv-h{color:#ffffff;border-bottom:1px solid #ffffff}
.cv-minimal .cv-h{color:#6b7280;font-weight:normal;border-bottom:1px solid #e5e7eb}
.cv-item{margin-bottom:10px}
.cv-row{font-weight:bold;font-size:12.5px}
.cv-date{text-align:right;white-space:nowrap;color:#6b7280;width:130px}
.cv-sub{color:#6b7280}
.cv-line{margin-bottom:4px}
`;
}

const photoTag = (src, size) =>
  `<img src="${src}" width="${size}" height="${size}" alt="" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;display:block;margin:0 auto">`;

const contactItems = (d) => [d.email, d.phone, d.address, d.website].filter(Boolean);

function secSummary(d) {
  return d.summary ? `<div class="cv-h">Profile</div><p>${nl2br(d.summary)}</p>` : "";
}

function secExp(d) {
  if (!d.exp.length) return "";
  return `<div class="cv-h">Experience</div>` + d.exp.map((e) => {
    const head = [e.role, e.company].filter(Boolean).map(esc).join(" - ");
    const points = lines(e.details);
    return `<div class="cv-item"><table><tr><td class="cv-row">${head}</td><td class="cv-date">${esc(e.period)}</td></tr></table>` +
      (points.length ? `<ul>${points.map((b) => `<li>${esc(bullet(b))}</li>`).join("")}</ul>` : "") + `</div>`;
  }).join("");
}

function secEdu(d) {
  if (!d.edu.length) return "";
  return `<div class="cv-h">Education</div>` + d.edu.map((e) => {
    const sub = [e.institute, e.grade].filter(Boolean).map(esc).join(" | ");
    return `<div class="cv-item"><table><tr><td class="cv-row">${esc(e.degree)}</td><td class="cv-date">${esc(e.year)}</td></tr></table>` +
      (sub ? `<div class="cv-sub">${sub}</div>` : "") + `</div>`;
  }).join("");
}

function secCerts(d) {
  return d.certs.length
    ? `<div class="cv-h">Certifications</div><ul>${d.certs.map((x) => `<li>${esc(bullet(x))}</li>`).join("")}</ul>`
    : "";
}

function secContact(d) {
  const items = contactItems(d);
  return items.length ? `<div class="cv-h">Contact</div>` + items.map((x) => `<p class="cv-line">${esc(x)}</p>`).join("") : "";
}

function secSkills(d) {
  return d.skills.length ? `<div class="cv-h">Skills</div>` + d.skills.map((x) => `<p class="cv-line">${esc(x)}</p>`).join("") : "";
}

function secLang(d) {
  return d.languages.length ? `<div class="cv-h">Languages</div>` + d.languages.map((x) => `<p class="cv-line">${esc(x)}</p>`).join("") : "";
}

function secSkillsInline(d) {
  return d.skills.length ? `<div class="cv-h">Skills</div><p>${d.skills.map(esc).join("  |  ")}</p>` : "";
}

function secLangInline(d) {
  return d.languages.length ? `<div class="cv-h">Languages</div><p>${d.languages.map(esc).join("  |  ")}</p>` : "";
}

function cvBody(d, t, c, p) {
  const name = esc(d.name);
  const title = d.title ? `<div class="cv-title">${esc(d.title)}</div>` : "";
  const contactLine = contactItems(d).map(esc).join("  |  ");
  let inner = "";

  if (t === "modern") {
    inner = `<table style="height:1123px"><tr>
<td class="cv-side" style="width:250px;background:${c};color:#ffffff;padding:34px 22px">
${p ? `<div style="margin-bottom:10px">${photoTag(p, 120)}</div>` : ""}
${secContact(d)}${secSkills(d)}${secLang(d)}
</td>
<td style="padding:38px 32px">
<div class="cv-name" style="color:${c}">${name}</div>${title}
${secSummary(d)}${secExp(d)}${secEdu(d)}${secCerts(d)}
</td></tr></table>`;
  } else if (t === "classic") {
    inner = `<div style="padding:40px 46px">
<table><tr><td>
<div class="cv-name" style="color:${c}">${name}</div>${title}
<div class="cv-sub" style="margin-top:6px">${contactLine}</div>
</td>${p ? `<td style="width:130px">${photoTag(p, 110)}</td>` : ""}</tr></table>
<div style="border-top:3px solid ${c};font-size:1px;line-height:1px;margin-top:14px">&nbsp;</div>
${secSummary(d)}${secExp(d)}${secEdu(d)}${secSkillsInline(d)}${secLangInline(d)}${secCerts(d)}
</div>`;
  } else if (t === "minimal") {
    inner = `<div style="padding:44px 50px">
<table><tr><td>
<div class="cv-name" style="font-weight:normal;color:#111827;letter-spacing:1px">${name}</div>
${d.title ? `<div class="cv-title" style="color:${c}">${esc(d.title)}</div>` : ""}
<div class="cv-sub" style="margin-top:8px">${contactLine}</div>
</td>${p ? `<td style="width:120px">${photoTag(p, 100)}</td>` : ""}</tr></table>
${secSummary(d)}${secExp(d)}${secEdu(d)}${secSkillsInline(d)}${secLangInline(d)}${secCerts(d)}
</div>`;
  } else {
    inner = `<table><tr><td style="background:${c};color:#ffffff;padding:30px 40px">
<table><tr>${p ? `<td style="width:140px">${photoTag(p, 110)}</td>` : ""}
<td style="vertical-align:middle"><div class="cv-name" style="color:#ffffff">${name}</div>${d.title ? `<div class="cv-title" style="color:#ffffff">${esc(d.title)}</div>` : ""}</td></tr></table>
</td></tr></table>
<table style="height:900px"><tr>
<td style="padding:8px 28px 30px 40px">${secSummary(d)}${secExp(d)}${secEdu(d)}</td>
<td style="width:250px;background:#f3f4f6;padding:8px 24px 30px 24px">${secContact(d)}${secSkills(d)}${secLang(d)}${secCerts(d)}</td>
</tr></table>`;
  }

  return `<div class="cv-root cv-${t}">${inner}</div>`;
}

/* ---------- Preview ---------- */

function currentView() {
  const d = collect();
  return { d, t: $("template").value, c: $("accent").value };
}

function fitPreview() {
  const w = previewWrap.clientWidth - 24;
  preview.style.zoom = w > 0 ? Math.min(1, w / 794) : 1;
}

function render() {
  const { d, t, c } = currentView();
  const view = Object.assign({}, d, { name: d.name || "Your Name" });
  preview.innerHTML = `<style>${cvCss(c)}</style>` + cvBody(view, t, c, photo);
  fitPreview();
}

function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(render, 120);
}

/* ---------- Photo ---------- */

$("photoInput").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }
  const img = new Image();
  img.onload = () => {
    const side = Math.min(img.width, img.height);
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 400, 400);
    ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 400, 400);
    photo = canvas.toDataURL("image/jpeg", 0.9);
    URL.revokeObjectURL(img.src);
    $("photoThumb").src = photo;
    $("photoThumb").hidden = false;
    $("removePhoto").hidden = false;
    render();
  };
  img.onerror = () => alert("This image could not be read. Try another photo.");
  img.src = URL.createObjectURL(file);
});

$("removePhoto").addEventListener("click", () => {
  photo = null;
  $("photoInput").value = "";
  $("photoThumb").hidden = true;
  $("removePhoto").hidden = true;
  render();
});

/* ---------- Downloads ---------- */

function setStatus(text) {
  statusEl.textContent = text;
}

function fileBase(d) {
  const clean = d.name.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-");
  return (clean || "My") + "-CV";
}

function saveBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function needName(d) {
  if (d.name) return false;
  setStatus("Please enter your full name first.");
  $("fullName").focus();
  return true;
}

async function downloadPdf() {
  const { d, t, c } = currentView();
  if (needName(d)) return;
  if (typeof html2pdf === "undefined") {
    setStatus("PDF library did not load. Check internet and refresh.");
    return;
  }
  const btn = $("pdfBtn");
  btn.disabled = true;
  setStatus("Creating PDF...");
  const stage = document.createElement("div");
  stage.style.cssText = "position:fixed;top:0;left:0;width:794px;background:#ffffff;z-index:-1;pointer-events:none";
  stage.innerHTML = `<style>${cvCss(c)}</style>` + cvBody(d, t, c, photo);
  document.body.appendChild(stage);
  try {
    await html2pdf()
      .set({
        margin: 0,
        filename: fileBase(d) + ".pdf",
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, windowWidth: 794 },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"], avoid: [".cv-item"] }
      })
      .from(stage)
      .save();
    setStatus("PDF downloaded.");
  } catch (error) {
    console.error(error);
    setStatus("PDF could not be created. Please try again.");
  } finally {
    stage.remove();
    btn.disabled = false;
  }
}

function downloadWord() {
  const { d, t, c } = currentView();
  if (needName(d)) return;

  const body = cvBody(d, t, c, photo ? "photo.jpg" : null);
  const html =
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">' +
    '<head><meta charset="utf-8"><title>' + esc(d.name) + " CV</title>" +
    "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->" +
    "<style>@page WordSection1{size:595.3pt 841.9pt;margin:0cm}div.WordSection1{page:WordSection1}body{margin:0}" + cvCss(c) + "</style></head>" +
    '<body><div class="WordSection1">' + body + "</div></body></html>";

  const wrap = (s) => s.replace(/.{76}/g, "$&\r\n");
  const htmlB64 = wrap(btoa(unescape(encodeURIComponent(html))));
  const boundary = "----=_ToolHubCV";

  let mht = [
    "MIME-Version: 1.0",
    'Content-Type: multipart/related; boundary="' + boundary + '"; type="text/html"',
    "",
    "--" + boundary,
    'Content-Type: text/html; charset="utf-8"',
    "Content-Transfer-Encoding: base64",
    "Content-Location: file:///C:/cv.htm",
    "",
    htmlB64,
    ""
  ].join("\r\n");

  if (photo) {
    mht += [
      "--" + boundary,
      "Content-Type: image/jpeg",
      "Content-Transfer-Encoding: base64",
      "Content-Location: file:///C:/photo.jpg",
      "",
      wrap(photo.split(",")[1]),
      ""
    ].join("\r\n");
  }
  mht += "--" + boundary + "--\r\n";

  saveBlob(new Blob([mht], { type: "application/msword" }), fileBase(d) + ".doc");
  setStatus("Word file downloaded. Open it in Microsoft Word.");
}

/* ---------- Events ---------- */

form.addEventListener("input", scheduleRender);
form.addEventListener("change", scheduleRender);
form.addEventListener("submit", (e) => e.preventDefault());
form.addEventListener("click", (e) => {
  if (e.target.classList.contains("cvf-remove")) {
    e.target.closest(".cv-row-box").remove();
    render();
  }
});

$("addEdu").addEventListener("click", () => addRow(eduList, eduFields));
$("addExp").addEventListener("click", () => addRow(expList, expFields));
$("pdfBtn").addEventListener("click", downloadPdf);
$("wordBtn").addEventListener("click", downloadWord);
window.addEventListener("resize", fitPreview);

addRow(eduList, eduFields);
addRow(expList, expFields);
render();