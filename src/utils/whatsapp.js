export function cleanPhone(phone = "") {
  return String(phone || "").replace(/\D/g, "") || "5493510000000";
}

export function buildBookingWhatsAppUrl({ phone, player, date, time, endTime, court, status, price, mode = "admin" }) {
  const timeLabel = endTime ? `${time || ""} a ${endTime}` : (time || "");
  const lines = mode === "admin"
    ? [
        `Hola ${player || ""}! Te escribimos desde Padel Book por tu reserva.`,
        "",
        `Fecha: ${date || ""}`,
        `Hora: ${timeLabel}`,
        `Cancha/Clase: ${court || ""}`,
        `Estado: ${status || "pendiente"}`,
        price ? `Importe: $${Number(price).toLocaleString("es-AR")}` : "",
        "",
        "Cualquier cambio podés responder este mensaje.",
      ]
    : [
        "Hola! Quiero consultar por mi reserva.",
        "",
        `Fecha: ${date || ""}`,
        `Hora: ${timeLabel}`,
        `Cancha/Clase: ${court || ""}`,
        `Estado: ${status || "pendiente"}`,
      ];
  const text = encodeURIComponent(lines.filter(Boolean).join("\n"));
  return `https://wa.me/${cleanPhone(phone)}?text=${text}`;
}
