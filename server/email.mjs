import { PASSWORD_RESET_FROM, PASSWORD_RESET_REPLY_TO, RESEND_API_KEY, RESEND_API_URL } from "./config.mjs";

export function passwordEmailConfigured() {
  return Boolean(RESEND_API_KEY && PASSWORD_RESET_FROM);
}

export async function sendPasswordResetEmail({ to, name, resetUrl }) {
  if (!passwordEmailConfigured()) throw new Error("Password email is not configured");
  const safeName = String(name || "").trim() || "jugador";
  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: PASSWORD_RESET_FROM,
      to: [to],
      ...(PASSWORD_RESET_REPLY_TO ? { reply_to: PASSWORD_RESET_REPLY_TO } : {}),
      subject: "Restablecé tu contraseña de PadelBook",
      text: `Hola ${safeName}. Recibimos una solicitud para restablecer tu contraseña de PadelBook. Abrí este enlace dentro de los próximos 20 minutos: ${resetUrl}\n\nSi no solicitaste el cambio, ignorá este correo.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#111827"><p style="font-size:12px;font-weight:800;letter-spacing:.18em;color:#4d7c0f">PADELBOOK</p><h1 style="font-size:28px">Restablecé tu contraseña</h1><p>Hola ${escapeHtml(safeName)}. El enlace es válido por 20 minutos y puede usarse una sola vez.</p><p style="margin:28px 0"><a href="${escapeHtml(resetUrl)}" style="background:#bef264;color:#111827;padding:14px 22px;border-radius:999px;text-decoration:none;font-weight:800">Crear nueva contraseña</a></p><p style="font-size:13px;color:#64748b">Si no solicitaste el cambio, podés ignorar este correo. Tu contraseña actual seguirá funcionando.</p></div>`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
}
