import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Save, UserPlus } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { generateSecurePassword } from "../utils/password.js";
import "./organizations.css";
import "./organizationStaff.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const blank = () => ({ name: "", email: "", phone: "", password: "", role: "receptionist", venueIds: [] });
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
  const [state, setState] = useState({ loading: true, error: "", venues: [], staff: [] });
  const [form, setForm] = useState(blank);
  const [showPassword, setShowPassword] = useState(false);
  const [createdPassword, setCreatedPassword] = useState(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!organization) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    Promise.all([apiRequest(`${root}/venues`, { signal: controller.signal }),
      apiRequest(`${root}/admin/staff`, { signal: controller.signal })]).then(([venues, staff]) => {
      if (active) setState({ loading: false, error: "", venues: venues.venues, staff: staff.staff });
    }).catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [root, organization?.slug, reload]);

  async function createEmployee(event) {
    event.preventDefault();
    if (!form.venueIds.length) { setNotice("Seleccioná al menos una sede."); return; }
    setBusy("create"); setNotice(""); setCreatedPassword(null);
    try {
      const { employee } = await apiRequest(`${root}/admin/staff`, { method: "POST", body: JSON.stringify(form) });
      setState((current) => ({ ...current, staff: [...current.staff, employee].sort((a, b) => a.name.localeCompare(b.name, "es")) }));
      setCreatedPassword({ name: employee.name, password: form.password });
      setForm(blank()); setShowPassword(false);
      setNotice(`Acceso creado para ${employee.name}.`);
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
            <p className="org-staff-intro">Creá una cuenta individual y compartí su clave inicial por un canal privado. Las cuentas que ya existen requieren un flujo de invitación, todavía pendiente.</p>
            <form onSubmit={createEmployee} className="org-staff-create"><div className="org-staff-form-grid"><label>Nombre<input required minLength={2} maxLength={100} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label>Email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label>Teléfono<input maxLength={40} autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
              <label>Función<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="receptionist">Recepción</option><option value="teacher">Profesorado</option></select></label></div>
              <VenueChoices venues={state.venues} selected={form.venueIds} onChange={(venueIds) => setForm({ ...form, venueIds })} name="new-venues" />
              <label className="org-staff-password">Contraseña inicial<span><input required type={showPassword ? "text" : "password"} minLength={12} maxLength={72} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
                <button type="button" aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"} aria-pressed={showPassword} onClick={() => setShowPassword((value) => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
              <button className="org-staff-generate" type="button" onClick={() => { setForm({ ...form, password: generateSecurePassword() }); setShowPassword(true); }}><KeyRound size={16} /> Generar contraseña segura</button>
              <button className="org-staff-create-button" type="submit" disabled={Boolean(busy) || !form.venueIds.length}><UserPlus size={17} /> {busy === "create" ? "Creando…" : "Crear acceso"}</button></form></section></div>
          {notice && <p className="org-staff-notice" role="status">{notice}</p>}
          {createdPassword && <section className="org-staff-secret" aria-label="Contraseña inicial"><strong>Clave inicial de {createdPassword.name}</strong><p>Copiala ahora y compartila por un canal privado. Al cerrar este aviso, no volverá a mostrarse.</p><code>{createdPassword.password}</code>
            <button type="button" onClick={() => setCreatedPassword(null)}>Ya la guardé</button></section>}
        </>}
  </main>;
}
