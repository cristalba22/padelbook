import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save } from "lucide-react";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import "./organizations.css";
import "./venueManagement.css";

const segment = (value) => encodeURIComponent(String(value || ""));
const money = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
const blank = () => ({ name: "", nickname: "", specialty: "Clases de pádel", price: 0 });

export default function VenueTeachers() {
  const { organizationSlug, venueSlug } = useParams();
  const { organizations, loading: permissionsLoading } = useOrganizations();
  const organization = organizations.find((item) => item.slug === organizationSlug);
  const canManage = organization?.role === "admin" && organization.venues.some((item) => item.slug === venueSlug);
  const venuePath = `/clubes/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const root = `/venues/${segment(organizationSlug)}/${segment(venueSlug)}`;
  const [state, setState] = useState({ loading: true, error: "", teachers: [] });
  const [form, setForm] = useState(blank);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!canManage) return;
    let active = true;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest(`${root}/admin/teachers`, { signal: controller.signal })
      .then(({ teachers }) => { if (active) setState({ loading: false, error: "", teachers }); })
      .catch((error) => { if (active) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { active = false; controller.abort(); };
  }, [root, canManage, reload]);

  async function create(event) {
    event.preventDefault();
    setBusy("create"); setNotice("");
    try {
      await apiRequest(`${root}/admin/teachers`, { method: "POST", body: JSON.stringify(form) });
      setForm(blank()); setReload((value) => value + 1); setNotice("Profesor agregado a esta sede.");
    } catch (error) { setNotice(error.message || "No pudimos agregar al profesor."); }
    finally { setBusy(""); }
  }

  async function update(teacher, patch) {
    setBusy(teacher.id); setNotice("");
    try {
      await apiRequest(`${root}/admin/teachers/${segment(teacher.id)}`, { method: "PATCH", body: JSON.stringify(patch) });
      setReload((value) => value + 1); setNotice("Perfil actualizado.");
    } catch (error) { setNotice(error.message || "No pudimos actualizar el perfil."); }
    finally { setBusy(""); }
  }

  if (permissionsLoading) return <section className="org-state" role="status"><h1>Verificando acceso…</h1></section>;
  if (!canManage) return <section className="org-state"><h1>Sin acceso a profesorado</h1><p>Solo la administración de esta sede puede editar perfiles.</p></section>;
  return <main className="org-page venue-management">
    <header className="org-heading"><Link className="org-back" to={venuePath}><ArrowLeft size={16} /> Volver a la sede</Link>
      <span className="org-eyebrow">Equipo deportivo · {organization.name}</span><h1>Profesorado</h1>
      <p>Perfiles y precios de clases en esta sede.</p></header>
    {notice && <p className="venue-management__notice" role="status">{notice}</p>}
    {state.error && <div className="venue-error" role="alert">{state.error} <button type="button" onClick={() => setReload((value) => value + 1)}>Reintentar</button></div>}
    <div className="venue-management__layout">
      <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Sede</span><h2>Profesores</h2></div></div>
        {state.loading ? <p className="org-empty" role="status">Cargando profesores…</p> : state.teachers.length ?
          <div className="venue-management__list">{state.teachers.map((teacher) => <TeacherRow key={teacher.id} teacher={teacher} busy={Boolean(busy)} onSave={(patch) => update(teacher, patch)} />)}</div>
          : <p className="org-empty">Todavía no hay profesores en esta sede.</p>}</section>
      <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Nuevo perfil</span><h2>Agregar profesor</h2></div></div>
        <form className="venue-management__form" onSubmit={create}>
          <label>Nombre<input required minLength={2} maxLength={100} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Apodo público<input maxLength={40} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
          <label>Especialidad<input maxLength={100} value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })} /></label>
          <label>Precio de la clase<input required type="number" min="0" max="100000000" step="1" value={form.price} onChange={(event) => setForm({ ...form, price: Number(event.target.value) })} /></label>
          <button type="submit" disabled={Boolean(busy)}><Plus size={16} /> Agregar a la sede</button></form>
        <p className="venue-management__hint">Este perfil publica las clases. El acceso personal del profesor se asigna en <Link to={`/clubes/${segment(organizationSlug)}/equipo`}>Equipo</Link>.</p></section>
    </div>
  </main>;
}

function TeacherRow({ teacher, busy, onSave }) {
  const [price, setPrice] = useState(teacher.price);
  const [status, setStatus] = useState(teacher.status);
  useEffect(() => { setPrice(teacher.price); setStatus(teacher.status); }, [teacher.price, teacher.status]);
  const changed = price !== teacher.price || status !== teacher.status;
  return <form className="venue-management__row" onSubmit={(event) => { event.preventDefault(); onSave({ price, status }); }}>
    <div><strong>{teacher.name}</strong><small>{teacher.nickname || teacher.specialty} · {money(teacher.price)} actual</small></div>
    <label>Estado<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="activo">Activo</option><option value="vacaciones">Vacaciones</option><option value="baja">Inactivo</option></select></label>
    <label>Precio<input type="number" min="0" max="100000000" step="1" value={price} onChange={(event) => setPrice(Number(event.target.value))} /></label>
    <button type="submit" disabled={busy || !changed}><Save size={15} /> Guardar</button>
  </form>;
}
