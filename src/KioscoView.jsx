import { useState, useEffect, useRef } from "react";
import {
  loadCubiConfig, CUBI_CONFIG_KEY,
  compuZonas,
} from "./cubiData";
import {
  dbLoadCubiculos, dbSaveCubiculo, dbSeedCubiculos,
  dbLoadComputadoras, dbSaveComputadora, dbSeedComputadoras,
  dbFindAlumno, dbGetPushSubscriptions,
  subscribeCubiculos, subscribeComputadoras,
  loadAppConfig, dbLoadAppConfig, subscribeAppConfig,
  dbSaveHistorialReserva,
} from "./db";
import { registerServiceWorker, sendPush } from "./pushNotifications";
import { QRCodeSVG } from "qrcode.react";
import { serverNow } from "./serverTime";

const NAVY_DEEP = "#060d1b";
const NAVY      = "#0e1629";
const CARD      = "#131c2e";
const TEAL      = "#0d9488";
const TEAL_L    = "#14b8a6";
const GREEN     = "#059669";
const ROSE      = "#e11d48";
const AMBER     = "#d97706";

const ADVANCE_MS = 30 * 60 * 1000; // ventana de 30 min para reserva anticipada

// ── Horario de servicio ────────────────────────────────────────────────────
// Lunes–Viernes 08:00–18:00 · Sábado 10:00–16:00 · Domingo cerrado
const HORARIO = {
  // [apertura_min, cierre_min]  (minutos desde medianoche)
  1: [480, 1080], 2: [480, 1080], 3: [480, 1080], 4: [480, 1080], 5: [480, 1080], // L-V
  6: [600, 960],  // Sábado 10:00-16:00
  0: null,        // Domingo cerrado
};

function getOperatingWindow(now = new Date()) {
  return HORARIO[now.getDay()] ?? null;
}

function isWithinOperatingHours(now = new Date()) {
  const win = getOperatingWindow(now);
  if (!win) return false;
  const min = now.getHours() * 60 + now.getMinutes();
  return min >= win[0] && min < win[1];
}

function operatingHoursMessage(now = new Date()) {
  const day = now.getDay();
  if (day === 0) return "La biblioteca no presta servicios los domingos.";
  const win = HORARIO[day];
  if (!win) return "Fuera de horario de servicio.";
  const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const min = now.getHours() * 60 + now.getMinutes();
  if (min < win[0]) return `El servicio abre a las ${fmt(win[0])} h.`;
  return `El servicio cerró a las ${fmt(win[1])} h. ${day === 6 ? "El lunes retomamos de 8:00 a 18:00 h." : "Horario: Lun–Vie 8:00–18:00 · Sáb 10:00–16:00"}`;
}

// Ícono de biblioteca (edificio con columnas y libro)
function LibraryIcon({ size = 64 }) {
  const linesL = [230, 252, 274, 296, 318, 340];
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      {/* Líneas de suelo */}
      <line x1="82"  y1="432" x2="430" y2="432" stroke="#B0AFC0" strokeWidth="9" strokeLinecap="round"/>
      <line x1="105" y1="450" x2="407" y2="450" stroke="#B0AFC0" strokeWidth="9" strokeLinecap="round"/>
      {/* Base — sombra */}
      <rect x="54" y="384" width="404" height="38" rx="19" fill="#D97706"/>
      {/* Base — principal */}
      <rect x="54" y="370" width="404" height="38" rx="19" fill="#FCA326" stroke="#3C3580" strokeWidth="7"/>
      {/* Columnas azules (anchas) */}
      <rect x="76"  y="188" width="70" height="186" rx="5" fill="#7090E8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="366" y="188" width="70" height="186" rx="5" fill="#7090E8" stroke="#3C3580" strokeWidth="6"/>
      {/* Columnas cian (estrechas) */}
      <rect x="160" y="188" width="44" height="186" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="308" y="188" width="44" height="186" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="6"/>
      {/* Lomo del libro (cian) */}
      <rect x="240" y="188" width="32" height="178" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="5"/>
      {/* Página izquierda */}
      <path d="M165,206 Q200,198 240,214 L240,364 Q200,356 165,362 Z" fill="#CCCAD8" stroke="#3C3580" strokeWidth="5"/>
      {/* Página derecha */}
      <path d="M272,214 Q312,198 347,206 L347,362 Q312,356 272,364 Z" fill="#CCCAD8" stroke="#3C3580" strokeWidth="5"/>
      {/* Líneas página izquierda */}
      {linesL.map((y, i) => <line key={i} x1="180" y1={y} x2="234" y2={y - 2} stroke="#3C3580" strokeWidth="6" strokeLinecap="round"/>)}
      {/* Líneas página derecha */}
      {linesL.map((y, i) => <line key={i} x1="278" y1={y - 2} x2="332" y2={y} stroke="#3C3580" strokeWidth="6" strokeLinecap="round"/>)}
      {/* Tejado — sombra */}
      <polygon points="48,202 256,60 464,202" fill="#D97706" stroke="#3C3580" strokeWidth="7" strokeLinejoin="round"/>
      {/* Tejado — principal */}
      <polygon points="48,192 256,50 464,192" fill="#FCA326" stroke="#3C3580" strokeWidth="7" strokeLinejoin="round"/>
    </svg>
  );
}

// Ícono de cubículo (vista superior con 4 puestos y sillas)
function CubiIcon({ size = 54, color = "white" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill={color} xmlns="http://www.w3.org/2000/svg">
      {/* Divisores centrales */}
      <rect x="46" y="0" width="8" height="100"/>
      <rect x="0" y="46" width="100" height="8"/>
      <circle cx="50" cy="50" r="7"/>
      {/* Cubículo sup-izq: escritorio arriba, silla abajo */}
      <rect x="6" y="4" width="34" height="12" rx="2"/>
      <circle cx="22" cy="32" r="8"/>
      <rect x="5"  y="28" width="5" height="9" rx="2"/>
      <rect x="33" y="28" width="5" height="9" rx="2"/>
      {/* Cubículo sup-der: escritorio arriba, silla abajo */}
      <rect x="60" y="4" width="34" height="12" rx="2"/>
      <circle cx="78" cy="32" r="8"/>
      <rect x="61" y="28" width="5" height="9" rx="2"/>
      <rect x="89" y="28" width="5" height="9" rx="2"/>
      {/* Cubículo inf-izq: silla arriba, escritorio abajo */}
      <circle cx="22" cy="68" r="8"/>
      <rect x="5"  y="64" width="5" height="9" rx="2"/>
      <rect x="33" y="64" width="5" height="9" rx="2"/>
      <rect x="6" y="84" width="34" height="12" rx="2"/>
      {/* Cubículo inf-der: silla arriba, escritorio abajo */}
      <circle cx="78" cy="68" r="8"/>
      <rect x="61" y="64" width="5" height="9" rx="2"/>
      <rect x="89" y="64" width="5" height="9" rx="2"/>
      <rect x="60" y="84" width="34" height="12" rx="2"/>
    </svg>
  );
}

// ── Helpers ──────────────────────────────────────────────
function generateFolio() {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  return `CUB-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${String(Date.now()).slice(-4)}`;
}
function addMinutes(date, m) { return new Date(date.getTime() + m * 60000); }
function fmtTime(date) { return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); }
function initials(name) { return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }

function getRemainingMs(cubi) {
  if (!cubi?.reserva?.inicio) return 0;
  const end = new Date(cubi.reserva.inicio).getTime() + cubi.reserva.duracion * 3_600_000;
  return Math.max(0, end - serverNow());
}

function fmtRemaining(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2,"0")}m`;
  return `${m}m ${String(s).padStart(2,"0")}s`;
}

function fmtRing(ms) {
  const s = Math.floor(ms / 1000);
  if (s <= 0) return "0s";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`;
}

function applyAutoRelease(cubiList) {
  const FIVE_MIN = 5 * 60 * 1000;
  let changed = false;
  const result = cubiList.map(c => {
    if (c.estado === "reservado" && c.reserva?.pendingCheckin && c.reserva?.reservedAt) {
      if (Date.now() - new Date(c.reserva.reservedAt).getTime() > FIVE_MIN) {
        changed = true;
        return { ...c, estado: "libre", reserva: null };
      }
      return c;
    }
    if (c.estado !== "ocupado" || !c.reserva) return c;
    if (getRemainingMs(c) > 0) return c;
    changed = true;
    if (c.nextReserva) return { ...c, reserva: { ...c.nextReserva, inicio: new Date(serverNow()) }, nextReserva: null };
    return { ...c, estado: "libre", reserva: null };
  });
  return changed ? result : null;
}

// ── TopBar ───────────────────────────────────────────────
function TopBar({ onBack, title, clock }) {
  const fmtClock = clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
  const fmtDate  = clock.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long" });
  return (
    <div style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {onBack && (
          <button onClick={onBack} style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            ← Atrás
          </button>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>📚</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Biblioteca de ICB</div>
            {title && <div style={{ fontSize: 11, color: TEAL }}>{title}</div>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{fmtClock}</div>
        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>{fmtDate}</div>
      </div>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────
export default function KioscoView() {
  // screens: idle | matricula | mi_reserva | proxima_reserva | bienvenido | browse | duration | success
  const [screen,          setScreen]          = useState("idle");
  const [installPrompt,   setInstallPrompt]   = useState(null);
  const [showInstall,     setShowInstall]      = useState(false);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); setShowInstall(true); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);
  const [clock,           setClock]           = useState(new Date(serverNow()));
  const [cubiculos,       setCubiculos]       = useState([]);
  const [cubiConfig,      setCubiConfig]      = useState({ minPersonas: 3, maxPersonas: 5 });
  const [matriculaInput,  setMatriculaInput]  = useState("");
  const [account,         setAccount]         = useState(null);
  const [lookupError,     setLookupError]     = useState("");
  const [looking,         setLooking]         = useState(false);
  const [personas,        setPersonas]        = useState(3);
  const [selectedId,      setSelectedId]      = useState(null);
  const [duracion,        setDuracion]        = useState(2);
  const [folio,           setFolio]           = useState("");
  const [countdown,       setCountdown]       = useState(15);
  const [pisoFilter,      setPisoFilter]      = useState(0);
  const [pulse,           setPulse]           = useState(true);
  const [confirmTerminar, setConfirmTerminar] = useState(false);
  const [pinTerminar,     setPinTerminar]     = useState('');
  const [pinTerminarErr,  setPinTerminarErr]  = useState('');
  const [confirmando,     setConfirmando]     = useState(false);
  const [renovando,       setRenovando]       = useState(false);
  const [servicio,        setServicio]        = useState("cubiculos");
  const [computadoras,    setComputadoras]    = useState([]);
  const [compuSelectedId, setCompuSelectedId] = useState(null);
  const [compuZonaFilter, setCompuZonaFilter] = useState("Todas");
  // PIN verification
  const [pendingAccount,  setPendingAccount]  = useState(null);
  const [pendingDest,     setPendingDest]     = useState(null); // { screen, selectedId, compuSelectedId }
  const [pinInput,        setPinInput]        = useState("");
  const [pinError,        setPinError]        = useState("");
  const [pinAttempts,     setPinAttempts]     = useState(0);
  const [pinRequired,     setPinRequired]     = useState(true);
  useEffect(() => { dbLoadAppConfig().then(cfg => setPinRequired(cfg.pinRequired)); }, []);

  // Refs para notificaciones push: evitar re-envío de la misma alerta
  const pushWarnedRef = useRef(new Set()); // keys tipo "cubiId-inicioISO" ya advertidas a 10 min
  const cubiculosRef  = useRef([]);        // snapshot actualizado sin closure stale

  useEffect(() => { cubiculosRef.current = cubiculos; }, [cubiculos]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setClock(new Date(serverNow())), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const cfg = loadCubiConfig();
    setCubiConfig(cfg);
    setPersonas(cfg.minPersonas);
    dbLoadCubiculos().then(data => {
      if (data && data.length > 0) setCubiculos(data);
    });
    const unsub = subscribeCubiculos((row, eventType) => {
      if (eventType === 'DELETE') {
        setCubiculos(prev => prev.filter(c => c.id !== row.id));
      } else {
        setCubiculos(prev => {
          const idx = prev.findIndex(c => c.id === row.id);
          if (idx >= 0) { const a = [...prev]; a[idx] = row; return a; }
          return [...prev, row];
        });
      }
    });
    const handler = (e) => {
      if (e.key === CUBI_CONFIG_KEY && e.newValue) {
        try { setCubiConfig(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => { unsub(); window.removeEventListener("storage", handler); };
  }, []);

  // Auto-liberar reservas expiradas cada 30s + push notifications
  useEffect(() => {
    const check = () => {
      // Aviso 10 min antes — usa ref para evitar closure stale
      cubiculosRef.current.forEach(c => {
        if (c.estado !== 'ocupado' || !c.reserva?.matricula) return;
        const remainMs = getRemainingMs(c);
        const warnKey  = `${c.id}-${String(c.reserva.inicio)}`;
        if (remainMs > 0 && remainMs <= 10 * 60 * 1000 && !pushWarnedRef.current.has(warnKey)) {
          pushWarnedRef.current.add(warnKey);
          const minLeft = Math.ceil(remainMs / 60000);
          dbGetPushSubscriptions(c.reserva.matricula).then(subs => {
            subs.forEach(sub => sendPush(sub, `⏰ Te quedan ${minLeft} min`, `Tu reserva en ${c.nombre} vence pronto. Libera el espacio a tiempo.`));
          });
        }
      });

      // Auto-liberar cubículos expirados
      setCubiculos(prev => {
        const updated = applyAutoRelease(prev);
        if (updated) {
          updated.forEach((c, i) => {
            if (c === prev[i]) return;
            const old = prev[i];
            if (old?.reserva?.matricula) {
              const res = old.reserva;
              if (res.pendingCheckin) {
                // Tolerancia de check-in expirada — sin historial (no hubo uso real)
                dbGetPushSubscriptions(res.matricula).then(subs => {
                  subs.forEach(sub => sendPush(sub, '❌ Reserva cancelada', `No se detectó check-in en ${old.nombre} dentro del tiempo de tolerancia. El espacio fue liberado.`));
                });
              } else if (res.inicio) {
                const hh = new Date(res.inicio).getHours();
                const turno = hh >= 7 && hh < 14 ? 'Matutino' : hh >= 14 && hh < 20 ? 'Vespertino' : 'Nocturno';
                dbSaveHistorialReserva({
                  cubicule: old.nombre, tipo: 'cubiculos',
                  nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
                  duracion: res.duracion, personas: res.personas || null, piso: old.piso,
                  inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
                  fin: new Date(serverNow()).toISOString(), turno,
                });
                dbGetPushSubscriptions(res.matricula).then(subs => {
                  subs.forEach(sub => sendPush(sub, '📚 Tu tiempo ha terminado', `Tu sesión en ${old.nombre} venció. Gracias por usar la biblioteca.`));
                });
              }
            }
            dbSaveCubiculo(c);
          });
          return updated;
        }
        return prev;
      });

      // Auto-liberar computadoras expiradas
      setComputadoras(prev => {
        const updated = applyAutoRelease(prev);
        if (updated) {
          updated.forEach((c, i) => {
            if (c === prev[i]) return;
            const old = prev[i];
            if (old?.reserva?.matricula) {
              const res = old.reserva;
              const hh = new Date(res.inicio).getHours();
              const turno = hh >= 7 && hh < 14 ? 'Matutino' : hh >= 14 && hh < 20 ? 'Vespertino' : 'Nocturno';
              dbSaveHistorialReserva({
                cubicule: old.nombre, tipo: 'computadoras',
                nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
                duracion: res.duracion, personas: null, piso: null,
                inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
                fin: new Date(serverNow()).toISOString(), turno,
              });
              dbGetPushSubscriptions(res.matricula).then(subs => {
                subs.forEach(sub => sendPush(sub, '💻 Tu sesión ha vencido', `Tu tiempo en ${old.nombre} ha terminado. Por favor libera la computadora.`));
              });
            }
            dbSaveComputadora(c);
          });
          return updated;
        }
        return prev;
      });
    };
    check();
    const t = setInterval(check, 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    dbLoadComputadoras().then(data => {
      if (data && data.length > 0) setComputadoras(data);
    });
    const unsub = subscribeComputadoras((row, eventType) => {
      if (eventType === 'DELETE') {
        setComputadoras(prev => prev.filter(c => c.id !== row.id));
      } else {
        setComputadoras(prev => {
          const idx = prev.findIndex(c => c.id === row.id);
          if (idx >= 0) { const a = [...prev]; a[idx] = row; return a; }
          return [...prev, row];
        });
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (screen !== "success") return;
    let c = 15; setCountdown(c);
    const t = setInterval(() => { c -= 1; setCountdown(c); if (c <= 0) { clearInterval(t); resetToIdle(); } }, 1000);
    return () => clearInterval(t);
  }, [screen]);

  // Escuchar cambios de config (PIN habilitado/deshabilitado) desde admin
  useEffect(() => {
    const unsub = subscribeAppConfig(cfg => {
      if (typeof cfg.pinRequired === "boolean") setPinRequired(cfg.pinRequired);
    });
    return unsub;
  }, []);

  // Auto-redirigir al inicio cuando expira la reserva activa del alumno
  // Deps use IDs and raw arrays to avoid TDZ — selectedCubi/selectedCompu are declared below
  useEffect(() => {
    const cubi  = cubiculos.find(c => c.id === selectedId) || null;
    const compu = computadoras.find(c => c.id === compuSelectedId) || null;
    if (screen === "mi_reserva" && cubi) {
      const isPendingCheckin = cubi.estado === "reservado" && cubi.reserva?.pendingCheckin;
      if (!isPendingCheckin && cubi.estado !== "ocupado") {
        resetToIdle();
      } else if (cubi.estado === "ocupado" && getRemainingMs(cubi) <= 0) {
        terminarUso();
      }
    }
    if (screen === "mi_compu" && compu) {
      if (compu.estado !== "ocupado") {
        resetToIdle();
      } else if (getRemainingMs(compu) <= 0) {
        terminarUsoCompu();
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, cubiculos, computadoras, selectedId, compuSelectedId]);

  function resetToIdle() {
    setScreen("idle");
    setMatriculaInput(""); setAccount(null); setLookupError(""); setLooking(false);
    setPersonas(cubiConfig.minPersonas);
    setSelectedId(null); setDuracion(2); setFolio(""); setPisoFilter(0); setConfirmTerminar(false);
    setServicio("cubiculos"); setCompuSelectedId(null); setCompuZonaFilter("Todas");
    setPendingAccount(null); setPendingDest(null); setPinInput(""); setPinError(""); setPinAttempts(0);
  }

  function handleLookup() {
    if (!matriculaInput.trim()) { setLookupError("Ingresa tu matrícula"); return; }
    setLooking(true); setLookupError("");

    // Aplicar auto-liberación antes de buscar para datos frescos
    let cubiActuales = cubiculos;
    const released = applyAutoRelease(cubiculos);
    if (released) {
      setCubiculos(released);
      released.filter((c, i) => c !== cubiculos[i]).forEach(c => dbSaveCubiculo(c));
      cubiActuales = released;
    }

    dbFindAlumno(matriculaInput.trim()).then(found => {
      setLooking(false);
      if (!found) { setLookupError("not_found"); return; }

      // Determinar destino tras verificar PIN
      const activeCubi  = cubiActuales.find(c => (c.estado === "ocupado" || (c.estado === "reservado" && c.reserva?.pendingCheckin)) && c.reserva?.matricula === found.matricula);
      const advanceCubi = cubiActuales.find(c => c.nextReserva?.matricula === found.matricula);
      const activeCompu = computadoras.find(c => c.estado === "ocupado" && c.reserva?.matricula === found.matricula);

      let dest = { screen: "bienvenido", selectedId: null, compuSelectedId: null };
      if (activeCubi)  dest = { screen: "mi_reserva",      selectedId: activeCubi.id,  compuSelectedId: null };
      else if (advanceCubi) dest = { screen: "proxima_reserva", selectedId: advanceCubi.id, compuSelectedId: null };
      else if (activeCompu) dest = { screen: "mi_compu",   selectedId: null, compuSelectedId: activeCompu.id };

      if (!pinRequired) {
        // PIN desactivado — ir directo al destino
        setAccount(found);
        setSelectedId(dest.selectedId);
        setCompuSelectedId(dest.compuSelectedId);
        setScreen(dest.screen);
      } else {
        setPendingAccount(found);
        setPendingDest(dest);
        setPinInput("");
        setPinError("");
        setPinAttempts(0);
        setScreen("pin_verify");
      }
    });
  }

  async function terminarUso() {
    const changed = cubiculos.find(c => c.id === selectedId);
    if (!changed) return;

    // Validar PIN antes de ejecutar
    const alumno = await dbFindAlumno(changed.reserva?.matricula);
    if (!alumno || String(alumno.pin) !== pinTerminar.trim()) {
      setPinTerminarErr('PIN incorrecto. Intenta de nuevo.');
      return;
    }

    if (changed.reserva && changed.reserva.inicio) {
      const res = changed.reserva;
      const h = new Date(res.inicio).getHours();
      const turno = h >= 7 && h < 14 ? 'Matutino' : h >= 14 && h < 20 ? 'Vespertino' : 'Nocturno';
      dbSaveHistorialReserva({
        cubicule: changed.nombre, tipo: 'cubiculos',
        nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
        duracion: res.duracion, personas: res.personas || null, piso: changed.piso,
        inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
        fin: new Date(serverNow()).toISOString(), turno,
      });
    }
    const newState = changed.nextReserva
      ? { ...changed, reserva: { ...changed.nextReserva, inicio: new Date(serverNow()) }, nextReserva: null }
      : { ...changed, estado: "libre", reserva: null };
    setCubiculos(prev => prev.map(c => c.id === selectedId ? newState : c));
    dbSaveCubiculo(newState);
    setPinTerminar(''); setPinTerminarErr('');
    resetToIdle();
  }

  function cancelarProximaReserva() {
    const changed = cubiculos.find(c => c.id === selectedId);
    if (!changed) return;
    const newState = { ...changed, nextReserva: null };
    setCubiculos(prev => prev.map(c => c.id === selectedId ? newState : c));
    dbSaveCubiculo(newState);
    resetToIdle();
  }

  async function confirmarReserva() {
    if (confirmando) return;
    if (!isWithinOperatingHours(new Date(serverNow()))) { setScreen("bienvenido"); return; }
    const cubi = cubiculos.find(c => c.id === selectedId);
    if (!cubi || !account) return;

    setConfirmando(true);
    try {
      // Re-fetch fresh state to prevent race condition (Realtime lag between kiosks)
      const fresh = await dbLoadCubiculos();
      if (fresh && fresh.length > 0) {
        setCubiculos(fresh);
        const freshCubi = fresh.find(c => c.id === selectedId);
        if (freshCubi) {
          const isAdvanceFlow = cubi.estado === "ocupado";
          if (!isAdvanceFlow && freshCubi.estado !== "libre") {
            // Cubículo ya tomado — regresar a selección con datos actualizados
            setScreen("cubiculos");
            return;
          }
          if (isAdvanceFlow && (freshCubi.estado !== "ocupado" || freshCubi.nextReserva)) {
            setScreen("cubiculos");
            return;
          }
        }
      }

      const f = generateFolio();
      let newState;
      if (cubi.estado === "ocupado") {
        newState = { ...cubi, nextReserva: { nombre: account.nombre, matricula: account.matricula, carrera: account.carrera, duracion, personas } };
      } else {
        newState = { ...cubi, estado: "reservado", reserva: { nombre: account.nombre, matricula: account.matricula, carrera: account.carrera, duracion, personas, inicio: null, pendingCheckin: true, reservedAt: new Date(serverNow()).toISOString() } };
      }
      setCubiculos(prev => prev.map(c => c.id === selectedId ? newState : c));
      await dbSaveCubiculo(newState);
      dbGetPushSubscriptions(account.matricula).then(subs => {
        if (cubi.estado === "ocupado") {
          subs.forEach(sub => sendPush(sub, '🔔 Reserva anticipada registrada', `Tu lugar en ${cubi.nombre} quedará listo cuando salga el ocupante actual.`));
        } else {
          subs.forEach(sub => sendPush(sub, '✅ Cubículo reservado', `${cubi.nombre} · ${duracion}h. Tienes 5 min para hacer check-in desde el QR del cubículo.`));
        }
      });
      setFolio(f);
      setScreen("success");
    } finally {
      setConfirmando(false);
    }
  }

  function confirmarReservaCompu() {
    if (!isWithinOperatingHours(new Date(serverNow()))) { setScreen("bienvenido"); return; }
    const compu = computadoras.find(c => c.id === compuSelectedId);
    if (!compu || !account) return;
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const f = `PC-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${String(Date.now()).slice(-4)}`;
    const newState = { ...compu, estado: "ocupado", reserva: { nombre: account.nombre, matricula: account.matricula, carrera: account.carrera, duracion, inicio: new Date(serverNow()) } };
    setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? newState : c));
    dbSaveComputadora(newState);
    dbGetPushSubscriptions(account.matricula).then(subs => {
      subs.forEach(sub => sendPush(sub, '💻 Sesión iniciada', `${compu.nombre} lista por ${duracion}h. Dirígete a la sala de cómputo.`));
    });
    setFolio(f);
    setScreen("success");
  }

  async function renovarReserva(cubiId) {
    if (renovando) return;
    setRenovando(true);
    try {
      const fresh = await dbLoadCubiculos();
      if (fresh && fresh.length > 0) setCubiculos(fresh);
      const cubi = (fresh || cubiculos).find(c => c.id === cubiId);
      if (!cubi || cubi.estado !== 'ocupado' || !cubi.reserva?.inicio || cubi.nextReserva) return;
      const nuevaDur = (cubi.reserva.duracion || 1) + 1;
      const updated  = { ...cubi, reserva: { ...cubi.reserva, duracion: nuevaDur } };
      setCubiculos(prev => prev.map(c => c.id === cubiId ? updated : c));
      await dbSaveCubiculo(updated);
      dbGetPushSubscriptions(cubi.reserva.matricula).then(subs => {
        subs.forEach(sub => sendPush(sub, '✅ Renovación confirmada', `Tu sesión en ${cubi.nombre} se extendió 1 hora más. ¡Sigue adelante!`));
      });
    } finally {
      setRenovando(false);
    }
  }

  function terminarUsoCompu() {
    const compu = computadoras.find(c => c.id === compuSelectedId);
    if (!compu) return;
    if (compu.reserva) {
      const res = compu.reserva;
      const h = new Date(res.inicio).getHours();
      const turno = h >= 7 && h < 14 ? 'Matutino' : h >= 14 && h < 20 ? 'Vespertino' : 'Nocturno';
      dbSaveHistorialReserva({
        cubicule: compu.nombre, tipo: 'computadoras',
        nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
        duracion: res.duracion, personas: null, piso: null,
        inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
        fin: new Date(serverNow()).toISOString(), turno,
      });
    }
    const newState = { ...compu, estado: "libre", reserva: null };
    setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? newState : c));
    dbSaveComputadora(newState);
    resetToIdle();
  }

  const selectedCubi   = cubiculos.find(c => c.id === selectedId) || null;
  const selectedCompu  = computadoras.find(c => c.id === compuSelectedId) || null;
  const libresCount    = cubiculos.filter(c => c.estado === "libre").length;
  const compuLibres    = computadoras.filter(c => c.estado === "libre").length;

  // Browse: todos los cubículos (filtrado solo por piso)
  const cubisFiltrados = pisoFilter === 0 ? cubiculos : cubiculos.filter(c => c.piso === pisoFilter);

  // ── IDLE ────────────────────────────────────────────────
  if (screen === "idle") {
    const fmtClock = clock.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
    const fmtDate  = clock.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return (
      <div onClick={() => setScreen("matricula")} style={{ minHeight: "100vh", background: NAVY_DEEP, display: "flex", flexDirection: "column", fontFamily: "'DM Sans', sans-serif", cursor: "pointer", userSelect: "none" }}>
        <div style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>📚</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Biblioteca de ICB</div>
              <div style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>UACJ</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{fmtClock}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>{fmtDate}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ marginBottom: 28 }}><LibraryIcon size={110}/></div>
          <div style={{ fontSize: 46, fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 10 }}>Biblioteca de ICB</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginBottom: 44 }}>Reserva cubículos y computadoras</div>
          {(cubiculos.length > 0 || computadoras.length > 0) && (
            <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 52 }}>
              {[
                { n: libresCount,   label: "Cubículos libres",  color: GREEN },
                { n: compuLibres,   label: "PCs libres",        color: TEAL  },
                { n: cubiculos.filter(c=>c.estado==="ocupado").length + computadoras.filter(c=>c.estado==="ocupado").length, label: "Ocupado", color: ROSE },
              ].map(({ n, label, color }) => (
                <div key={label} style={{ padding: "14px 28px", borderRadius: 16, background: `${color}12`, border: `1px solid ${color}30`, textAlign: "center", minWidth: 110 }}>
                  <div style={{ fontSize: 38, fontWeight: 800, color, fontFamily: "'Space Mono', monospace" }}>{n}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 14, padding: "20px 52px", borderRadius: 18, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, color: "#fff", fontSize: 22, fontWeight: 700, boxShadow: `0 0 48px ${TEAL}35`, opacity: pulse ? 1 : 0.72, transition: "opacity 0.5s ease" }}>
            Toca para comenzar →
          </div>
          {showInstall && (
            <div
              onClick={e => {
                e.stopPropagation();
                installPrompt.prompt();
                installPrompt.userChoice.then(() => setShowInstall(false));
              }}
              style={{ marginTop: 28, display: "inline-flex", alignItems: "center", gap: 10, padding: "14px 36px", borderRadius: 14, background: "rgba(255,255,255,0.05)", border: "1.5px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.75)", fontSize: 15, fontWeight: 600, cursor: "pointer", backdropFilter: "blur(6px)", transition: "background 0.2s" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
              onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
            >
              <span style={{ fontSize: 20 }}>📲</span>
              Instalar app en este dispositivo
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── MATRICULA ────────────────────────────────────────────
  if (screen === "matricula") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={resetToIdle} title="Acceso al servicio" clock={clock} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "64px 28px", textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: 20, background: `${TEAL}18`, border: `1.5px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 24px" }}>🎓</div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Ingresa tu Matrícula</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 40 }}>Necesitas una cuenta registrada para usar el servicio</div>

          <input
            value={matriculaInput}
            onChange={e => { setMatriculaInput(e.target.value); setLookupError(""); }}
            onKeyDown={e => e.key === "Enter" && !looking && handleLookup()}
            placeholder="Ej. A201234"
            autoFocus
            style={{ width: "100%", background: CARD, border: `1.5px solid ${lookupError ? ROSE : "rgba(255,255,255,0.1)"}`, borderRadius: 14, padding: "20px 24px", color: "#fff", fontSize: 24, fontWeight: 700, outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace", textAlign: "center", letterSpacing: 2, marginBottom: lookupError ? 12 : 28 }}
          />

          {lookupError === "not_found" && (
            <div style={{ marginBottom: 22 }}>
              {/* QR panel */}
              <div style={{ borderRadius: 18, border: `1.5px solid ${TEAL}40`, background: `${TEAL}08`, padding: "28px 24px", marginBottom: 14 }}>
                <div style={{ fontSize: 13, color: ROSE, fontWeight: 600, marginBottom: 18 }}>
                  ⚠ Matrícula no registrada — debes crear una cuenta primero
                </div>

                {/* QR code */}
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
                  <div style={{ background: "#fff", borderRadius: 16, padding: 14, display: "inline-flex", boxShadow: `0 0 32px ${TEAL}30` }}>
                    <QRCodeSVG
                      value="https://analitica360.vercel.app/registro"
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#060d1b"
                      level="M"
                    />
                  </div>
                </div>

                {/* Call to action */}
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
                  📱 Abre con tu celular
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.6, marginBottom: 20 }}>
                  Escanea el código QR con la cámara de tu teléfono,<br />
                  crea tu cuenta y regresa al Panel de Servicios.
                </div>

                {/* URL label */}
                <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: 0.5 }}>
                  analitica360.vercel.app/registro
                </div>
              </div>

              {/* Fallback link */}
              <button onClick={() => window.location.href = "/registro"}
                style={{ width: "100%", padding: "14px 20px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)", cursor: "pointer", color: "rgba(255,255,255,0.35)", fontSize: 13, fontFamily: "'DM Sans', sans-serif" }}>
                Registrar en este dispositivo →
              </button>
            </div>
          )}

          {lookupError && lookupError !== "not_found" && (
            <div style={{ padding: "14px 18px", borderRadius: 10, background: `${ROSE}15`, border: `1px solid ${ROSE}40`, color: ROSE, fontSize: 13, marginBottom: 22 }}>
              ⚠ {lookupError}
            </div>
          )}

          <button onClick={handleLookup} disabled={looking}
            style={{ width: "100%", padding: "20px 0", borderRadius: 14, border: "none", background: looking ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: looking ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 20, fontWeight: 700, cursor: looking ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>
            {looking ? "Buscando…" : "Continuar →"}
          </button>

          <div style={{ marginTop: 28, padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.7 }}>
              ¿No tienes cuenta? Regístrate en<br />
              <span style={{ color: TEAL, fontWeight: 600 }}>analitica360.vercel.app/registro</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── PIN VERIFY ───────────────────────────────────────────
  if (screen === "pin_verify" && pendingAccount) {
    const noPinConfigured = !pendingAccount.pin;
    const locked = pinAttempts >= 3;

    function confirmPin() {
      if (pinInput !== pendingAccount.pin) {
        const next = pinAttempts + 1;
        setPinAttempts(next);
        setPinError(next >= 3 ? "Demasiados intentos. Vuelve a ingresar tu matrícula." : `PIN incorrecto (${next}/3)`);
        setPinInput("");
        return;
      }
      // PIN correcto — navegar al destino
      setAccount(pendingAccount);
      if (pendingDest.selectedId)      setSelectedId(pendingDest.selectedId);
      if (pendingDest.compuSelectedId) setCompuSelectedId(pendingDest.compuSelectedId);
      if (pendingDest.screen === "bienvenido") setPersonas(cubiConfig.minPersonas);
      setPendingAccount(null); setPendingDest(null); setPinInput(""); setPinError(""); setPinAttempts(0);
      setScreen(pendingDest.screen);
    }

    const digits = [1,2,3,4,5,6,7,8,9,"",0,"⌫"];

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>

        {/* Card */}
        <div style={{ width: "100%", maxWidth: 420, textAlign: "center" }}>

          {/* Avatar */}
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
            {pendingAccount.nombre.trim().split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
          </div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{pendingAccount.nombre}</div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>{pendingAccount.carrera}</div>

          {noPinConfigured ? (
            /* Cuenta sin PIN — pedir que se actualice */
            <div style={{ borderRadius: 16, border: `1px solid ${AMBER}40`, background: `${AMBER}0c`, padding: "24px 20px" }}>
              <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Tu cuenta no tiene PIN</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 20 }}>
                Por seguridad, necesitas configurar un PIN.<br />
                Escanea el código con tu celular para actualizar tu cuenta.
              </div>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
                <div style={{ background: "#fff", borderRadius: 12, padding: 10, display: "inline-flex" }}>
                  <QRCodeSVG value="https://analitica360.vercel.app/registro" size={140} bgColor="#ffffff" fgColor="#060d1b" level="M" />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'Space Mono', monospace" }}>analitica360.vercel.app/registro</div>
            </div>
          ) : locked ? (
            /* Bloqueado por intentos */
            <div style={{ borderRadius: 16, border: `1px solid ${ROSE}40`, background: `${ROSE}0c`, padding: "28px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 34, marginBottom: 10 }}>🔒</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: ROSE, marginBottom: 8 }}>Demasiados intentos incorrectos</div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>Por seguridad, vuelve a ingresar tu matrícula para reintentar.</div>
            </div>
          ) : (
            /* Entrada de PIN */
            <>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 16 }}>Ingresa tu PIN de 4 dígitos</div>

              {/* Puntos visuales */}
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 24 }}>
                {[0,1,2,3].map(i => (
                  <div key={i} style={{ width: 18, height: 18, borderRadius: "50%", background: i < pinInput.length ? TEAL : "rgba(255,255,255,0.12)", border: `2px solid ${i < pinInput.length ? TEAL : "rgba(255,255,255,0.2)"}`, transition: "all 0.15s" }} />
                ))}
              </div>

              {pinError && (
                <div style={{ padding: "10px 14px", borderRadius: 10, background: `${ROSE}15`, border: `1px solid ${ROSE}35`, color: ROSE, fontSize: 13, marginBottom: 16 }}>
                  ⚠ {pinError}
                </div>
              )}

              {/* Teclado numérico táctil */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
                {digits.map((d, i) => (
                  <button key={i}
                    disabled={d === ""}
                    onClick={() => {
                      if (d === "⌫") { setPinInput(p => p.slice(0,-1)); setPinError(""); return; }
                      if (typeof d === "number" && pinInput.length < 4) { const next = pinInput + d; setPinInput(next); setPinError(""); if (next.length === 4) setTimeout(() => {}, 0); }
                    }}
                    style={{ padding: "18px 0", borderRadius: 12, border: d === "" ? "none" : "1px solid rgba(255,255,255,0.1)", background: d === "" ? "transparent" : d === "⌫" ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.05)", color: "#fff", fontSize: d === "⌫" ? 20 : 22, fontWeight: 700, cursor: d === "" ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation", transition: "background 0.1s" }}>
                    {d}
                  </button>
                ))}
              </div>

              <button onClick={confirmPin} disabled={pinInput.length !== 4}
                style={{ width: "100%", padding: "18px 0", borderRadius: 14, border: "none", background: pinInput.length !== 4 ? "rgba(255,255,255,0.06)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: pinInput.length !== 4 ? "rgba(255,255,255,0.25)" : "#fff", fontSize: 18, fontWeight: 700, cursor: pinInput.length !== 4 ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation", transition: "all 0.2s" }}>
                Confirmar →
              </button>
            </>
          )}

          <button onClick={resetToIdle}
            style={{ width: "100%", marginTop: 14, padding: "14px 0", borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.35)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation" }}>
            ← Cambiar matrícula
          </button>
        </div>
      </div>
    );
  }

  // ── MI RESERVA (turno activo del usuario) ────────────────
  if (screen === "mi_reserva" && selectedCubi && account) {
    const isPending  = !!selectedCubi.reserva?.pendingCheckin;
    const remaining  = getRemainingMs(selectedCubi);
    const total      = (selectedCubi.reserva?.duracion || 1) * 3_600_000;
    const usedPct    = Math.min(100, ((total - remaining) / total) * 100);
    const endTime    = selectedCubi.reserva?.inicio
      ? new Date(new Date(selectedCubi.reserva.inicio).getTime() + total)
      : null;
    const hasNext    = !!selectedCubi.nextReserva;
    const almostDone = !isPending && remaining < 10 * 60 * 1000;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={resetToIdle} title="Mi reserva activa" clock={clock} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>

          <div style={{ width: 70, height: 70, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
            {initials(account.nombre)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {account.nombre.split(" ")[0]}, {isPending ? "tu reserva está confirmada" : "tienes una reserva activa"}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
            {account.carrera} · <span style={{ fontFamily: "'Space Mono', monospace" }}>{account.matricula}</span>
          </div>

          {/* Tarjeta cubículo */}
          <div style={{ background: CARD, borderRadius: 20, padding: "26px 32px", border: `1.5px solid ${almostDone ? ROSE : TEAL}40`, marginBottom: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{selectedCubi.nombre}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 22 }}>
              Piso {selectedCubi.piso} · {selectedCubi.reserva?.personas} persona{selectedCubi.reserva?.personas !== 1 ? "s" : ""}
              {endTime && ` · Hasta las ${fmtTime(endTime)}`}
            </div>

            {isPending ? (
              <div style={{ padding: "20px 0", textAlign: "center" }}>
                <div style={{ fontSize: 52, marginBottom: 12 }}>⚡</div>
                <div style={{ fontSize: 28, fontWeight: 900, color: AMBER, marginBottom: 10 }}>
                  ¡Dirígete ahora!
                </div>
                <div style={{ fontSize: 15, color: "rgba(255,255,255,0.65)", lineHeight: 1.8, marginBottom: 18 }}>
                  Escanea el QR del cubículo<br />
                  <strong style={{ color: "#fff", fontSize: 22 }}>{selectedCubi.nombre}</strong>
                  <br />para confirmar tu llegada
                </div>
                <div style={{ display: "inline-block", background: `${AMBER}20`, border: `2px solid ${AMBER}`, borderRadius: 50, padding: "10px 28px", fontSize: 16, fontWeight: 800, color: AMBER }}>
                  ⏱ Solo tienes 5 minutos — no pierdas tu lugar
                </div>
              </div>
            ) : (
              <>
                {/* Barra de tiempo */}
                <div style={{ width: "100%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
                  <div style={{ width: `${usedPct}%`, height: "100%", borderRadius: 4, background: almostDone ? ROSE : TEAL, transition: "width 1s linear" }} />
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                  <span>Tiempo restante</span>
                  <span>{Math.round(usedPct)}% usado</span>
                </div>
                <div style={{ fontSize: 38, fontWeight: 800, color: almostDone ? ROSE : "#fff", fontFamily: "'Space Mono', monospace" }}>
                  {fmtRemaining(remaining)}
                </div>
              </>
            )}

            {hasNext && (
              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: `${AMBER}15`, border: `1px solid ${AMBER}40`, fontSize: 12, color: AMBER }}>
                ⏱️ Hay una reserva para el siguiente turno. Por favor libera el cubículo a tiempo.
              </div>
            )}
          </div>

          {/* Botón Renovar — aparece ≤10 min antes sin reserva siguiente */}
          {almostDone && !hasNext && !confirmTerminar && (
            <div style={{ background: `${TEAL}12`, border: `1.5px solid ${TEAL}40`, borderRadius: 16, padding: "18px 20px", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: TEAL, marginBottom: 4 }}>
                ⏰ Tu sesión vence en ~{Math.ceil(remaining / 60000)} min
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", marginBottom: 14, lineHeight: 1.5 }}>
                No hay reservas pendientes para este cubículo. Puedes extender tu uso 1 hora más.
              </div>
              <button onClick={() => renovarReserva(selectedCubi.id)} disabled={renovando}
                style={{ width: "100%", padding: "13px 0", borderRadius: 10, border: "none", background: renovando ? "rgba(255,255,255,0.1)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: renovando ? "rgba(255,255,255,0.4)" : "#fff", fontSize: 15, fontWeight: 700, cursor: renovando ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {renovando ? "Procesando…" : "🔄 Renovar 1 hora más"}
              </button>
            </div>
          )}

          {/* Botón terminar / cancelar */}
          {!confirmTerminar ? (
            <button onClick={() => setConfirmTerminar(true)}
              style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: `1.5px solid ${ROSE}50`, background: `${ROSE}10`, color: ROSE, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
              {isPending ? "Cancelar reserva" : "Terminar uso anticipadamente"}
            </button>
          ) : (
            <div style={{ background: `${ROSE}10`, border: `1px solid ${ROSE}40`, borderRadius: 14, padding: "20px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 12 }}>
                {isPending ? "¿Confirmas que quieres cancelar la reserva?" : "¿Confirmas que quieres terminar el uso ahora?"}
                {!isPending && hasNext && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: AMBER, fontWeight: 400 }}>El cubículo pasará al siguiente usuario automáticamente.</span>}
              </div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Confirma con tu PIN</div>
              <input
                type="password" inputMode="numeric"
                placeholder="••••"
                value={pinTerminar}
                onChange={e => { setPinTerminar(e.target.value); setPinTerminarErr(''); }}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${pinTerminarErr ? ROSE : "rgba(255,255,255,0.15)"}`, background: "rgba(255,255,255,0.08)", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono',monospace", marginBottom: pinTerminarErr ? 6 : 12 }}
              />
              {pinTerminarErr && <div style={{ fontSize: 12, color: "#fda4af", background: "rgba(225,29,72,0.14)", border: "1px solid rgba(225,29,72,0.35)", borderRadius: 8, padding: "7px 12px", marginBottom: 12 }}>{pinTerminarErr}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setConfirmTerminar(false); setPinTerminar(''); setPinTerminarErr(''); }}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  No, volver
                </button>
                <button onClick={terminarUso} disabled={!pinTerminar.trim()}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "none", background: pinTerminar.trim() ? ROSE : "rgba(255,255,255,0.1)", color: pinTerminar.trim() ? "#fff" : "rgba(255,255,255,0.3)", fontSize: 14, fontWeight: 700, cursor: pinTerminar.trim() ? "pointer" : "not-allowed", fontFamily: "'DM Sans', sans-serif" }}>
                  {isPending ? "Sí, cancelar" : "Sí, terminar"}
                </button>
              </div>
            </div>
          )}

          <button onClick={resetToIdle}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── PRÓXIMA RESERVA (siguiente turno confirmado) ──────────
  if (screen === "proxima_reserva" && selectedCubi && account) {
    const remaining  = getRemainingMs(selectedCubi);
    const endTime    = selectedCubi.reserva?.inicio
      ? new Date(new Date(selectedCubi.reserva.inicio).getTime() + selectedCubi.reserva.duracion * 3_600_000)
      : null;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={resetToIdle} title="Mi próxima reserva" clock={clock} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>

          <div style={{ width: 70, height: 70, borderRadius: 20, background: `${AMBER}18`, border: `1.5px solid ${AMBER}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 20px" }}>⏱️</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Lugar asegurado</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 32, lineHeight: 1.6 }}>
            Tu reserva para el siguiente turno está confirmada
          </div>

          <div style={{ background: CARD, borderRadius: 20, padding: "26px 32px", border: `1.5px solid ${AMBER}40`, marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 14, fontWeight: 700 }}>Tu cubículo</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{selectedCubi.nombre}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", marginBottom: 22 }}>
              Piso {selectedCubi.piso} · {selectedCubi.nextReserva?.personas} personas · {selectedCubi.nextReserva?.duracion}h
            </div>
            {endTime && (
              <div style={{ padding: "14px 18px", borderRadius: 12, background: `${AMBER}12`, border: `1px solid ${AMBER}30`, textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Disponible a partir de</div>
                <div style={{ fontSize: 30, fontWeight: 800, color: AMBER, fontFamily: "'Space Mono', monospace" }}>{fmtTime(endTime)}</div>
                {remaining > 0 && (
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>({fmtRemaining(remaining)} restantes del turno actual)</div>
                )}
              </div>
            )}
          </div>

          <div style={{ padding: "14px 18px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", marginBottom: 24, fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>
            Regresa al Panel de Servicios cuando el cubículo esté libre e ingresa tu matrícula para confirmar tu acceso.
          </div>

          <button onClick={cancelarProximaReserva}
            style={{ width: "100%", padding: "15px 0", borderRadius: 14, border: `1px solid ${ROSE}40`, background: `${ROSE}10`, color: ROSE, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10 }}>
            Cancelar reserva
          </button>
          <button onClick={resetToIdle}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── BIENVENIDO → selector de servicio ────────────────────
  if (screen === "bienvenido" && account) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("matricula")} title="Bienvenido" clock={clock} />
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 auto 20px" }}>
            {initials(account.nombre)}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            ¡Bienvenido, {account.nombre.split(" ")[0]}!
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 36 }}>
            {account.carrera} · <span style={{ fontFamily: "'Space Mono', monospace" }}>{account.matricula}</span>
          </div>

          <div style={{ fontSize: 18, fontWeight: 600, color: "rgba(255,255,255,0.55)", marginBottom: 24 }}>¿Qué servicio necesitas?</div>

          {/* Card renovación — si tiene cubículo activo ≤10 min y sin siguiente reserva */}
          {(() => {
            const miCubi = cubiculos.find(c => c.estado === 'ocupado' && c.reserva?.matricula === account?.matricula);
            const miRemain = miCubi ? getRemainingMs(miCubi) : Infinity;
            if (!miCubi || miCubi.nextReserva || miRemain <= 0 || miRemain > 10 * 60 * 1000) return null;
            return (
              <div style={{ background: `${TEAL}12`, border: `2px solid ${TEAL}50`, borderRadius: 18, padding: "20px 22px", marginBottom: 22, textAlign: "left" }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: TEAL, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Renovación disponible</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{miCubi.nombre}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
                  Tu sesión vence en ~{Math.ceil(miRemain / 60000)} min · Sin reservas pendientes
                </div>
                <button onClick={() => renovarReserva(miCubi.id)} disabled={renovando}
                  style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: renovando ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: renovando ? "rgba(255,255,255,0.3)" : "#fff", fontSize: 16, fontWeight: 700, cursor: renovando ? "wait" : "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  {renovando ? "Procesando…" : "🔄 Renovar 1 hora más"}
                </button>
              </div>
            );
          })()}

          {/* Banner fuera de horario */}
          {!isWithinOperatingHours(clock) && (
            <div style={{ background: `${AMBER}18`, border: `1.5px solid ${AMBER}60`, borderRadius: 14, padding: "14px 20px", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <span style={{ fontSize: 22, lineHeight: 1 }}>🕐</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: AMBER, marginBottom: 4 }}>Servicio no disponible</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{operatingHoursMessage(clock)}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>Lun–Vie: 8:00–18:00 · Sábado: 10:00–16:00 · Dom: cerrado</div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {/* Cubículos */}
            {(() => {
              const open = isWithinOperatingHours(clock);
              return (
                <button onClick={() => { if (!open) return; setServicio("cubiculos"); setScreen("personas"); }}
                  style={{ flex: 1, padding: "32px 20px", borderRadius: 20, border: `2px solid ${open ? TEAL : "rgba(255,255,255,0.1)"}50`, background: open ? `${TEAL}12` : "rgba(255,255,255,0.04)", cursor: open ? "pointer" : "not-allowed", textAlign: "center", fontFamily: "'DM Sans', sans-serif", opacity: open ? 1 : 0.5, transition: "all 0.2s" }}>
                  <div style={{ display:"flex", justifyContent:"center", marginBottom: 14 }}><CubiIcon size={52} color={open ? "#fff" : "rgba(255,255,255,0.3)"}/></div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: open ? "#fff" : "rgba(255,255,255,0.35)", marginBottom: 6 }}>Cubículos</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>Espacios de estudio grupal e individual</div>
                  {open ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: `${GREEN}20`, border: `1px solid ${GREEN}40` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
                      <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>{libresCount} disponibles</span>
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>Fuera de horario</span>
                    </div>
                  )}
                </button>
              );
            })()}

            {/* Computadoras */}
            {(() => {
              const open = isWithinOperatingHours(clock);
              return (
                <button onClick={() => { if (!open) return; setServicio("computadoras"); setScreen("browse_compu"); }}
                  style={{ flex: 1, padding: "32px 20px", borderRadius: 20, border: `2px solid ${open ? "#2563eb" : "rgba(255,255,255,0.1)"}50`, background: open ? "#2563eb12" : "rgba(255,255,255,0.04)", cursor: open ? "pointer" : "not-allowed", textAlign: "center", fontFamily: "'DM Sans', sans-serif", opacity: open ? 1 : 0.5, transition: "all 0.2s" }}>
                  <div style={{ fontSize: 44, marginBottom: 14, opacity: open ? 1 : 0.4 }}>💻</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: open ? "#fff" : "rgba(255,255,255,0.35)", marginBottom: 6 }}>Computadoras</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>Sala de cómputo con acceso a internet</div>
                  {open ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: `${TEAL}20`, border: `1px solid ${TEAL}40` }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL }} />
                      <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{compuLibres} disponibles</span>
                    </div>
                  ) : (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                      <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 700 }}>Fuera de horario</span>
                    </div>
                  )}
                </button>
              );
            })()}
          </div>

          <button onClick={resetToIdle}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── PERSONAS (selector de personas para cubículos) ────────
  if (screen === "personas" && account) {
    const min = cubiConfig.minPersonas;
    const max = cubiConfig.maxPersonas;
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("bienvenido")} title="Cubículos" clock={clock} />
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
          <div style={{ display:"flex", justifyContent:"center", marginBottom: 16 }}><CubiIcon size={52} color="#fff"/></div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 6 }}>¿Cuántas personas?</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 40 }}>Mínimo {min} · Máximo {max} personas por cubículo</div>

          <div style={{ background: CARD, borderRadius: 20, padding: "36px 28px", border: `1px solid rgba(255,255,255,0.08)`, marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 28 }}>
              <button onClick={() => setPersonas(p => Math.max(min, p - 1))} disabled={personas <= min}
                style={{ width: 64, height: 64, borderRadius: 16, border: `1.5px solid ${personas <= min ? "rgba(255,255,255,0.1)" : TEAL}`, background: personas <= min ? "rgba(255,255,255,0.04)" : `${TEAL}18`, color: personas <= min ? "rgba(255,255,255,0.25)" : TEAL, fontSize: 30, fontWeight: 800, cursor: personas <= min ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 72, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{personas}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 6 }}>persona{personas !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setPersonas(p => Math.min(max, p + 1))} disabled={personas >= max}
                style={{ width: 64, height: 64, borderRadius: 16, border: `1.5px solid ${personas >= max ? "rgba(255,255,255,0.1)" : TEAL}`, background: personas >= max ? "rgba(255,255,255,0.04)" : `${TEAL}18`, color: personas >= max ? "rgba(255,255,255,0.25)" : TEAL, fontSize: 30, fontWeight: 800, cursor: personas >= max ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
            </div>
          </div>

          <button onClick={() => setScreen("browse")}
            style={{ width: "100%", padding: "20px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: "#fff", fontSize: 20, fontWeight: 700, cursor: "pointer", boxShadow: `0 8px 28px ${TEAL}30`, fontFamily: "'DM Sans', sans-serif" }}>
            Ver cubículos disponibles →
          </button>
        </div>
      </div>
    );
  }

  // ── BROWSE ───────────────────────────────────────────────
  if (screen === "browse") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("personas")} title={account?.nombre.split(" ")[0]} clock={clock} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Selecciona un cubículo</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>
            Para {personas} persona{personas !== 1 ? "s" : ""} · capacidad ≥ {personas}
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            {[{ v: 0, l: "Todos los pisos" }, { v: 1, l: "Piso 1" }, { v: 2, l: "Piso 2" }].map(p => (
              <button key={p.v} onClick={() => setPisoFilter(p.v)}
                style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${pisoFilter === p.v ? TEAL : "rgba(255,255,255,0.12)"}`, background: pisoFilter === p.v ? `${TEAL}20` : "transparent", color: pisoFilter === p.v ? TEAL : "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: pisoFilter === p.v ? 700 : 400, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {p.l}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              {[["🟢", GREEN, "Disponible"], ["🟡", AMBER, "Reservar turno"], ["🔴", ROSE, "Ocupado"]].map(([ico, c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.4)" }}><span>{ico}</span>{l}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {cubisFiltrados.map(cubi => {
              const isLibre        = cubi.estado === "libre";
              const isOcupado      = cubi.estado === "ocupado";
              const isPending      = cubi.estado === "reservado" && !!cubi.reserva?.pendingCheckin;
              const isSuficiente   = cubi.capacidad >= personas;
              const rem            = isOcupado ? getRemainingMs(cubi) : 0;
              const pendingRemMs   = isPending && cubi.reserva?.reservedAt
                ? Math.max(0, 5 * 60 * 1000 - (Date.now() - new Date(cubi.reserva.reservedAt).getTime()))
                : 0;
              const endTime        = isOcupado && cubi.reserva?.inicio
                ? new Date(new Date(cubi.reserva.inicio).getTime() + cubi.reserva.duracion * 3_600_000)
                : null;
              const canAdvance     = isOcupado && !cubi.nextReserva && rem > 0 && rem <= ADVANCE_MS && isSuficiente;
              const hasNextReserva = isOcupado && !!cubi.nextReserva;
              const clickable      = (isLibre && isSuficiente) || canAdvance;

              let color, icon, label, sublabel;
              if (isLibre && isSuficiente)       { color = GREEN; icon = "✅"; label = "Disponible"; sublabel = null; }
              else if (isLibre && !isSuficiente) { color = "rgba(255,255,255,0.22)"; icon = "👥"; label = `Solo ${cubi.capacidad} pers.`; sublabel = "Capacidad insuficiente"; }
              else if (isPending)                { color = AMBER; icon = "🟡"; label = "Ocupado"; sublabel = `Check-in en ${fmtRemaining(pendingRemMs)}`; }
              else if (canAdvance)               { color = AMBER; icon = "⏱️"; label = `Libre a las ${endTime ? fmtTime(endTime) : "—"}`; sublabel = `Faltan ${fmtRemaining(rem)}`; }
              else if (hasNextReserva)           { color = AMBER; icon = "⏱️"; label = "Siguiente turno reservado"; sublabel = endTime ? `Libre a las ${fmtTime(endTime)}` : null; }
              else                               { color = ROSE;  icon = "🔴"; label = "Ocupado"; sublabel = endTime ? `Libre aprox. ${fmtTime(endTime)}` : null; }

              return (
                <button key={cubi.id}
                  onClick={() => { if (!clickable) return; setSelectedId(cubi.id); setScreen("duration"); }}
                  style={{ padding: "22px 14px", borderRadius: 18, border: `2px solid ${clickable ? `${color}65` : `${color}22`}`, background: `${color}${clickable ? "10" : "06"}`, cursor: clickable ? "pointer" : "default", textAlign: "center", outline: "none", fontFamily: "'DM Sans', sans-serif", opacity: isLibre && !isSuficiente ? 0.5 : 1, transition: "border-color 0.2s" }}>
                  {/* Ícono o dona de cuenta regresiva */}
                  {(isOcupado && cubi.reserva) || isPending ? (() => {
                    const total     = isPending ? 5 * 60 * 1000 : cubi.reserva.duracion * 3_600_000;
                    const remaining = isPending ? pendingRemMs : getRemainingMs(cubi);
                    const pct       = total > 0 ? Math.max(0, remaining / total) : 0;
                    const SIZE = 56, R = 22, CIRC = 2 * Math.PI * R;
                    const ringColor = isPending ? AMBER : canAdvance ? AMBER : ROSE;
                    return (
                      <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto 8px" }}>
                        <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ringColor} strokeWidth={4}
                            strokeDasharray={`${pct * CIRC} ${CIRC}`} strokeLinecap="round"
                            style={{ transition: "stroke-dasharray 1s linear" }} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: ringColor, fontFamily: "'Space Mono', monospace", textAlign: "center", lineHeight: 1.2 }}>
                          {fmtRing(remaining)}
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
                  )}
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{cubi.nombre}</div>
                  <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Piso {cubi.piso} · {cubi.capacidad} pers.</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
                  {sublabel && <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 3 }}>{sublabel}</div>}
                  {/* Info ocupante */}
                  {isOcupado && cubi.reserva && (
                    <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", textAlign: "left" }}>
                      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.75)", fontFamily: "'Space Mono', monospace" }}>{cubi.reserva.matricula}</span>
                        <br />{cubi.reserva.carrera}
                        <br />{cubi.reserva.personas} pers. · {cubi.reserva.duracion}h
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {cubisFiltrados.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 0", color: "rgba(255,255,255,0.3)", fontSize: 16 }}>
              No hay cubículos en este piso.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DURATION ─────────────────────────────────────────────
  if (screen === "duration" && selectedCubi) {
    const isAdvance = selectedCubi.estado === "ocupado";
    const start     = new Date();
    const availAt   = isAdvance && selectedCubi.reserva?.inicio
      ? new Date(new Date(selectedCubi.reserva.inicio).getTime() + selectedCubi.reserva.duracion * 3_600_000)
      : start;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("browse")} title={selectedCubi.nombre} clock={clock} />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>

          <div style={{ background: CARD, borderRadius: 20, padding: "26px 36px", border: `1.5px solid ${isAdvance ? AMBER : GREEN}45`, marginBottom: 38 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{selectedCubi.nombre}</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Piso {selectedCubi.piso} · Capacidad {selectedCubi.capacidad} personas</div>
            {isAdvance ? (
              <div style={{ fontSize: 14, color: AMBER, fontWeight: 700 }}>⏱️ Reserva anticipada · Disponible a las {fmtTime(availAt)}</div>
            ) : (
              <div style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>✓ Disponible ahora · {personas} persona{personas !== 1 ? "s" : ""}</div>
            )}
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>¿Cuánto tiempo necesitas?</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 30 }}>
            {fmtTime(availAt)} → {fmtTime(addMinutes(availAt, duracion * 60))}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
            {[1, 2].map(h => (
              <button key={h} onClick={() => setDuracion(h)}
                style={{ flex: 1, padding: "30px 0", borderRadius: 18, border: `2.5px solid ${duracion === h ? TEAL : "rgba(255,255,255,0.1)"}`, background: duracion === h ? `${TEAL}22` : CARD, color: duracion === h ? TEAL : "rgba(255,255,255,0.55)", fontSize: 32, fontWeight: 800, cursor: "pointer", outline: "none", fontFamily: "'Space Mono', monospace" }}>
                {h}h
              </button>
            ))}
          </div>

          <div style={{ background: `${TEAL}10`, border: `1px solid ${TEAL}30`, borderRadius: 12, padding: "14px 22px", marginBottom: 30, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            <strong style={{ color: "#fff" }}>{account?.nombre}</strong> · {selectedCubi.nombre} · {personas} persona{personas !== 1 ? "s" : ""} · {duracion}h
            <span style={{ display: "block", marginTop: 2, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{account?.matricula} · {account?.carrera}</span>
          </div>

          <button onClick={confirmarReserva} disabled={confirmando}
            style={{ width: "100%", padding: "22px 0", borderRadius: 16, border: "none", background: isAdvance ? `linear-gradient(135deg, ${AMBER}, ${ROSE})` : `linear-gradient(135deg, ${GREEN}, ${TEAL})`, color: "#fff", fontSize: 22, fontWeight: 700, cursor: confirmando ? "not-allowed" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: confirmando ? 0.75 : 1, transition: "opacity .2s" }}>
            {confirmando ? "Verificando disponibilidad…" : (isAdvance ? "⏱️ Confirmar reserva anticipada" : "✓ Confirmar Reserva")}
          </button>
        </div>
      </div>
    );
  }

  // ── MI COMPU (equipo activo del usuario) ─────────────────
  if (screen === "mi_compu" && selectedCompu && account) {
    const inicio    = selectedCompu.reserva?.inicio instanceof Date ? selectedCompu.reserva.inicio : new Date(selectedCompu.reserva?.inicio);
    const total     = (selectedCompu.reserva?.duracion || 1) * 3_600_000;
    const remaining = Math.max(0, inicio.getTime() + total - serverNow());
    const usedPct   = Math.min(100, ((total - remaining) / total) * 100);
    const endTime   = new Date(inicio.getTime() + total);
    const almostDone = remaining < 10 * 60 * 1000;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={resetToIdle} title="Mi sesión activa" clock={clock} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>
          <div style={{ width: 70, height: 70, borderRadius: "50%", background: "linear-gradient(135deg, #2563eb, #7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
            {initials(account.nombre)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {account.nombre.split(" ")[0]}, tienes un equipo en uso
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 32 }}>
            {account.carrera} · <span style={{ fontFamily: "'Space Mono', monospace" }}>{account.matricula}</span>
          </div>

          <div style={{ background: CARD, borderRadius: 20, padding: "26px 32px", border: `1.5px solid ${almostDone ? ROSE : "#2563eb"}40`, marginBottom: 20 }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 4 }}>💻 {selectedCompu.nombre}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 22 }}>
              {selectedCompu.sistema} · Hasta las {fmtTime(endTime)}
            </div>
            <div style={{ width: "100%", height: 8, borderRadius: 4, background: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 10 }}>
              <div style={{ width: `${usedPct}%`, height: "100%", borderRadius: 4, background: almostDone ? ROSE : TEAL, transition: "width 1s linear" }} />
            </div>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>Tiempo restante</span>
              <span>{Math.round(usedPct)}% usado</span>
            </div>
            <div style={{ fontSize: 38, fontWeight: 800, color: almostDone ? ROSE : "#fff", fontFamily: "'Space Mono', monospace" }}>
              {fmtRemaining(remaining)}
            </div>
          </div>

          <button onClick={terminarUsoCompu}
            style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: `1.5px solid ${ROSE}50`, background: `${ROSE}10`, color: ROSE, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
            Terminar sesión anticipadamente
          </button>
          <button onClick={resetToIdle}
            style={{ width: "100%", padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Volver al inicio
          </button>
        </div>
      </div>
    );
  }

  // ── BROWSE COMPU ──────────────────────────────────────────
  if (screen === "browse_compu") {
    const compuFiltradas = computadoras;
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("bienvenido")} title={account?.nombre.split(" ")[0]} clock={clock} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Selecciona una computadora</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>Sala de cómputo — elige un equipo disponible</div>

          <div style={{ display: "flex", gap: 14, marginBottom: 24, alignItems: "center", justifyContent: "flex-end" }}>
            {[["🟢", GREEN, "Disponible"], ["🔴", ROSE, "Ocupado"], ["🟡", AMBER, "Mantenimiento"]].map(([ico, c, l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.4)" }}><span>{ico}</span>{l}</div>
            ))}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {compuFiltradas.map(pc => {
              const isLibre = pc.estado === "libre";
              const isMant  = pc.estado === "mantenimiento";
              const color   = isLibre ? GREEN : isMant ? AMBER : ROSE;
              const clickable = isLibre;

              const total = pc.reserva?.duracion ? pc.reserva.duracion * 3_600_000 : 0;
              const inicio = pc.reserva?.inicio instanceof Date ? pc.reserva.inicio : pc.reserva?.inicio ? new Date(pc.reserva.inicio) : null;
              const rem = inicio && total ? Math.max(0, inicio.getTime() + total - serverNow()) : 0;
              const pct = total > 0 ? Math.max(0, rem / total) : 0;

              return (
                <button key={pc.id}
                  onClick={() => { if (!clickable) return; setCompuSelectedId(pc.id); setScreen("duration_compu"); }}
                  style={{ padding: "20px 10px", borderRadius: 18, border: `2px solid ${clickable ? `${color}65` : `${color}22`}`, background: `${color}${clickable ? "10" : "06"}`, cursor: clickable ? "pointer" : "default", textAlign: "center", outline: "none", fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.2s" }}>
                  {pc.estado === "ocupado" && inicio ? (() => {
                    const SIZE = 52, R = 20, CIRC = 2 * Math.PI * R;
                    return (
                      <div style={{ position: "relative", width: SIZE, height: SIZE, margin: "0 auto 10px" }}>
                        <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={4} />
                          <circle cx={SIZE/2} cy={SIZE/2} r={R} fill="none" stroke={ROSE} strokeWidth={4}
                            strokeDasharray={`${pct * CIRC} ${CIRC}`} strokeLinecap="round"
                            style={{ transition: "stroke-dasharray 1s linear" }} />
                        </svg>
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 800, color: ROSE, fontFamily: "'Space Mono', monospace" }}>
                          {fmtRing(rem)}
                        </div>
                      </div>
                    );
                  })() : (
                    <div style={{ fontSize: isMant ? 24 : 28, marginBottom: 10 }}>{isLibre ? "🟢" : isMant ? "🔧" : "🔴"}</div>
                  )}
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 3 }}>{pc.nombre}</div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{pc.sistema}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {isLibre ? "Disponible" : isMant ? "Mantenimiento" : "Ocupado"}
                  </div>
                  {pc.estado === "ocupado" && pc.reserva && (
                    <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 7, background: "rgba(0,0,0,0.25)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 700, color: "rgba(255,255,255,0.7)", fontFamily: "'Space Mono', monospace" }}>{pc.reserva.matricula}</span><br />
                        {pc.reserva.carrera}<br />
                        {pc.reserva.duracion}h · {pc.sistema}
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {compuFiltradas.length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 0", color: "rgba(255,255,255,0.3)", fontSize: 16 }}>
              No hay computadoras registradas.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DURATION COMPU ────────────────────────────────────────
  if (screen === "duration_compu" && selectedCompu) {
    const start = new Date(serverNow());
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("browse_compu")} title={selectedCompu.nombre} clock={clock} />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>

          <div style={{ background: CARD, borderRadius: 20, padding: "26px 36px", border: `1.5px solid ${GREEN}45`, marginBottom: 38 }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>💻</div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{selectedCompu.nombre}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>{selectedCompu.sistema}</div>
            <div style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>✓ Disponible ahora</div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>¿Cuánto tiempo necesitas?</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 30 }}>
            {fmtTime(start)} → {fmtTime(addMinutes(start, duracion * 60))}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
            {[1, 2].map(h => (
              <button key={h} onClick={() => setDuracion(h)}
                style={{ flex: 1, padding: "30px 0", borderRadius: 18, border: `2.5px solid ${duracion === h ? TEAL : "rgba(255,255,255,0.1)"}`, background: duracion === h ? `${TEAL}22` : CARD, color: duracion === h ? TEAL : "rgba(255,255,255,0.55)", fontSize: 32, fontWeight: 800, cursor: "pointer", outline: "none", fontFamily: "'Space Mono', monospace" }}>
                {h}h
              </button>
            ))}
          </div>

          <div style={{ background: `${TEAL}10`, border: `1px solid ${TEAL}30`, borderRadius: 12, padding: "14px 22px", marginBottom: 30, fontSize: 14, color: "rgba(255,255,255,0.55)", lineHeight: 1.6 }}>
            <strong style={{ color: "#fff" }}>{account?.nombre}</strong> · {selectedCompu.nombre} · {duracion}h
            <span style={{ display: "block", marginTop: 2, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{account?.matricula} · {selectedCompu.sistema}</span>
          </div>

          <button onClick={confirmarReservaCompu}
            style={{ width: "100%", padding: "22px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${GREEN}, ${TEAL})`, color: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            ✓ Confirmar Sesión
          </button>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────
  if (screen === "success") {
    const pct       = Math.min(100, ((15 - countdown) / 15) * 100);
    const isCompu   = servicio === "computadoras";
    const isAdvance = !isCompu && !!selectedCubi?.nextReserva && selectedCubi.nextReserva.matricula === account?.matricula;
    const availAt   = isAdvance && selectedCubi?.reserva?.inicio
      ? new Date(new Date(selectedCubi.reserva.inicio).getTime() + selectedCubi.reserva.duracion * 3_600_000)
      : null;
    const accentColor = isCompu ? TEAL : isAdvance ? AMBER : GREEN;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "28px" }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: `${accentColor}18`, border: `3px solid ${accentColor}70`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, marginBottom: 24 }}>
          {isCompu ? "💻" : isAdvance ? "⏱️" : "✓"}
        </div>
        <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
          {isAdvance ? "¡Lugar Asegurado!" : "¡Reserva Confirmada!"}
        </div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginBottom: isCompu || isAdvance ? 36 : 20 }}>
          {isCompu
            ? `Dirígete a la sala de cómputo y usa ${selectedCompu?.nombre}`
            : isAdvance && availAt
            ? `Tu cubículo estará listo a partir de las ${fmtTime(availAt)}`
            : null}
        </div>

        {/* Alerta QR visible solo para reservas de cubículo normales */}
        {!isCompu && !isAdvance && (
          <div style={{ width: "100%", maxWidth: 540, marginBottom: 28, borderRadius: 20, border: `2.5px solid ${AMBER}`, background: `${AMBER}15`, padding: "24px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>⚡</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: AMBER, marginBottom: 6 }}>
              Ve al cubículo y escanea el QR
            </div>
            <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: 1, marginBottom: 10 }}>
              {selectedCubi?.nombre}
            </div>
            <div style={{ display: "inline-block", background: `${AMBER}25`, border: `1px solid ${AMBER}60`, borderRadius: 50, padding: "8px 24px", fontSize: 16, fontWeight: 700, color: AMBER }}>
              ⏱ Tienes solo <strong>5 minutos</strong> para hacer Check-In
            </div>
          </div>
        )}

        <div style={{ background: CARD, borderRadius: 20, padding: "26px 44px", border: `1.5px solid ${accentColor}45`, marginBottom: 28, width: "100%", maxWidth: 540 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Folio de reserva</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: accentColor, fontFamily: "'Space Mono', monospace", marginBottom: 22 }}>{folio}</div>
          {isCompu ? [
            ["Equipo",      selectedCompu ? selectedCompu.nombre : ""],
            ["Sistema",     selectedCompu?.sistema || ""],
            ["Estudiante",  account?.nombre || ""],
            ["Matrícula",   account?.matricula || ""],
            ["Duración",    `${duracion}h`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{v}</span>
            </div>
          )) : [
            ["Cubículo",   selectedCubi ? `${selectedCubi.nombre} — Piso ${selectedCubi.piso}` : ""],
            ["Personas",   `${isAdvance ? selectedCubi?.nextReserva?.personas : selectedCubi?.reserva?.personas} personas`],
            ["Estudiante", account?.nombre || ""],
            ["Matrícula",  account?.matricula || ""],
            ["Duración",   `${duracion}h`],
            ...(isAdvance && availAt ? [["Disponible a las", fmtTime(availAt)]] : []),
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 540, marginBottom: 18 }}>
          <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: accentColor, transition: "width 1s linear" }} />
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 8 }}>Volviendo al inicio en {countdown}s</div>
        </div>

        <button onClick={resetToIdle}
          style={{ padding: "13px 30px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.05)", color: "rgba(255,255,255,0.5)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          Nueva reserva
        </button>
      </div>
    );
  }

  return null;
}
