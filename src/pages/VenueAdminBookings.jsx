import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import { paymentSummary, PAYMENT_METHODS } from "../utils/paymentDomain.js";
import "./organizations.css";
import "./venueBooking.css";

const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const segment = (value) => encodeURIComponent(String(value || ""));

export default function VenueAdminBookings() {
  const { organizationSlug, venueSlug } = useParams();
  const { organizations, loading: permissionsLoading } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const canManage = ["admin", "receptionist"].includes(organization?.role) && organization.venues.some((item) => item.slug === venueSlug);
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [date, setDate] = useState(argentinaDateISO);
  const [status, setStatus] = useState("todos");
  const [search, setSearch] = useState("");
  const [state, setState] = useState({ loading: true, bookings: [], hasMore: false, error: "" });
  const [refresh, setRefresh] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [payment, setPayment] = useState(null);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("efectivo");
  const [note, setNote] = useState("");
  const [paymentKey, setPaymentKey] = useState("");
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!payment) return;
    const previous = document.activeElement;
    dialogRef.current?.querySelector("input")?.focus();
    return () => previous?.focus?.();
  }, [payment?.id]);

  function handleDialogKey(event) {
    if (event.key === "Escape" && !busyId) { setPayment(null); return; }
    if (event.key !== "Tab") return;
    const elements = [...dialogRef.current.querySelectorAll("input:not(:disabled), select:not(:disabled), button:not(:disabled)")];
    const first = elements[0];
    const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest(`${root}/admin/bookings?date=${date}`, { signal: controller.signal }).then(({ bookings, hasMore }) => {
      if (active) setState({ loading: false, bookings, hasMore, error: "" });
    }).catch((error) => { if (active) setState({ loading: false, bookings: [], hasMore: false, error: error.message }); });
    return () => { active = false; controller.abort(); };
  }, [root, date, canManage, refresh]);

  const filtered = useMemo(() => state.bookings.filter((booking) => {
    if (status !== "todos" && booking.status !== status) return false;
    const query = search.trim().toLocaleLowerCase("es-AR");
    return !query || [booking.playerName, booking.courtName, booking.phone].some((value) =>
      String(value || "").toLocaleLowerCase("es-AR").includes(query));
  }), [state.bookings, status, search]);
  const activeBookings = state.bookings.filter((booking) => booking.status !== "cancelado");
  const pending = activeBookings.filter((booking) => booking.status === "pendiente").length;
  const due = activeBookings.reduce((total, booking) => total + paymentSummary(booking).due, 0);

  function openPayment(booking) {
    setPayment(booking);
    setAmount(String(paymentSummary(booking).due));
    setMethod("efectivo");
    setNote("");
    setPaymentKey(crypto.randomUUID());
    setMessage("");
  }

  async function updateStatus(booking, nextStatus) {
    if (nextStatus === "cancelado" && !window.confirm(`¿Cancelar la reserva de ${booking.playerName}? Los pagos registrados requieren revisión manual.`)) return;
    setBusyId(booking.id);
    setMessage("");
    try {
      await apiRequest(`${root}/admin/bookings/${segment(booking.id)}/status`, {
        method: "PATCH", body: JSON.stringify({ status: nextStatus }),
      });
      setRefresh((value) => value + 1);
    } catch (error) { setMessage(error.message || "No pudimos cambiar el estado."); }
    finally { setBusyId(""); }
  }

  async function savePayment(event) {
    event.preventDefault();
    const value = Number(amount);
    if (!payment || !Number.isSafeInteger(value) || value <= 0 || value > paymentSummary(payment).due) {
      setMessage("Ingresá un monto entero mayor que cero y no superior al saldo."); return;
    }
    setBusyId(payment.id);
    setMessage("");
    try {
      await apiRequest(`${root}/admin/bookings/${segment(payment.id)}/payments`, { method: "POST",
        body: JSON.stringify({ amount: value, method, note, idempotencyKey: paymentKey }) });
      setPayment(null);
      setRefresh((current) => current + 1);
      setMessage("Cobro registrado.");
    } catch (error) { setMessage(error.message || "No pudimos registrar el cobro."); }
    finally { setBusyId(""); }
  }

  return <main className="org-page venue-admin-page"><header className="org-heading org-heading--dashboard"><div>
    <Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
    <span className="org-eyebrow">Recepción · {venueSlug.replaceAll("-", " ")}</span><h1>Reservas del club</h1>
    <p>Agenda y cobros registrados en esta sede.</p></div>
    <div className="venue-admin-heading-actions"><Link to={`${venuePath}/recepcion/nueva-reserva`}>Cargar turno</Link>
      <button type="button" className="org-refresh" onClick={() => setRefresh((value) => value + 1)}><RefreshCw size={16} /> Actualizar</button></div></header>
    {permissionsLoading ? <section className="org-section"><p>Verificando acceso…</p></section> : !canManage ?
      <section className="org-section"><h2>Sin acceso a recepción</h2><p>Tu cuenta no tiene permisos para gestionar esta sede.</p></section> : <>
        <div className="venue-admin-metrics"><div><small>Reservas activas</small><strong>{activeBookings.length}</strong></div>
          <div><small>Por confirmar</small><strong>{pending}</strong></div><div><small>Saldo pendiente</small><strong>{money(due)}</strong></div></div>
        <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Agenda</span><h2>Turnos del día</h2></div></div>
          <div className="venue-admin-filters"><label>Fecha<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="todos">Todos</option>
              <option value="pendiente">Pendientes</option><option value="confirmado">Confirmados</option><option value="cancelado">Cancelados</option></select></label>
            <label>Buscar<input type="search" placeholder="Jugador, cancha o teléfono" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>
          {message && <p className="venue-admin-message" role="status">{message}</p>}
          {state.loading ? <p className="org-empty">Consultando reservas…</p> : state.error ?
            <div className="venue-error" role="alert">{state.error} <button type="button" onClick={() => setRefresh((value) => value + 1)}>Reintentar</button></div> :
            filtered.length ? <div className="venue-admin-list">{filtered.map((booking) => {
              const balance = paymentSummary(booking);
              return <article key={booking.id}><div className="venue-admin-list__time"><strong>{booking.time}</strong><small>{booking.endTime}</small></div>
                <div className="venue-admin-list__main"><strong>{booking.playerName}</strong><span>{booking.courtName} · {booking.type === "class" ? "Clase" : "Cancha"}</span>
                  <small>{booking.phone || "Sin teléfono"}</small></div>
                <div className="venue-admin-list__money"><strong>{money(booking.price)}</strong><small>{booking.status === "cancelado" ?
                  balance.paid > 0 ? `Cobrado ${money(balance.paid)} · revisar devolución` : "Sin cobros registrados" :
                  `Saldo ${money(balance.due)}`}</small></div>
                <div className="venue-admin-list__actions"><span className={`venue-admin-status venue-admin-status--${booking.status}`}>{booking.status}</span>
                  {booking.status === "pendiente" && <button type="button" disabled={busyId === booking.id}
                    onClick={() => updateStatus(booking, "confirmado")}>Confirmar</button>}
                  {booking.status !== "cancelado" && balance.due > 0 && <button type="button" disabled={busyId === booking.id}
                    onClick={() => openPayment(booking)}>Registrar cobro</button>}
                  {booking.status !== "cancelado" && <button type="button" className="venue-admin-cancel" disabled={busyId === booking.id}
                    onClick={() => updateStatus(booking, "cancelado")}>Cancelar</button>}</div></article>;
            })}</div> : <p className="org-empty">No hay reservas para esos filtros.</p>}
          {state.hasMore && <p className="venue-admin-limit">Hay más de 300 reservas para esta fecha. Consultá el registro completo antes de cerrar caja.</p>}
        </section></>}
    {payment && <div className="venue-payment-backdrop" role="presentation" onClick={() => !busyId && setPayment(null)}>
      <form ref={dialogRef} className="venue-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="venue-payment-title"
        onClick={(event) => event.stopPropagation()} onKeyDown={handleDialogKey} onSubmit={savePayment}>
        <span className="org-eyebrow">Registro manual</span><h2 id="venue-payment-title">Cobro de {payment.playerName}</h2>
        <p>Saldo pendiente: <strong>{money(paymentSummary(payment).due)}</strong>. Registrá solo dinero efectivamente recibido.</p>
        <label>Monto<input type="number" min="1" max={paymentSummary(payment).due} step="1" required value={amount}
          onChange={(event) => { setAmount(event.target.value); setPaymentKey(crypto.randomUUID()); }} /></label>
        <label>Medio<select value={method} onChange={(event) => { setMethod(event.target.value); setPaymentKey(crypto.randomUUID()); }}>
          {PAYMENT_METHODS.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Nota opcional<input maxLength="300" value={note} onChange={(event) => { setNote(event.target.value); setPaymentKey(crypto.randomUUID()); }} /></label>
        {message && <p className="venue-error" role="alert">{message}</p>}
        <div className="venue-payment-dialog__actions"><button type="button" onClick={() => setPayment(null)} disabled={busyId === payment.id}>Volver</button>
          <button type="submit" disabled={busyId === payment.id}>{busyId === payment.id ? "Guardando…" : "Registrar cobro"}</button></div>
      </form></div>}
  </main>;
}
