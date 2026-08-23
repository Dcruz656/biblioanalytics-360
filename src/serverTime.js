// Diferencia entre tiempo del servidor y tiempo local (ms)
let _offset = 0;

// Devuelve el tiempo del servidor en milisegundos (equivalente a Date.now() sincronizado)
export function serverNow() {
  return Date.now() + _offset;
}

async function fetchOffset() {
  try {
    const t0 = Date.now();
    // HEAD al mismo origen — Vercel y Vite devuelven cabecera Date
    const res = await fetch(`/?_st=${t0}`, { method: "HEAD", cache: "no-store" });
    const t1 = Date.now();
    const dateStr = res.headers.get("date");
    if (dateStr) {
      const serverMs = new Date(dateStr).getTime();
      // Compensar latencia usando el punto medio del round-trip
      _offset = serverMs - Math.round((t0 + t1) / 2);
    }
  } catch {
    // Sin sincronización → usar tiempo local
    _offset = 0;
  }
}

// Llamar una vez al iniciar la app; re-sincroniza cada 5 min
export function startTimeSync() {
  fetchOffset();
  setInterval(fetchOffset, 5 * 60 * 1000);
}
