import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Save, UserPlus } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import "./organizations.css";
import "./organizationStaff.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const blank = () => ({ email: "", role: "receptionist", venueIds: [] });
const roleLabel = (role) => role === "teacher" ? "Profesorado" : "Recepción";

function VenueChoices({ venues, selected, onChange, name }) {
  return <fieldset className="org-staff-venues"><legend>Sedes autorizadas</legend><div>{venues.map((venue) => <label key={venue.id}>
    <input name={name} type="checkbox" checked={selected.includes(venue.id)} onChange={(event) => onChange(event.target.checked ? [...selected, venue.id] : selected.filter((id) => id !== venue.id))} />
    {venue.name}</label>)}</div></fieldset>;
}

function StaffCard({ employee, venues, busy, onSave, onToggle }) {
  const [role, setRole] = useState(employee.role);
  const [venueIds, setVenueIds] = useState(employee.venueIds);
  const changed = role !== employee.role || JSON.stringify([...venueIds].sort()) !== JSON.stringify([...employee.venueIds].sort());
  if (employee.role === "admin") return <article className="org-staff-card"><div className="org-staff-card__head"><div><strong>{employee.name}</strong><small>{employee.email} · Administración</small></div>
    <span className={employee.active ? "org-staff-badge" : "org-staff-badge org-staff-badge--off"}>{employee.active ? "Activo" : "Sin acceso"}</span></div>
    <div className="org-staff-card__actions"><button type="button" className="org-staff-secondary" disabled={Boolean(busy)} onClick={() => onToggle(employee)}>{employee.active ? "Desactivar acceso" : "Activar acceso"}</button></div></article>;
  return <article className="org-staff-card"><div className="org-staff-card__head"><div><strong>{employee.name}</strong><small>{employee.email}</small></div>
    <span className={employee.active ? "org-staff-badge" : "org-staff-badge org-staff-badge--off"}>{employee.active ? "Activo" : "Sin acceso"}</span></div>
    <div className="org-staff-form-grid"><label>Función<select value={role} onChange={(event) => setRole(event.target.value)}><option value="receptionist">Recepción</option><option value="teacher">Profesorado</option></select></label></div>
    <VenueChoices venues={venues} selected={venueIds} onChange={setVenueIds} name={`venues-${employee.id}`} />
    <div className="org-staff-card__actions"><button type="button" disabled={Boolean(busy) || !changed || !venueIds.length} onClick={async () => {
      const saved = await onSave(employee, { role, venueIds });
      if (saved) { setRole(saved.role); setVenueIds(saved.venueIds); }
    }}><Save size={16} /> Guardar permisos</button>
      <button type="button" className="org-staff-secondary" disabled={Boolean(busy)} onClick={() => onToggle(employee)}>{employee.active ? "Desactivar acceso" : "Activar acceso"}</button></div>
  </article>;
}

export default function OrganizationStaff() {
  const { organizationSlug } = useParams();
  const { organizations, loading: permissionsLoading, error: permissionsError } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug && item.role === "admin");
  const root = `/organizations/${segment(organizationSlug)}`;
  const [state, setState] = useState({ loading: true, error: "", venues: [], staff: [], invitations: [] });
  const [form, setForm] = useState(blank);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!organization) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([apiRequest(`${root}/venues`, { signal: controller.signal }),
      apiRequest(`${root}/admin/staff`, { signal: controller.signal }),
      apiRequest(`${root}/admin/invitations`, { signal: controller.signal })]).then(([venues, staff, invitations]) => {
      if (active) setState({ loading: false, error: "", venues: venues.venues, staff: staff.staff, invitations: invitations.invitations });
    }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [root, organization?.slug, reload]);

  async function inviteEmployee(event) {
    event.preventDefault();
    if (form.role !== "admin" && !form.venueIds.length) { setNotice("Seleccioná al menos una sede."); return; }
    setBusy("invite"); setNotice("");
    try {
      const { invitation } = await apiRequest(`${root}/admin/invitations`, { method: "POST", body: JSON.stringify(form) });
      setState((current) => ({ ...current, invitations: [invitation, ...current.invitations] }));
      setForm(blank());
      setNotice(`Enviamos la invitación a ${invitation.email}.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  async function revoke(invitation) {
    setBusy(invitation.id); setNotice("");
    try {
      await apiRequest(`${root}/admin/invitations/${segment(invitation.id)}`, { method: "DELETE" });
      setState((current) => ({ ...current, invitations: current.invitations.filter((item) => item.id !== invitation.id) }));
      setNotice(`Invitación a ${invitation.email} cancelada.`);
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  async function updateEmployee(employee, patch) {
    setBusy(employee.id); setNotice("");
    try {
      const { employee: saved } = await apiRequest(`${root}/admin/staff/${segment(employee.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      setState((current) => ({ ...current, staff: current.staff.map((item) => item.id === saved.id ? saved : item) }));
      setNotice(`Permisos de ${saved.name} actualizados.`);
      return saved;
    } catch (error) { setNotice(error.message); return null; } finally { setBusy(""); }
  }

  if (permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso</h1></section>;
  if (permissionsError || !organization) return <section className="org-state"><h1>Sin acceso a este equipo</h1><p>{permissionsError || "Solo la administración del club puede gestionar personal."}</p><Link to="/clubes">Mis clubes</Link></section>;
  return <main className="org-page org-staff-page"><header className="org-heading"><Link className="org-back" to={`/clubes/${segment(organizationSlug)}`}><ArrowLeft size={16} /> Panel del club</Link>
    <span className="org-eyebrow">Administración · {organization.name}</span><h1>Equipo y accesos</h1><p>Asigná a cada persona las sedes donde trabaja.</p></header>
    {state.loading ? <section className="org-state" role="status"><h2>Cargando el equipo</h2></section>
      : state.error ? <section className="org-state" role="alert"><h2>No pudimos cargar el equipo</h2><p>{state.error}</p><button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></section>
        : <><div className="org-staff-layout"><section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Permisos</span><h2>Personal del club</h2></div><small>{state.staff.filter((person) => person.active).length} activos</small></div>
          <p className="org-staff-intro">Recepción puede gestionar reservas y registrar cobros de sus sedes. Los permisos de profesorado también se limitan a las sedes asignadas.</p>
          <div className="org-staff-list">{state.staff.map((person) => <StaffCard key={person.id} employee={person} venues={state.venues} busy={busy} onSave={updateEmployee} onToggle={(employee) => updateEmployee(employee, { active: !employee.active })} />)}</div>
          {!state.staff.length && <p className="org-empty">Todavía no hay personal asignado.</p>}</section>
          <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Nuevo acceso</span><h2>Agregar persona</h2></div></div>
            <p className="org-staff-intro">La persona recibe un enlace de un solo uso. Puede ingresar con su cuenta actual o crear una nueva; vos no ves ni elegís su contraseña.</p>
            <form onSubmit={inviteEmployee} className="org-staff-create"><div className="org-staff-form-grid"><label>Email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Función<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value, venueIds: event.target.value === "admin" ? [] : form.venueIds })}><option value="receptionist">Recepción</option><option value="teacher">Profesorado</option><option value="admin">Administración</option></select></label></div>
              {form.role !== "admin" && <VenueChoices venues={state.venues} selected={form.venueIds} onChange={(venueIds) => setForm({ ...form, venueIds })} name="new-venues" />}
              <button className="org-staff-create-button" type="submit" disabled={Boolean(busy) || (form.role !== "admin" && !form.venueIds.length)}><UserPlus size={17} /> {busy === "invite" ? "Enviando…" : "Enviar invitación"}</button></form>
            {state.invitations.length > 0 && <div className="org-staff-list"><h3>Invitaciones pendientes</h3>{state.invitations.map((item) => <article className="org-staff-card" key={item.id}><div className="org-staff-card__head"><div><strong>{item.email}</strong><small>{item.role === "admin" ? "Administración" : roleLabel(item.role)} · Vence {new Date(item.expiresAt).toLocaleDateString("es-AR")}</small></div><button type="button" className="org-staff-secondary" disabled={Boolean(busy)} onClick={() => revoke(item)}>Cancelar</button></div></article>)}</div>}
          </section></div>
          {notice && <p className="org-staff-notice" role="status">{notice}</p>}
        </>}
  </main>;
}
