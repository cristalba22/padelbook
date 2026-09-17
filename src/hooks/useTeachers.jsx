import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "./useAuth.jsx";
import { usePricing } from "../context/PricingContext.jsx";
import { apiRequest } from "../utils/apiClient.js";
import { loadTeachers, saveTeachers, TEACHERS_STORAGE_KEY } from "../utils/teachersStorage.js";

const TeachersContext = createContext(null);

export function TeachersProvider({ children }) {
  const { apiOnline } = useAuth();
  const { prices } = usePricing();
  const [teachers, setTeachers] = useState(() => apiOnline ? [] : loadTeachers(prices.classPrice));
  const [error, setError] = useState("");
  const saved = useRef([]);

  const refresh = useCallback(async () => {
    if (!apiOnline) {
      const local = loadTeachers(prices.classPrice);
      saved.current = local;
      setTeachers(local);
      setError("");
      return;
    }
    setTeachers([]);
    try {
      const { teachers: remote } = await apiRequest("/teachers");
      saved.current = remote || [];
      setTeachers(remote || []);
      setError("");
    } catch (cause) {
      setTeachers([]);
      setError(cause.message || "No se pudieron cargar los profesores.");
    }
  }, [apiOnline, prices.classPrice]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (apiOnline) return;
    const sync = (event) => { if (!event.key || event.key === TEACHERS_STORAGE_KEY) refresh(); };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [apiOnline, refresh]);

  function updateTeacher(id, patch) {
    setTeachers((current) => current.map((teacher) => String(teacher.id) === String(id) ? { ...teacher, ...patch } : teacher));
  }

  async function save() {
    if (!apiOnline) {
      saveTeachers(teachers);
      saved.current = teachers;
      return;
    }
    for (const teacher of teachers) {
      const previous = saved.current.find((item) => item.id === teacher.id);
      if (!previous) continue;
      const patch = {};
      if (previous.status !== teacher.status) patch.status = teacher.status;
      if (Number(previous.price) !== Number(teacher.price)) patch.price = Number(teacher.price);
      if (Object.keys(patch).length) await apiRequest(`/admin/teachers/${teacher.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    }
    await refresh();
  }

  async function create(details) {
    if (apiOnline) {
      await apiRequest("/admin/teachers", { method: "POST", body: JSON.stringify(details) });
      await refresh();
      return;
    }
    const next = [...teachers, { id: `teacher-${Date.now()}`, status: "activo", todayClasses: 0, ...details }];
    saveTeachers(next);
    saved.current = next;
    setTeachers(next);
  }

  const value = useMemo(() => ({ teachers, error, refresh, updateTeacher, save, create }), [teachers, error, refresh]);
  return <TeachersContext.Provider value={value}>{children}</TeachersContext.Provider>;
}

export function useTeachers() {
  const context = useContext(TeachersContext);
  if (!context) throw new Error("useTeachers requiere TeachersProvider");
  return context;
}
