import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PasswordField from "../components/PasswordField.jsx";
import { ROUTES } from "../constants/routes.js";
import { apiRequest } from "../utils/apiClient.js";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault(); setError("");
    if (password !== confirm) return setError("Las contraseñas no coinciden.");
    setBusy(true);
    try {
      await apiRequest("/auth/password/reset", { method: "POST", body: JSON.stringify({ token, password }) });
      setComplete(true);
      setPassword(""); setConfirm("");
    } catch (requestError) {
      setError(requestError.message || "No pudimos restablecer la contraseña.");
    } finally { setBusy(false); }
  }

  return <main className="main-container interior-page text-white"><section className="interior-hero mx-auto max-w-xl rounded-[2rem] p-6 md:p-9"><p className="text-[11px] font-black uppercase tracking-[0.24em] text-lime-300">Seguridad de la cuenta</p><h1 className="mt-3 text-3xl font-black">{complete ? "Contraseña actualizada" : "Creá una nueva contraseña"}</h1>{complete ? <div className="mt-6"><p className="text-sm leading-6 text-slate-300">El enlace quedó invalidado y cerramos las sesiones anteriores. Ya podés ingresar con tu nueva clave.</p><Link to={ROUTES.ACCOUNT} className="btn-primary mt-6">Ingresar a PadelBook</Link></div> : token ? <form onSubmit={submit} className="mt-6 space-y-4"><p className="text-sm leading-6 text-slate-300">Usá al menos 12 caracteres. El enlace funciona una sola vez.</p>{error && <p role="alert" className="rounded-2xl border border-rose-300/30 bg-rose-400/10 p-3 text-sm text-rose-100">{error}</p>}<PasswordField id="reset-password" label="Nueva contraseña" value={password} onValueChange={setPassword} autoComplete="new-password" minLength={12} required showGenerator /><PasswordField id="reset-password-confirm" label="Repetir contraseña" value={confirm} onValueChange={setConfirm} autoComplete="new-password" minLength={12} required /><button disabled={busy} className="btn-primary w-full justify-center">{busy ? "Guardando..." : "Guardar nueva contraseña"}</button></form> : <div className="mt-6"><p role="alert" className="text-sm text-rose-100">Este enlace no contiene un token válido. Solicitá uno nuevo desde el ingreso.</p><Link to={ROUTES.ACCOUNT} className="btn-outline mt-6">Volver al ingreso</Link></div>}</section></main>;
}
