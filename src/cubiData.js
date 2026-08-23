export const CUBI_STORAGE_KEY = "biblioanalytics_cubiculos";

export const cubiCarreras = [
  "Ing. Civil", "Ing. Software", "Medicina", "Derecho", "Psicología",
  "Contaduría", "Diseño", "Arquitectura", "Enfermería", "Admón. Empresas",
];

export function loadCubiculos() {
  try {
    const stored = localStorage.getItem(CUBI_STORAGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored, (k, v) => (k === "inicio" && v ? new Date(v) : v));
  } catch { return null; }
}

export function saveCubiculos(data) {
  try { localStorage.setItem(CUBI_STORAGE_KEY, JSON.stringify(data)); } catch {}
}
