import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

const ToastContext = createContext(null);

const tones = {
  success: "border-emerald-300/30 bg-emerald-300/12 text-emerald-50",
  warning: "border-amber-300/30 bg-amber-300/12 text-amber-50",
  error: "border-rose-300/30 bg-rose-300/12 text-rose-50",
  info: "border-sky-300/30 bg-sky-300/12 text-sky-50",
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((toast) => {
    const id = crypto?.randomUUID?.() || `toast-${Date.now()}`;
    const nextToast = {
      id,
      type: toast.type || "success",
      title: toast.title || "Listo",
      message: toast.message || "",
    };
    setToasts((current) => [nextToast, ...current].slice(0, 3));
    window.setTimeout(() => dismiss(id), toast.duration || 3600);
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[80] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
        {toasts.map((toast) => (
          <article
            key={toast.id}
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_18px_55px_rgba(0,0,0,0.45)] backdrop-blur-xl transition ${tones[toast.type] || tones.success}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black">{toast.title}</p>
                {toast.message && <p className="mt-1 text-xs leading-5 text-slate-200/80">{toast.message}</p>}
              </div>
              <button type="button" className="text-xs font-black opacity-60 hover:opacity-100" onClick={() => dismiss(toast.id)} aria-label="Cerrar notificacion">
                x
              </button>
            </div>
          </article>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
