import { teachers as defaultTeachers } from "../data/adminMock.js";
import { safeRead, safeWrite } from "./storage.js";

export const TEACHERS_STORAGE_KEY = "padel_teachers";

export function loadTeachers(classPrice = 30000) {
  const saved = safeRead(TEACHERS_STORAGE_KEY, null);
  const base = Array.isArray(saved) && saved.length ? saved : defaultTeachers;
  return base.map((t) => ({ ...t, price: Number(t.price ?? classPrice) }));
}

export function saveTeachers(teachers) {
  safeWrite(TEACHERS_STORAGE_KEY, teachers || []);
  return teachers || [];
}
