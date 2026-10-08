import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.jsx";
import { useOrganizations } from "../hooks/useOrganizations.jsx";
import { apiRequest } from "../utils/apiClient.js";
import "./organizations.css";
import "./organizationStaff.css";

const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";
const roleName = { admin: "administración", receptionist: "recepción", teacher: "profesorado" };

export default function Invitation() {
  const { user, openLogin } = useAuth();
  const { refresh } = useOrganizations();
  const navigate = useNavigate();
  const [state, setState] = useState({ loading: true, invitation: null, error: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState({ loading: false, invitation: null, error: "El enlace de invitación está incompleto." }); return; }
    let active = true;
    apiRequest("/invitations/preview", { method: "POST", body: JSON.stringify({ token }), notifyAuthExpired: false })
      .then(({ invitation }) => { if (active) setState({ loading: false, invitation, error: "" }); })
      .catch((error) => { if (active) setState({ loading: false, invitation: null, error: error.message }); });
    return () => { active = false; };
  }, []);

  async function accept() {
    setBusy(true);
    try {
      await apiRequest("/invitations/accept", { method: "POST", body: JSON.stringify({ token }) });
      window.history.replaceState(null, "", window.location.pathname);
      await refresh();
      navigate("/clubes", { replace: true });
    } catch (error) {
      setState((current) => ({ ...current, error: error.message }));
    } finally { setBusy(false); }
  }

  return <main className="org-page"><section className="org-section" style={{ maxWidth: 680, margin: "4rem auto" }}>
    <div className="org-section__heading"><div><span className="org-eyebrow">Acceso al club</span><h1>Tu invitación</h1></div></div>
    {state.loading ? <p role="status">Consultando la invitación…</p> : state.invitation ? <>
      <p>Te invitaron a <strong>{state.invitation.clubName}</strong> para trabajar en {roleName[state.invitation.role]}.</p>
      <p>Cuenta invitada: <strong>{state.invitation.email}</strong>.</p>
      {state.invitation.venues.length > 0 && <p>Sedes: {state.invitation.venues.map((venue) => venue.name).join(", ")}.</p>}
      <p>El enlace vence el {new Date(state.invitation.expiresAt).toLocaleString("es-AR")} y se puede usar una sola vez.</p>
      {!user ? <><p>Ingresá o registrate con el email invitado para aceptar.</p><button type="button" className="org-staff-create-button" onClick={openLogin}>Ingresar o registrarme</button></>
        : user.email.toLowerCase() !== state.invitation.email ? <p role="alert">Ingresaste como {user.email}. Cerrá sesión e ingresá con el email invitado.</p>
          : <button type="button" className="org-staff-create-button" disabled={busy} onClick={accept}>{busy ? "Activando acceso…" : "Aceptar invitación"}</button>}
    </> : null}
    {state.error && <p className="org-staff-notice" role="alert">{state.error}</p>}
    <p><Link to="/clubes">Ir a mis clubes</Link></p>
  </section></main>;
}
