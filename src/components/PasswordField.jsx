import React, { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { generateSecurePassword } from "../utils/password.js";

export default function PasswordField({
  id,
  label = "Contraseña",
  name = "password",
  value,
  onValueChange,
  autoComplete = "current-password",
  minLength,
  maxLength = 72,
  required = false,
  disabled = false,
  placeholder = "••••••••••••",
  showGenerator = false,
  className = "",
}) {
  const [visible, setVisible] = useState(false);

  const generate = () => {
    onValueChange(generateSecurePassword());
    setVisible(true);
  };

  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-xs text-slate-300">{label}</label>
      <div className="relative">
        <input
          id={id}
          name={name}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className="field pr-12"
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          required={required}
          disabled={disabled}
          autoCapitalize="none"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
          className="absolute inset-y-0 right-1 my-1 grid w-10 place-items-center rounded-xl text-slate-400 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime-300 disabled:opacity-40"
          aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {showGenerator && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={generate} disabled={disabled} className="inline-flex items-center gap-1.5 text-xs font-bold text-lime-200 transition hover:text-lime-100 disabled:opacity-40">
            <KeyRound size={14} aria-hidden="true" /> Generar contraseña segura
          </button>
          <span className="text-[11px] text-slate-500">12 caracteres mínimo</span>
        </div>
      )}
    </div>
  );
}
