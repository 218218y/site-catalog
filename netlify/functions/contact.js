const DEFAULT_TO_EMAIL = "bargig218@gmail.com";
const MAX_BODY_BYTES = 24 * 1024;

function jsonResponse(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(payload)
  };
}

function readHeader(headers, name) {
  const key = Object.keys(headers || {}).find((item) => item.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : "";
}

function parseFormBody(event) {
  const body = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");

  if (Buffer.byteLength(body, "utf8") > MAX_BODY_BYTES) {
    const error = new Error("ההודעה גדולה מדי לשליחה.");
    error.statusCode = 413;
    throw error;
  }

  const contentType = readHeader(event.headers, "content-type").split(";", 1)[0].trim().toLowerCase();

  if (contentType === "application/json") {
    return JSON.parse(body || "{}");
  }

  if (contentType === "application/x-www-form-urlencoded" || contentType === "multipart/form-data") {
    const params = new URLSearchParams(body);
    return Object.fromEntries(params.entries());
  }

  return JSON.parse(body || "{}");
}

function cleanText(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function cleanMessage(value, maxLength) {
  return String(value || "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim()
    .slice(0, maxLength);
}

function isValidEmail(value) {
  const email = String(value || "").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeSubmission(raw) {
  return {
    email: cleanText(raw.email, 254).toLowerCase(),
    phone: cleanText(raw.phone, 40),
    subject: cleanText(raw.subject, 120),
    message: cleanMessage(raw.message, 4000),
    botField: cleanText(raw.botField || raw["bot-field"] || raw.website, 200)
  };
}

function validateSubmission(submission) {
  if (submission.botField) return "bot";
  if (!submission.email) return "חובה למלא מייל לחזרה.";
  if (!isValidEmail(submission.email)) return "המייל לחזרה לא נראה תקין.";
  if (!submission.subject || submission.subject.length < 3) return "חובה למלא נושא של לפחות 3 תווים.";
  if (!submission.message || submission.message.length < 10) return "חובה למלא הודעה של לפחות 10 תווים.";
  return "";
}

function buildEmail(submission) {
  const toEmail = process.env.CONTACT_TO_EMAIL || DEFAULT_TO_EMAIL;
  const fromEmail = process.env.CONTACT_FROM_EMAIL;
  const siteName = process.env.CONTACT_SITE_NAME || "רהיטי ברגיג";

  if (!process.env.RESEND_API_KEY || !fromEmail) {
    const error = new Error("טופס יצירת הקשר עדיין לא מוגדר לשליחת מיילים בשרת.");
    error.statusCode = 500;
    throw error;
  }

  const phoneLine = submission.phone || "לא נמסר";
  const text = [
    `פנייה חדשה מהאתר: ${siteName}`,
    "",
    `נושא: ${submission.subject}`,
    `מייל לחזרה: ${submission.email}`,
    `טלפון: ${phoneLine}`,
    "",
    "הודעה:",
    submission.message
  ].join("\n");

  const html = `
    <div dir="rtl" style="font-family:Arial,sans-serif;line-height:1.7;color:#2f251d">
      <h2 style="margin:0 0 16px">פנייה חדשה מהאתר: ${escapeHtml(siteName)}</h2>
      <p><strong>נושא:</strong> ${escapeHtml(submission.subject)}</p>
      <p><strong>מייל לחזרה:</strong> <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></p>
      <p><strong>טלפון:</strong> ${escapeHtml(phoneLine)}</p>
      <hr style="border:0;border-top:1px solid #eadfd7;margin:18px 0" />
      <div style="white-space:pre-wrap">${escapeHtml(submission.message)}</div>
    </div>
  `;

  return {
    from: fromEmail,
    to: [toEmail],
    reply_to: submission.email,
    subject: `פנייה מהאתר: ${submission.subject}`,
    text,
    html
  };
}

async function sendWithResend(emailPayload) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(emailPayload)
  });

  if (!response.ok) {
    let details = "";
    try {
      details = JSON.stringify(await response.json());
    } catch (_) {
      details = await response.text();
    }
    console.error("Resend email failed", response.status, details);
    const error = new Error("לא הצלחתי לשלוח את המייל כרגע.");
    error.statusCode = 502;
    throw error;
  }
}

exports.handler = async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return jsonResponse(204, { ok: true });
  }

  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { ok: false, message: "Method not allowed" });
  }

  try {
    const raw = parseFormBody(event);
    const submission = normalizeSubmission(raw);
    const validationMessage = validateSubmission(submission);

    if (validationMessage === "bot") {
      return jsonResponse(200, { ok: true });
    }

    if (validationMessage) {
      return jsonResponse(400, { ok: false, message: validationMessage });
    }

    const emailPayload = buildEmail(submission);
    await sendWithResend(emailPayload);

    return jsonResponse(200, { ok: true });
  } catch (error) {
    console.error("Contact form error", error);
    return jsonResponse(error.statusCode || 500, {
      ok: false,
      message: error.message || "לא הצלחתי לשלוח את ההודעה כרגע."
    });
  }
};
