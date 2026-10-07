import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { isPastSlot } from "../utils/bookingDomain.js";
import "./organizations.css";
import "./venueBooking.css";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const segment = (value) => encodeURIComponent(String(value || ""));

export default function VenueMyBookings() {
  const { organizationSlug, venueSlug } = useParams();
  const { user, openLogin } = useAuth();
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [state, setState] = useState({ loading: Boolean(user), bookings: [], error: "" });
  const [busyId, setBusyId] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest(`${root}/bookings/mine`, { signal: controller.signal }).then(({ bookings }) => {
      if (active) setState({ loading: false, bookings, error: "" });
    }).catch((error) => { if (active) setState({ loading: false, bookings: [], error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [root, user?.id, refresh]);

  async function cancel(booking) {
    if (!window.confirm(`¿Cancelar el turno del ${booking.date.split("-").reverse().join("/")} a las ${booking.time}?`)) return;
    setBusyId(booking.id);
    try {
      await apiRequest(`${root}/bookings/${segment(booking.id)}/cancel`, { method: "POST" });
      setRefresh((value) => value + 1);
    } catch (error) {
      setState((current) => ({ ...current, error: error.message || "No pudimos cancelar el turno." }));
    } finally { setBusyId(""); }
  }

  return <main className="org-page venue-booking-page"><header className="org-heading">
    <Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
    <span className="org-eyebrow">{venueSlug.replaceAll("-", " ")}</span><h1>Mis turnos</h1><p>Reservas de esta sede</p></header>
    <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Historial</span><h2>Reservas</h2></div>
      <Link className="venue-my-link" to={`${venuePath}/reservar`}>Nueva reserva <ArrowRight size={16} /></Link></div>
      {!user ? <div className="venue-empty-action"><p>Ingresá para consultar tus turnos.</p><button type="button" onClick={openLogin}>Ingresar</button></div> :
        state.loading ? <p className="org-empty">Consultando tus reservas…</p> : state.error ?
          <div className="venue-error" role="alert">{state.error} <button type="button" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Reintentar</button></div> :
          state.bookings.length ? <div className="venue-booking-list">{state.bookings.map((booking) => <article key={booking.id}>
            <div><strong>{booking.courtName}</strong><span>{booking.date.split("-").reverse().join("/")} · {booking.time}–{booking.endTime}</span>
              <small>{booking.status === "cancelado" ? "Cancelado" : booking.status === "confirmado" ? "Confirmado" : "Pendiente de confirmación"}</small></div>
            <div className="venue-booking-list__right"><strong>{money(booking.price)}</strong><small>{booking.paymentStatus === "pagado" ? "Pago registrado" : "Pago en el club"}</small>
              {booking.status !== "cancelado" && !isPastSlot(booking.date, booking.time) && <button type="button" disabled={busyId === booking.id}
                onClick={() => cancel(booking)}>{busyId === booking.id ? "Cancelando…" : "Cancelar turno"}</button>}</div></article>)}</div> :
            <p className="org-empty">Todavía no tenés turnos en esta sede.</p>}
    </section>
  </main>;
}
