export const CUBI_STORAGE_KEY  = "biblioanalytics_cubiculos";
export const CUBI_ACCOUNTS_KEY = "biblioanalytics_alumnos";
export const CUBI_CONFIG_KEY   = "biblioanalytics_config";

export const DEFAULT_CUBI_CONFIG = { minPersonas: 3, maxPersonas: 5 };

export const cubiCarreras = [
  // Licenciaturas
  "Biología", "Biotecnología", "Cirujano Dentista", "Enfermería",
  "Entrenamiento Deportivo", "Fisioterapia y Rehabilitación", "Gerontología",
  "Médico Cirujano", "Médico Veterinario Zootecnista (MVZ)", "Nutrición",
  "Química", "Químico Farmacéutico Biólogo (QFB)",
  // Especialidades
  "Endodoncia", "Medicina y Cirugía en Pequeñas Especies", "Odontopediatría",
  "Ortodoncia", "Patología y Medicina Bucal", "Periodoncia",
  "Prótesis Fija y Removible",
  // Maestrías
  "Maestría en Actividad Física para la Salud", "Maestría en Ciencias Genómicas",
  "Maestría en Ciencias Odontológicas", "Maestría en Ciencias Químico-Biológicas",
  "Maestría en Ciencias Veterinarias", "Maestría en Salud Pública",
  // Doctorados
  "Doctorado en Ciencias Químico-Biológicas", "Doctorado en Investigación en Salud Humana y Animal",
];

// ── Cubículos ─────────────────────────────────────────────
export function loadCubiculos() {
  try {
    const s = localStorage.getItem(CUBI_STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s, (k, v) => (k === "inicio" && v ? new Date(v) : v));
  } catch { return null; }
}

export function saveCubiculos(data) {
  try { localStorage.setItem(CUBI_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ── Cuentas de alumnos ────────────────────────────────────
export function loadAccounts() {
  try {
    const s = localStorage.getItem(CUBI_ACCOUNTS_KEY);
    return s ? JSON.parse(s) : [];
  } catch { return []; }
}

export function saveAccounts(accounts) {
  try { localStorage.setItem(CUBI_ACCOUNTS_KEY, JSON.stringify(accounts)); } catch {}
}

export function findAccount(matricula) {
  const accounts = loadAccounts();
  return accounts.find(
    a => String(a.matricula).toLowerCase() === String(matricula).toLowerCase().trim()
  ) || null;
}

// ── Configuración del servicio ────────────────────────────
export function loadCubiConfig() {
  try {
    const s = localStorage.getItem(CUBI_CONFIG_KEY);
    return s ? { ...DEFAULT_CUBI_CONFIG, ...JSON.parse(s) } : { ...DEFAULT_CUBI_CONFIG };
  } catch { return { ...DEFAULT_CUBI_CONFIG }; }
}

export function saveCubiConfig(cfg) {
  try { localStorage.setItem(CUBI_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}

// ── Computadoras ──────────────────────────────────────────
export const COMPU_STORAGE_KEY = "biblioanalytics_computadoras";

export function loadComputadoras() {
  try {
    const s = localStorage.getItem(COMPU_STORAGE_KEY);
    if (!s) return null;
    return JSON.parse(s, (k, v) => (k === "inicio" && v ? new Date(v) : v));
  } catch { return null; }
}

export function saveComputadoras(data) {
  try { localStorage.setItem(COMPU_STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export const compuZonas   = ["Sala General", "Sala Silencio", "Sala Investigación"];
export const compuSistemas = ["Windows 11", "Ubuntu 22.04"];
