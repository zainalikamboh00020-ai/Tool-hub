"use strict";

const $ = (id) => document.getElementById(id);
const canvas = $("logoCanvas");
const ctx = canvas.getContext("2d");
let brandImage = null;

const inputs = [
  "brandName", "tagline", "industry", "fontSelect", "textColor", "textSize",
  "iconType", "iconShape", "emojiInput", "iconColor", "iconTextColor",
  "layoutSelect", "bgColor", "bgTransparent", "languageSelect",
  "imageFit", "imageZoom", "imageX", "imageY", "imageRotation"
];

const designPresets = {
  modern: { label: "Modern", detail: "Clean and confident", font: "Arial, Helvetica, sans-serif", text: "#111827", icon: "#2563eb", shape: "rounded", layout: "horizontal" },
  luxury: { label: "Luxury", detail: "Elegant and premium", font: "Georgia, serif", text: "#2b2118", icon: "#b7791f", shape: "circle", layout: "stacked" },
  playful: { label: "Playful", detail: "Bright and welcoming", font: "'Trebuchet MS', sans-serif", text: "#172554", icon: "#ec4899", shape: "circle", layout: "stacked" },
  tech: { label: "Tech", detail: "Sharp and innovative", font: "Impact, Haettenschweiler, sans-serif", text: "#e0f2fe", icon: "#06b6d4", shape: "hexagon", layout: "horizontal", background: "#0f172a" }
};

const industryPresets = [
  { words: ["restaurant", "food", "cafe", "coffee", "bakery", "pizza", "kitchen", "ریستوران", "کھانا"], key: "food", icon: "emoji", emoji: "🍽️", color: "#c2410c", text: "#431407", shape: "circle" },
  { words: ["tech", "technology", "software", "app", "digital", "ai", "data", "cyber", "ٹیکنالوجی"], key: "tech", icon: "letter", color: "#06b6d4", text: "#e0f2fe", shape: "hexagon" },
  { words: ["fashion", "beauty", "salon", "makeup", "clothing", "boutique", "فیشن", "بیوٹی"], key: "fashion", icon: "letter", color: "#db2777", text: "#831843", shape: "circle" },
  { words: ["education", "school", "academy", "university", "course", "learning", "تعلیم", "سکول"], key: "education", icon: "emoji", emoji: "🎓", color: "#2563eb", text: "#172554", shape: "rounded" },
  { words: ["fitness", "gym", "sport", "yoga", "health", "ورزش", "جم"], key: "fitness", icon: "emoji", emoji: "💪", color: "#16a34a", text: "#14532d", shape: "rounded" },
  { words: ["law", "legal", "lawyer", "finance", "accounting", "insurance", "قانون", "فنانس"], key: "finance", icon: "letter", color: "#b7791f", text: "#2b2118", shape: "square" }
];

const platformSizes = {
  youtube: { width: 800, height: 800, label: "Square format for YouTube profile images." },
  "youtube-banner": { width: 2560, height: 1440, label: "Wide format for YouTube channel banners." },
  instagram: { width: 1080, height: 1080, label: "Square format for Instagram profile images and posts." },
  facebook: { width: 1024, height: 1024, label: "Square format for Facebook profile images." },
  tiktok: { width: 200, height: 200, label: "Compact square format for TikTok profiles." },
  linkedin: { width: 300, height: 300, label: "Square format for LinkedIn company or profile images." },
  website: { width: 512, height: 512, label: "High-resolution square format for websites and favicons." }
};

function detectStyle(name, industry) {
  const value = (name + " " + industry).toLowerCase();
  if (/(tech|software|digital|cyber|data|cloud|app|ai)/.test(value)) return "tech";
  if (/(lux|jewel|gold|royal|elite|premium|studio)/.test(value)) return "luxury";
  if (/(kids|fun|play|party|sweet|happy|joy)/.test(value)) return "playful";
  return "modern";
}

function detectIndustry(name, tagline, industry) {
  const value = (name + " " + tagline + " " + industry).toLowerCase();
  return industryPresets.find((preset) => preset.words.some((word) => value.includes(word)));
}

function getTextDirection() {
  const language = $("languageSelect").value;
  if (language === "rtl") return "rtl";
  if (language === "ltr" || language === "indic" || language === "cjk") return "ltr";
  const text = ($("brandName").value + " " + $("tagline").value);
  return /[\u0590-\u08ff]/.test(text) ? "rtl" : "ltr";
}

function getFontFamily() {
  const language = $("languageSelect").value;
  const selected = $("fontSelect").value;
  if (language === "rtl") return selected + ", Tahoma, Arial, sans-serif";
  if (language === "indic") return selected + ", Noto Sans Devanagari, Noto Sans Bengali, Mangal, Arial, sans-serif";
  if (language === "cjk") return selected + ", Noto Sans CJK SC, Microsoft YaHei, Meiryo, Arial, sans-serif";
  return selected;
}

function applyPreset(key) {
  const preset = designPresets[key];
  $("fontSelect").value = preset.font;
  $("textColor").value = preset.text;
  $("iconColor").value = preset.icon;
  $("iconShape").value = preset.shape;
  $("layoutSelect").value = preset.layout;
  $("bgTransparent").checked = !preset.background;
  if (preset.background) $("bgColor").value = preset.background;
  updateUI();
  draw();
  document.querySelectorAll(".design-option").forEach((option) => {
    option.classList.toggle("active", option.dataset.design === key);
  });
}

function createDesigns() {
  const mode = $("designMode").value;
  const industry = detectIndustry($("brandName").value, $("tagline").value, $("industry").value);
  const selected = mode === "auto" ? detectStyle($("brandName").value, $("industry").value) : mode;
  const keys = [selected, ...Object.keys(designPresets).filter((key) => key !== selected)];
  $("designGallery").innerHTML = keys.map((key) => {
    const preset = designPresets[key];
    return `<button type="button" class="design-option" data-design="${key}">
      <strong>${preset.label}</strong><small>${preset.detail}</small>
      <span class="design-swatches"><span class="design-swatch" style="background:${preset.icon}"></span><span class="design-swatch" style="background:${preset.text}"></span></span>
    </button>`;
  }).join("");
  document.querySelectorAll(".design-option").forEach((option) => {
    option.addEventListener("click", () => applyPreset(option.dataset.design));
  });
  applyPreset(selected);
  if (industry) {
    $("iconType").value = industry.icon;
    if (industry.emoji) $("emojiInput").value = industry.emoji;
    $("iconColor").value = industry.color;
    $("textColor").value = industry.text;
    $("iconShape").value = industry.shape;
    $("tagline").value = $("tagline").value || industry.key.charAt(0).toUpperCase() + industry.key.slice(1);
    updateUI();
    draw();
  }
}

/* ---------- Shapes ---------- */

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexPath(cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const px = cx + r * Math.cos(a);
    const py = cy + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawIcon(x, y, size) {
  const type = $("iconType").value;
  if (type === "none") return;

  const shape = $("iconShape").value;
  const cx = x + size / 2;
  const cy = y + size / 2;

  if (brandImage) {
    ctx.save();
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.clip();
    } else if (shape === "rounded") {
      roundRectPath(x, y, size, size, size * 0.24);
      ctx.clip();
    } else if (shape === "hexagon") {
      hexPath(cx, cy, size / 2);
      ctx.clip();
    } else if (shape === "square") {
      ctx.beginPath();
      ctx.rect(x, y, size, size);
      ctx.clip();
    }
    const fit = $("imageFit").value;
    const baseScale = fit === "contain"
      ? Math.min(size / brandImage.width, size / brandImage.height)
      : Math.max(size / brandImage.width, size / brandImage.height);
    const imageScale = baseScale * (Number($("imageZoom").value) / 100);
    const imageWidth = brandImage.width * imageScale;
    const imageHeight = brandImage.height * imageScale;
    const offsetX = (Number($("imageX").value) / 100) * size;
    const offsetY = (Number($("imageY").value) / 100) * size;
    ctx.translate(cx + offsetX, cy + offsetY);
    ctx.rotate(Number($("imageRotation").value) * Math.PI / 180);
    ctx.drawImage(brandImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight);
    ctx.restore();
    return;
  }

  if (shape !== "none") {
    ctx.fillStyle = $("iconColor").value;
    if (shape === "circle") {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    } else if (shape === "rounded") {
      roundRectPath(x, y, size, size, size * 0.24);
    } else if (shape === "square") {
      ctx.beginPath();
      ctx.rect(x, y, size, size);
    } else {
      hexPath(cx, cy, size / 2);
    }
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (type === "letter") {
    const name = $("brandName").value.trim();
    const letter = (name ? Array.from(name)[0] : "A").toUpperCase();
    ctx.fillStyle = shape === "none" ? $("iconColor").value : $("iconTextColor").value;
    ctx.font = "700 " + Math.round(size * 0.55) + "px " + $("fontSelect").value;
    ctx.fillText(letter, cx, cy + size * 0.03);
  } else {
    const emoji = $("emojiInput").value.trim() || "⭐";
    ctx.font = Math.round(size * 0.52) + "px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
    ctx.fillStyle = "#000000";
    ctx.fillText(emoji, cx, cy + size * 0.03);
  }
}

/* ---------- Text helpers ---------- */

function fitFont(text, weight, family, size, maxWidth) {
  ctx.font = weight + " " + size + "px " + family;
  const w = ctx.measureText(text).width;
  if (w > maxWidth) size = Math.floor(size * (maxWidth / w));
  return size;
}

/* ---------- Main draw ---------- */

function draw() {
  const layout = $("layoutSelect").value;
  const horizontal = layout === "horizontal";
  const platform = platformSizes[$("platformSelect").value] || platformSizes.youtube;
  const W = platform.width;
  const H = platform.height;
  canvas.width = W;
  canvas.height = H;

  if (!$("bgTransparent").checked) {
    ctx.fillStyle = $("bgColor").value;
    ctx.fillRect(0, 0, W, H);
  }

  const family = getFontFamily();
  const direction = getTextDirection();
  const scale = Number($("textSize").value) / 100;
  const name = $("brandName").value.trim() || "Your Brand";
  const tag = $("tagline").value.trim();
  const hasIcon = $("iconType").value !== "none";
  const iconSize = horizontal ? 220 : 240;
  const gap = horizontal ? 40 : 36;

  const maxTextW = horizontal ? W - iconSize - gap - 120 : W - 100;
  const nameSize = fitFont(name, 700, family, Math.round((horizontal ? 110 : 100) * scale), maxTextW);
  const tagSize = Math.max(16, fitFont(tag, 400, family, Math.round(nameSize * 0.32), maxTextW));

  ctx.font = "700 " + nameSize + "px " + family;
  const nameW = ctx.measureText(name).width;
  ctx.font = "400 " + tagSize + "px " + family;
  const tagW = tag ? ctx.measureText(tag).width : 0;
  const textW = Math.max(nameW, tagW);
  const textH = nameSize + (tag ? tagSize * 1.4 : 0);

  const drawText = (left, top, align) => {
    const x = align === "center" ? left : left;
    ctx.textAlign = align;
    ctx.textBaseline = "top";
    ctx.direction = direction;
    ctx.fillStyle = $("textColor").value;
    ctx.font = "700 " + nameSize + "px " + family;
    ctx.fillText(name, x, top);
    if (tag) {
      ctx.globalAlpha = 0.7;
      ctx.font = "400 " + tagSize + "px " + family;
      ctx.fillText(tag, x, top + nameSize * 1.15);
      ctx.globalAlpha = 1;
    }
  };

  if (horizontal) {
    const totalW = (hasIcon ? iconSize + gap : 0) + textW;
    const startX = (W - totalW) / 2;
    if (hasIcon) drawIcon(startX, (H - iconSize) / 2, iconSize);
    const textX = startX + (hasIcon ? iconSize + gap : 0);
    drawText(textX, (H - textH) / 2, "left");
  } else {
    const totalH = (hasIcon ? iconSize + gap : 0) + textH;
    const startY = (H - totalH) / 2;
    if (hasIcon) drawIcon((W - iconSize) / 2, startY, iconSize);
    drawText(W / 2, startY + (hasIcon ? iconSize + gap : 0), "center");
  }
}

/* ---------- Events ---------- */

function updateUI() {
  $("emojiWrap").hidden = $("iconType").value !== "emoji";
  $("textSizeVal").textContent = $("textSize").value;
  $("bgColor").disabled = $("bgTransparent").checked;
  const platform = platformSizes[$("platformSelect").value] || platformSizes.youtube;
  $("platformInfo").textContent = platform.label + " Output: " + platform.width + " × " + platform.height + " px.";
  $("imageControls").hidden = !brandImage;
  $("imageZoomVal").textContent = $("imageZoom").value;
  $("imageRotationVal").textContent = $("imageRotation").value;
}

function generateLogo() {
  createDesigns();
}

inputs.forEach((id) => {
  const el = $(id);
  el.addEventListener("input", () => { updateUI(); draw(); });
  el.addEventListener("change", () => { updateUI(); draw(); });
});

$("generateBtn").addEventListener("click", generateLogo);
$("platformSelect").addEventListener("change", generateLogo);
$("createDesignsBtn").addEventListener("click", createDesigns);
$("brandImage").addEventListener("change", (event) => {
  const file = event.target.files[0];
  if (!file) {
    brandImage = null;
    updateUI();
    draw();
    return;
  }
  const image = new Image();
  image.onload = () => {
    brandImage = image;
    updateUI();
    draw();
    URL.revokeObjectURL(image.src);
  };
  image.onerror = () => {
    brandImage = null;
    event.target.value = "";
    window.alert("The selected image could not be loaded. Please choose a PNG, JPG, or WebP image.");
  };
  image.src = URL.createObjectURL(file);
});

$("resetImageBtn").addEventListener("click", () => {
  $("imageFit").value = "cover";
  $("imageZoom").value = "100";
  $("imageX").value = "0";
  $("imageY").value = "0";
  $("imageRotation").value = "0";
  updateUI();
  draw();
});

$("downloadBtn").addEventListener("click", () => {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const clean = $("brandName").value.trim().replace(/[^\w\- ]+/g, "").replace(/\s+/g, "-");
    a.href = url;
    const platform = $("platformSelect").value;
    a.download = (clean || "logo") + "-" + platform + "-logo.png";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, "image/png");
});

updateUI();
draw();