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
  // Personal
  "Docente", "Empleado",
];

export const compuZonas    = ["Sala General", "Sala Silencio", "Sala Investigación"];
export const compuSistemas = ["Windows 11", "Ubuntu 22.04"];

// Config del servicio — único uso de localStorage permitido (preferencia de UI, no datos)
export function loadCubiConfig() {
  try {
    const s = localStorage.getItem(CUBI_CONFIG_KEY);
    return s ? { ...DEFAULT_CUBI_CONFIG, ...JSON.parse(s) } : { ...DEFAULT_CUBI_CONFIG };
  } catch { return { ...DEFAULT_CUBI_CONFIG }; }
}

export function saveCubiConfig(cfg) {
  try { localStorage.setItem(CUBI_CONFIG_KEY, JSON.stringify(cfg)); } catch {}
}
