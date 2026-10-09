import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../hooks/useAuth.jsx";
import "./organizations.css";
import "./multiclubAccount.css";

export default function MulticlubAccount() {
  const { user, openLogin, updateProfile, changePassword } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || "", phone: user?.phone || "", category: user?.category || "Sin categoría" });
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { setProfile({ name: user?.name || "", phone: user?.phone || "", category: user?.category || "Sin categoría" }); }, [user?.id, user?.name, user?.phone, user?.category]);

  async function saveProfile(event) {
    event.preventDefault(); setBusy("profile"); setNotice("");
    try { await updateProfile(profile); setNotice("Perfil actualizado."); }
    catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  async function savePassword(event) {
    event.preventDefault(); setNotice("");
    if (password.next !== password.confirm) { setNotice("Las contraseñas no coinciden."); return; }
    setBusy("password");
    try {
      await changePassword(password.current, password.next);
      setPassword({ current: "", next: "", confirm: "" });
      setNotice("Contraseña actualizada. Volvé a ingresar con la nueva clave.");
    } catch (error) { setNotice(error.message); } finally { setBusy(""); }
  }

  if (!user) return <main className="org-page"><header className="org-heading"><span className="org-eyebrow">Cuenta</span><h1>Ingresá a PadelBook</h1><p>Usá tu cuenta para ver los clubes y sedes donde participás.</p></header>
    <button className="org-refresh" type="button" onClick={openLogin}>Ingresar o registrarme</button></main>;
  return <main className="org-page multiclub-account"><header className="org-heading"><Link className="org-back" to="/clubes"><ArrowLeft size={16} /> Mis clubes</Link>
    <span className="org-eyebrow">Cuenta personal</span><h1>Mi perfil</h1><p>{user.email}</p></header>
    {notice && <p className="multiclub-account__notice" role="status">{notice}</p>}
    <div className="multiclub-account__grid"><section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Datos</span><h2>Información personal</h2></div></div>
      <form onSubmit={saveProfile}><label>Nombre<input required minLength={2} maxLength={100} autoComplete="name" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
        <label>Teléfono<input maxLength={40} autoComplete="tel" value={profile.phone} onChange={(event) => setProfile({ ...profile, phone: event.target.value })} /></label>
        <label>Categoría<input maxLength={60} value={profile.category} onChange={(event) => setProfile({ ...profile, category: event.target.value })} /></label>
        <button disabled={Boolean(busy)} type="submit">{busy === "profile" ? "Guardando…" : "Guardar perfil"}</button></form></section>
      <section className="org-section"><div className="org-section__heading"><div><span className="org-eyebrow">Seguridad</span><h2>Cambiar contraseña</h2></div></div>
        <form onSubmit={savePassword}><label>Contraseña actual<input required type="password" autoComplete="current-password" value={password.current} onChange={(event) => setPassword({ ...password, current: event.target.value })} /></label>
          <label>Nueva contraseña<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password.next} onChange={(event) => setPassword({ ...password, next: event.target.value })} /></label>
          <label>Confirmar nueva contraseña<input required type="password" minLength={12} maxLength={72} autoComplete="new-password" value={password.confirm} onChange={(event) => setPassword({ ...password, confirm: event.target.value })} /></label>
          <button disabled={Boolean(busy)} type="submit">{busy === "password" ? "Actualizando…" : "Actualizar contraseña"}</button></form></section></div>
  </main>;
}
