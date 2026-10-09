import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { argentinaDateISO } from "../utils/bookingDomain.js";
import "./organizations.css";
import "./venueFinance.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const blankExpense = () => ({ date: argentinaDateISO(), concept: "", category: "operativo", amount: "", paymentMethod: "efectivo", note: "" });

export default function VenueFinance() {
  const { organizationSlug, venueSlug } = useParams();
  const { organizations, loading: permissionsLoading, error: permissionsError } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug && item.role === "admin");
  const venue = organization?.venues.find((item) => item.slug === venueSlug);
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [state, setState] = useState({ loading: true, error: "", summary: null });
  const [reload, setReload] = useState(0);
  const [expense, setExpense] = useState(blankExpense);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!venue) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest(`${root}/admin/finance/summary`, { signal: controller.signal }).then(({ summary }) => {
      if (active) setState({ loading: false, error: "", summary });
    }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [root, venue?.slug, reload]);

  async function saveExpense(event) {
    event.preventDefault();
    setNotice(""); setSaving(true);
    try {
      const payload = { ...expense, amount: Number(expense.amount) };
      await apiRequest(`${root}/admin/expenses`, { method: "POST", body: JSON.stringify(payload) });
      setExpense(blankExpense());
      setNotice("Egreso registrado.");
      setReload((value) => value + 1);
    } catch (error) { setNotice(error.message); } finally { setSaving(false); }
  }

  if (permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso</h1></section>;
  if (permissionsError || !venue) return <section className="org-state"><h1>Sin acceso a esta caja</h1><p>{permissionsError || "Solo el propietario puede ver la caja de esta sede."}</p><Link to="/clubes">Mis clubes</Link></section>;
  return <main className="org-page venue-finance-page"><header className="org-heading org-heading--dashboard"><div>
    <Link className="org-back" to={venuePath}><ArrowLeft size={16} /> {venue.name}</Link><span className="org-eyebrow">Caja · {organization.name}</span>
    <h1>Caja de {venue.name}</h1><p>Cobros y egresos registrados por el equipo.</p></div>
    <button className="org-refresh" type="button" onClick={() => setReload((value) => value + 1)}><RefreshCw size={16} /> Actualizar</button></header>
    {state.loading ? <section className="org-state" role="status"><h2>Cargando la caja</h2></section>
      : state.error ? <section className="org-state" role="alert"><h2>No pudimos consultar la caja</h2><p>{state.error}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></section>
        : <><section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Mes actual</span><h2>Resumen</h2></div><small>Registros del club · sin conciliación bancaria</small></div>
          <div className="org-metrics"><article className="org-metric org-metric--primary"><span>Ingresos</span><strong>{money(state.summary.byPeriod.month.income)}</strong><small>Cobros registrados</small></article>
            <article className="org-metric"><span>Egresos</span><strong>{money(state.summary.byPeriod.month.expenses)}</strong><small>Gastos de la sede</small></article>
            <article className="org-metric"><span>Comisiones</span><strong>{money(state.summary.byPeriod.month.commissions)}</strong><small>Estimadas según configuración</small></article>
            <article className="org-metric"><span>Neto estimado</span><strong>{money(state.summary.byPeriod.month.net)}</strong><small>Ingresos menos egresos y comisiones</small></article></div>
          <p className="org-finance-note">Saldo pendiente en reservas activas: <strong>{money(state.summary.totals.pending)}</strong>. Los importes son registros manuales; no confirman una transferencia externa.</p></section>
          <div className="venue-finance-layout"><section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Seguimiento</span><h2>Pendiente de cobro</h2></div><Link className="org-staff-link" to={`${venuePath}/recepcion/reservas`}>Ir a reservas <ArrowRight size={16} /></Link></div>
            {state.summary.pendingPayments.length ? <div className="venue-finance-rows">{state.summary.pendingPayments.map((item) => <article key={item.id}><div><strong>{item.playerName}</strong><small>{item.date} · {item.time} · {item.courtName}</small></div><b>{money(item.amountDue)}</b></article>)}</div>
              : <p className="org-empty">No hay saldos pendientes registrados.</p>}</section>
            <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Gastos</span><h2>Registrar egreso</h2></div></div>
              <form className="venue-finance-form" onSubmit={saveExpense}><label>Fecha<input required type="date" value={expense.date} onChange={(event) => setExpense({ ...expense, date: event.target.value })} /></label>
                <label>Concepto<input required minLength={2} maxLength={160} value={expense.concept} onChange={(event) => setExpense({ ...expense, concept: event.target.value })} /></label>
                <label>Importe<input required type="number" min="1" max="1000000000" step="1" inputMode="numeric" value={expense.amount} onChange={(event) => setExpense({ ...expense, amount: event.target.value })} /></label>
                <label>Medio de pago<select value={expense.paymentMethod} onChange={(event) => setExpense({ ...expense, paymentMethod: event.target.value })}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option><option value="tarjeta">Tarjeta</option><option value="otro">Otro</option></select></label>
                <label className="venue-finance-form__wide">Nota (opcional)<input maxLength={500} value={expense.note} onChange={(event) => setExpense({ ...expense, note: event.target.value })} /></label>
                <button type="submit" disabled={saving}>{saving ? "Guardando…" : "Registrar egreso"}</button></form>
              {notice && <p className="venue-finance-notice" role="status">{notice}</p>}</section></div>
          <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Historial</span><h2>Últimos egresos</h2></div></div>
            {state.summary.expenses.length ? <div className="venue-finance-rows">{state.summary.expenses.map((item) => <article key={item.id}><div><strong>{item.concept}</strong><small>{item.date} · {item.paymentMethod}</small></div><b>{money(item.amount)}</b></article>)}</div>
              : <p className="org-empty">Todavía no hay egresos registrados.</p>}</section>
        </>}
  </main>;
}
