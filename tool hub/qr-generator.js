
"use strict";

/*
  SUPABASE SETUP:
  1. Create a Supabase project.
  2. Create a PUBLIC Storage bucket named: toolhub-files
  3. Configure Storage policies to allow uploads to that bucket.
  4. Add your Project URL and publishable/anon key below.

  Never put a Supabase service_role key in browser JavaScript.
*/

const SUPABASE_URL = "PASTE_YOUR_SUPABASE_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY_HERE";
const STORAGE_BUCKET = "toolhub-files";

const buttons = document.querySelectorAll(".qr-type");
const forms = document.querySelectorAll(".qr-form");

const qrResult = document.getElementById("qrResult");
const qrOutput = document.getElementById("qrOutput");
const qrDescription = document.getElementById("qrDescription");
const qrStatus = document.getElementById("qrStatus");
const downloadButton = document.getElementById("downloadQR");
const uploadButton = document.getElementById("uploadButton");

let currentQRType = "website";

const formIds = {
  website: "websiteForm",
  text: "textForm",
  wifi: "wifiForm",
  file: "fileForm",
  contact: "contactForm",
  email: "emailForm",
  phone: "phoneForm",
  sms: "smsForm",
  location: "locationForm"
};

buttons.forEach((button) => {
  button.addEventListener("click", () => {
    const type = button.dataset.type;
    currentQRType = type;

    buttons.forEach((item) => item.classList.remove("active"));
    forms.forEach((form) => form.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(formIds[type]).classList.add("active");

    qrResult.classList.add("qr-hidden");
    qrOutput.innerHTML = "";
    qrStatus.textContent = "";
  });
});

function makeQR(value, description) {
  const text = String(value).trim();

  if (!text) {
    alert("Please enter the required information.");
    return;
  }

  if (typeof QRCode === "undefined") {
    alert("QR library load nahi hui. Internet check karke page refresh karein.");
    return;
  }

  qrOutput.innerHTML = "";
  qrResult.classList.remove("qr-hidden");

  try {
    new QRCode(qrOutput, {
      text,
      width: 260,
      height: 260,
      colorDark: "#111827",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.M
    });

    qrDescription.textContent = description;
    qrStatus.textContent = "QR generated. Scan it to test before sharing.";
  } catch (error) {
    console.error(error);
    qrStatus.textContent = "QR generate nahi ho saka. Dobara try karein.";
  }

  qrResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function validURL(value) {
  try {
    const url = new URL(value.trim());
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function escapeWifi(value) {
  return String(value).replace(/([\\;,:"])/g, "\\$1");
}

// Website
document.getElementById("websiteForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const url = validURL(document.getElementById("websiteUrl").value);

  if (!url) {
    alert("Enter a valid URL beginning with https:// or http://");
    return;
  }

  makeQR(url, "Scan to open the website.");
});

// Text
document.getElementById("textForm").addEventListener("submit", (event) => {
  event.preventDefault();
  makeQR(
    document.getElementById("textValue").value,
    "Scan to read this text."
  );
});

// Wi-Fi
document.getElementById("wifiForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const ssid = document.getElementById("wifiSSID").value;
  const password = document.getElementById("wifiPassword").value;
  const security = document.getElementById("wifiSecurity").value;

  if (!ssid.trim()) {
    alert("Enter your Wi-Fi name.");
    return;
  }

  if (security !== "nopass" && !password) {
    alert("Enter your Wi-Fi password.");
    return;
  }

  const wifi =
    `WIFI:T:${security};S:${escapeWifi(ssid)};P:${security === "nopass" ? "" : escapeWifi(password)};;`;

  makeQR(wifi, "Scan with a compatible phone to connect to Wi-Fi.");
});

// Supabase file upload and QR
document.getElementById("fileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.getElementById("fileInput");
  const file = input.files[0];

  if (!file) {
    alert("Select a file first.");
    return;
  }

  if (
    SUPABASE_URL.includes("PASTE_YOUR") ||
    SUPABASE_ANON_KEY.includes("PASTE_YOUR")
  ) {
    alert(
      "Supabase abhi configure nahi hua. Pehle Supabase project URL, key, bucket aur upload policy set karein."
    );
    return;
  }

  // Default 25 MB browser upload limit for this example.
  if (file.size > 25 * 1024 * 1024) {
    alert("Please select a file smaller than 25 MB.");
    return;
  }

  uploadButton.disabled = true;
  uploadButton.textContent = "Uploading...";
  qrStatus.textContent = "File upload ho rahi hai...";

  try {
    const cleanName = file.name
      .normalize("NFKD")
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .slice(-100);

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}-${cleanName}`;

    const objectPath = `uploads/${uniqueName}`;
    const encodedPath = objectPath
      .split("/")
      .map(encodeURIComponent)
      .join("/");

    const uploadURL =
      `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${STORAGE_BUCKET}/${encodedPath}`;

    const response = await fetch(uploadURL, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false"
      },
      body: file
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Upload failed (${response.status}): ${details}`);
    }

    const publicURL =
      `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${STORAGE_BUCKET}/${encodedPath}`;

    makeQR(
      publicURL,
      `${file.name} uploaded. Scan to open or download the file.`
    );

    qrStatus.textContent =
      "Upload complete. Test the QR on another device to verify the public link.";
  } catch (error) {
    console.error(error);
    qrStatus.textContent =
      `Upload failed: ${error.message}. Check your bucket, upload policy, URL and key.`;
    alert("File upload failed. Supabase configuration aur storage policies check karein.");
  } finally {
    uploadButton.disabled = false;
    uploadButton.textContent = "Upload File and Generate QR";
  }
});

// Contact card
document.getElementById("contactForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const name = document.getElementById("contactName").value.trim();
  const phone = document.getElementById("contactPhone").value.trim();
  const email = document.getElementById("contactEmail").value.trim();

  const escapeVCard = (value) =>
    value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n")
      .replace(/,/g, "\\,").replace(/;/g, "\\;");

  const vcard = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(name)}`,
    phone ? `TEL:${escapeVCard(phone)}` : "",
    email ? `EMAIL:${escapeVCard(email)}` : "",
    "END:VCARD"
  ].filter(Boolean).join("\r\n");

  makeQR(vcard, "Scan to view or save this contact.");
});

// Email
document.getElementById("emailForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const to = document.getElementById("emailTo").value.trim();
  const subject = document.getElementById("emailSubject").value;
  const body = document.getElementById("emailBody").value;

  makeQR(
    `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    "Scan to open an email draft."
  );
});

// Phone
document.getElementById("phoneForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const phone = document.getElementById("phoneNumber").value.trim();

  if (!phone) {
    alert("Enter a phone number.");
    return;
  }

  makeQR(`tel:${phone}`, "Scan to open the phone dialer.");
});

// SMS
document.getElementById("smsForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const phone = document.getElementById("smsNumber").value.trim();
  const message = document.getElementById("smsMessage").value;

  if (!phone || !message.trim()) {
    alert("Enter both the phone number and message.");
    return;
  }

  makeQR(
    `SMSTO:${phone}:${message}`,
    "Scan to prepare an SMS on a compatible device."
  );
});

// Location
document.getElementById("locationForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const url = validURL(document.getElementById("locationUrl").value);

  if (!url) {
    alert("Enter a valid Google Maps link.");
    return;
  }

  makeQR(url, "Scan to open this location.");
});

// Download QR PNG
downloadButton.addEventListener("click", () => {
  const canvas = qrOutput.querySelector("canvas");
  const image = qrOutput.querySelector("img");

  let imageURL;

  if (canvas) {
    imageURL = canvas.toDataURL("image/png");
  } else if (image && image.src) {
    imageURL = image.src;
  } else {
    alert("Generate a QR code first.");
    return;
  }

  const link = document.createElement("a");
  link.href = imageURL;
  link.download = `toolhub-${currentQRType}-qr.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
});
