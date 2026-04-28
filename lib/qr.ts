import crypto from "node:crypto";
import QRCode from "qrcode";

export function generateQrToken(eventId: string): string {
  const shortEvent = eventId.slice(0, 6);
  const rand = crypto.randomBytes(20).toString("base64url");
  return `gqr_live_${shortEvent}_${rand}`;
}

export async function generateQrDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 300,
  });
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function passSvg(eventName: string, attendeeName: string, qrDataUrl: string): string {
  const safeEvent = escapeXml(eventName);
  const safeName = escapeXml(attendeeName);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1100" viewBox="0 0 800 1100">
  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="400" y="160" font-size="42" text-anchor="middle" font-family="Arial" fill="#111827">${safeEvent}</text>
  <text x="400" y="265" font-size="48" text-anchor="middle" font-family="Arial" fill="#111827">${safeName}</text>
  <image href="${qrDataUrl}" x="250" y="340" width="300" height="300"/>
  <text x="400" y="710" font-size="28" text-anchor="middle" font-family="Arial" fill="#374151">Show this QR at the entry gate.</text>
</svg>`;
}

function escapeXml(input: string): string {
  return input
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
