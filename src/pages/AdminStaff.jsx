import React, { useEffect, useState } from "react";
import AdminLayout from "../components/AdminLayout.jsx";
import { useAuth } from "../hooks/useAuth.jsx";
import { apiRequest } from "../utils/apiClient.js";
import PasswordField from "../components/PasswordField.jsx";

const initialForm = { name: "", email: "", phone: "", password: "" };

export default function AdminStaff() {
  const { apiOnline } = useAuth();
  const [staff, setStaff] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [resets, setResets] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!apiOnline) return;
    let active = true;
    apiRequest("/admin/staff")
      .then(({ staff: items }) => { if (active) setStaff(items || []); })
      .catch((cause) => { if (active) setError(cause.message || "No se pudo cargar el equipo."); });
    return () => { active = false; };
  }, [apiOnline]);

  async function createEmployee(event) {
    event.preventDefault();
    setBusy("create"); setError(""); setMessage("");
    try {
      const { employee } = await apiRequest("/admin/staff", { method: "POST", body: JSON.stringify(form) });
      setStaff((current) => [...current, employee].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(initialForm);
      setMessage(`Acceso creado para ${employee.name}. Compartí la contraseña por un canal privado.`);
    } catch (cause) { setError(cause.message || "No se pudo crear el acceso."); }
    finally { setBusy(""); }
  }

  async function updateEmployee(employee, patch) {
    setBusy(employee.id); setError(""); setMessage("");
    try {
      const { employee: saved } = await apiRequest(`/admin/staff/${employee.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setStaff((current) => current.map((item) => item.id === saved.id ? saved : item));
      setResets((current) => ({ ...current, [employee.id]: "" }));
      setMessage(patch.password ? `Contraseña renovada para ${employee.name}.` : `Acceso ${saved.active ? "activado" : "desactivado"} para ${employee.name}.`);
    } catch (cause) { setError(cause.message || "No se pudo actualizar el acceso."); }
    finally { setBusy(""); }
  }

  return <AdminLayout title="Equipo de recepción" subtitle="Dale acceso propio a quien atiende el club. Cada movimiento queda asociado a su cuenta.">
    {!apiOnline && <p className="mb-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">En la demo podés ingresar como Recepción desde Acceso al club. El alta y la baja de empleados se habilitan al conectar la API del piloto.</p>}
    {error && <p role="alert" className="mb-5 rounded-2xl border border-rose-300/25 bg-rose-300/10 p-4 text-sm text-rose-100">{error}</p>}
    {message && <p role="status" className="mb-5 rounded-2xl border border-lime-300/25 bg-lime-300/10 p-4 text-sm text-lime-100">{message}</p>}
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
      <section className="admin-panel rounded-3xl border border-white/10 p-5 md:p-7">
        <p className="club-dashboard__eyebrow">ACCESOS</p><h2 className="mt-2 text-2xl font-bold">Recepcionistas</h2>
        <p className="mt-2 text-sm text-slate-400">Pueden crear y cancelar turnos, bloquear la agenda y registrar cobros. No pueden cambiar precios ni ver finanzas generales.</p>
        <div className="mt-6 space-y-3">{staff.map((employee) => <div key={employee.id} className="rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold text-white">{employee.name}</h3><p className="text-sm text-slate-400">{employee.email}</p><p className="mt-1 text-xs text-slate-500">{employee.phone || "Sin teléfono"}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${employee.active !== false ? "bg-lime-300/15 text-lime-200" : "bg-rose-300/15 text-rose-200"}`}>{employee.active !== false ? "Activo" : "Sin acceso"}</span></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[auto_minmax(240px,1fr)_auto] sm:items-end"><button type="button" disabled={Boolean(busy)} onClick={() => updateEmployee(employee, { active: employee.active === false })} className="btn-outline px-4 py-2 text-xs">{employee.active === false ? "Activar" : "Desactivar"}</button><PasswordField id={`reset-password-${employee.id}`} name={`new-password-${employee.id}`} label={`Nueva contraseña para ${employee.name}`} value={resets[employee.id] || ""} onValueChange={(value) => setResets((current) => ({ ...current, [employee.id]: value }))} autoComplete="new-password" minLength={12} showGenerator /><button type="button" disabled={Boolean(busy) || (resets[employee.id] || "").length < 12} onClick={() => updateEmployee(employee, { password: resets[employee.id] })} className="btn-outline px-4 py-2 text-xs">Cambiar clave</button></div>
        </div>)}{apiOnline && !staff.length && <p className="rounded-2xl border border-dashed border-white/15 p-5 text-sm text-slate-400">Todavía no hay recepcionistas. Creá el primer acceso a la derecha.</p>}</div>
      </section>
      <form onSubmit={createEmployee} className="admin-panel h-fit rounded-3xl border border-white/10 p-5 md:p-7">
        <p className="club-dashboard__eyebrow">NUEVO ACCESO</p><h2 className="mt-2 text-2xl font-bold">Agregar empleado</h2>
        <p className="mt-2 text-sm text-slate-400">Usá una cuenta personal por empleado. La contraseña se muestra solo mientras la escribís.</p>
        <div className="mt-5 space-y-4"><label className="block text-sm">Nombre<input name="name" autoComplete="name" className="field mt-2" value={form.name} minLength={2} maxLength={100} required disabled={!apiOnline} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label><label className="block text-sm">Email<input name="email" autoComplete="email" className="field mt-2" type="email" value={form.email} required disabled={!apiOnline} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label><label className="block text-sm">Teléfono<input name="tel" autoComplete="tel" className="field mt-2" value={form.phone} disabled={!apiOnline} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label><PasswordField id="staff-password" value={form.password} onValueChange={(value) => setForm((current) => ({ ...current, password: value }))} autoComplete="new-password" minLength={12} required disabled={!apiOnline} showGenerator /></div>
        <button type="submit" disabled={!apiOnline || Boolean(busy)} className="btn-primary mt-6 w-full justify-center">{busy === "create" ? "Creando..." : "Crear acceso de recepción"}</button>
      </form>
    </div>
  </AdminLayout>;
}
