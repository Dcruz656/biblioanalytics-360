import { useState, useEffect, useRef } from "react";
import {
  loadCubiConfig, CUBI_CONFIG_KEY,
  compuZonas,
} from "./cubiData";
import {
  dbLoadCubiculos, dbSaveCubiculo, dbSeedCubiculos,
  dbLoadComputadoras, dbSaveComputadora, dbSeedComputadoras,
  dbFindAlumno, dbGetPushSubscription,
  subscribeCubiculos, subscribeComputadoras,
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
  let changed = false;
  const result = cubiList.map(c => {
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
            <div style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>Biblioteca Central UACJ</div>
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
  const [servicio,        setServicio]        = useState("cubiculos");
  const [computadoras,    setComputadoras]    = useState([]);
  const [compuSelectedId, setCompuSelectedId] = useState(null);
  const [compuZonaFilter, setCompuZonaFilter] = useState("Todas");

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
        if (c.estado !== 'ocupado' || !c.reserva?.expediente) return;
        const remainMs = getRemainingMs(c);
        const warnKey  = `${c.id}-${String(c.reserva.inicio)}`;
        if (remainMs > 0 && remainMs <= 10 * 60 * 1000 && !pushWarnedRef.current.has(warnKey)) {
          pushWarnedRef.current.add(warnKey);
          const minLeft = Math.ceil(remainMs / 60000);
          dbGetPushSubscription(c.reserva.expediente).then(sub => {
            if (sub) sendPush(sub, `⏰ Te quedan ${minLeft} min`, `Tu reserva en ${c.nombre} vence pronto. Libera el espacio a tiempo.`);
          });
        }
      });

      // Auto-liberar expiradas
      setCubiculos(prev => {
        const updated = applyAutoRelease(prev);
        if (updated) {
          updated.forEach((c, i) => {
            if (c === prev[i]) return;
            const old = prev[i];
            // Notificar al usuario que su tiempo venció
            if (old?.reserva?.expediente) {
              dbGetPushSubscription(old.reserva.expediente).then(sub => {
                if (sub) sendPush(sub, '📚 Tu reserva ha vencido', `Tu tiempo en ${old.nombre} ha terminado. Gracias por usar la biblioteca.`);
              });
            }
            dbSaveCubiculo(c);
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

  function resetToIdle() {
    setScreen("idle");
    setMatriculaInput(""); setAccount(null); setLookupError(""); setLooking(false);
    setPersonas(cubiConfig.minPersonas);
    setSelectedId(null); setDuracion(2); setFolio(""); setPisoFilter(0); setConfirmTerminar(false);
    setServicio("cubiculos"); setCompuSelectedId(null); setCompuZonaFilter("Todas");
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

      // ¿Tiene reserva activa (turno actual)?
      const activeCubi = cubiActuales.find(c => c.estado === "ocupado" && c.reserva?.expediente === found.matricula);
      if (activeCubi) { setAccount(found); setSelectedId(activeCubi.id); setScreen("mi_reserva"); return; }

      // ¿Tiene reserva anticipada (siguiente turno)?
      const advanceCubi = cubiActuales.find(c => c.nextReserva?.expediente === found.matricula);
      if (advanceCubi) { setAccount(found); setSelectedId(advanceCubi.id); setScreen("proxima_reserva"); return; }

      // ¿Tiene equipo de cómputo activo?
      const activeCompu = computadoras.find(c => c.estado === "ocupado" && c.reserva?.expediente === found.matricula);
      if (activeCompu) { setAccount(found); setCompuSelectedId(activeCompu.id); setScreen("mi_compu"); return; }

      // Sin reserva → elegir servicio
      setAccount(found); setPersonas(cubiConfig.minPersonas); setScreen("bienvenido");
    });
  }

  function terminarUso() {
    const changed = cubiculos.find(c => c.id === selectedId);
    if (!changed) return;
    const newState = changed.nextReserva
      ? { ...changed, reserva: { ...changed.nextReserva, inicio: new Date(serverNow()) }, nextReserva: null }
      : { ...changed, estado: "libre", reserva: null };
    setCubiculos(prev => prev.map(c => c.id === selectedId ? newState : c));
    dbSaveCubiculo(newState);
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

  function confirmarReserva() {
    const cubi = cubiculos.find(c => c.id === selectedId);
    if (!cubi || !account) return;
    const f = generateFolio();
    let newState;
    if (cubi.estado === "ocupado") {
      newState = { ...cubi, nextReserva: { nombre: account.nombre, expediente: account.matricula, carrera: account.carrera, duracion, personas } };
    } else {
      newState = { ...cubi, estado: "ocupado", reserva: { nombre: account.nombre, expediente: account.matricula, carrera: account.carrera, duracion, personas, inicio: new Date(serverNow()) } };
    }
    setCubiculos(prev => prev.map(c => c.id === selectedId ? newState : c));
    dbSaveCubiculo(newState);
    setFolio(f);
    setScreen("success");
  }

  function confirmarReservaCompu() {
    const compu = computadoras.find(c => c.id === compuSelectedId);
    if (!compu || !account) return;
    const d = new Date(), pad = n => String(n).padStart(2, "0");
    const f = `PC-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${String(Date.now()).slice(-4)}`;
    const newState = { ...compu, estado: "ocupado", reserva: { nombre: account.nombre, expediente: account.matricula, carrera: account.carrera, duracion, inicio: new Date(serverNow()) } };
    setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? newState : c));
    dbSaveComputadora(newState);
    setFolio(f);
    setScreen("success");
  }

  function terminarUsoCompu() {
    const compu = computadoras.find(c => c.id === compuSelectedId);
    if (!compu) return;
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
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Biblioteca Central</div>
              <div style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>Universidad Autónoma de Ciudad Juárez</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono', monospace" }}>{fmtClock}</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", textTransform: "capitalize" }}>{fmtDate}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 32px", textAlign: "center" }}>
          <div style={{ width: 110, height: 110, borderRadius: 30, background: `linear-gradient(135deg, ${TEAL}25, ${TEAL_L}10)`, border: `2px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 54, marginBottom: 28 }}>🏛️</div>
          <div style={{ fontSize: 46, fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 10 }}>Biblioteca Central</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginBottom: 44 }}>Reserva cubículos y computadoras</div>
          {(cubiculos.length > 0 || computadoras.length > 0) && (
            <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 52 }}>
              {[
                { n: libresCount,   label: "Cubículos libres",  color: GREEN },
                { n: compuLibres,   label: "PCs libres",        color: TEAL  },
                { n: cubiculos.filter(c=>c.estado==="ocupado").length + computadoras.filter(c=>c.estado==="ocupado").length, label: "En uso", color: ROSE },
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
                  crea tu cuenta y regresa al kiosco.
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

  // ── MI RESERVA (turno activo del usuario) ────────────────
  if (screen === "mi_reserva" && selectedCubi && account) {
    const remaining  = getRemainingMs(selectedCubi);
    const total      = (selectedCubi.reserva?.duracion || 1) * 3_600_000;
    const usedPct    = Math.min(100, ((total - remaining) / total) * 100);
    const endTime    = selectedCubi.reserva?.inicio
      ? new Date(new Date(selectedCubi.reserva.inicio).getTime() + total)
      : null;
    const hasNext    = !!selectedCubi.nextReserva;
    const almostDone = remaining < 10 * 60 * 1000;

    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={resetToIdle} title="Mi reserva activa" clock={clock} />
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>

          <div style={{ width: 70, height: 70, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
            {initials(account.nombre)}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>
            {account.nombre.split(" ")[0]}, tienes una reserva activa
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

            {hasNext && (
              <div style={{ marginTop: 16, padding: "10px 14px", borderRadius: 10, background: `${AMBER}15`, border: `1px solid ${AMBER}40`, fontSize: 12, color: AMBER }}>
                ⏱️ Hay una reserva para el siguiente turno. Por favor libera el cubículo a tiempo.
              </div>
            )}
          </div>

          {/* Botón terminar */}
          {!confirmTerminar ? (
            <button onClick={() => setConfirmTerminar(true)}
              style={{ width: "100%", padding: "16px 0", borderRadius: 14, border: `1.5px solid ${ROSE}50`, background: `${ROSE}10`, color: ROSE, fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
              Terminar uso anticipadamente
            </button>
          ) : (
            <div style={{ background: `${ROSE}10`, border: `1px solid ${ROSE}40`, borderRadius: 14, padding: "20px", marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: "#fff", fontWeight: 600, marginBottom: 16 }}>
                ¿Confirmas que quieres terminar el uso ahora?
                {hasNext && <span style={{ display: "block", marginTop: 4, fontSize: 12, color: AMBER, fontWeight: 400 }}>El cubículo pasará al siguiente usuario automáticamente.</span>}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmTerminar(false)}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.55)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Cancelar
                </button>
                <button onClick={terminarUso}
                  style={{ flex: 1, padding: "13px 0", borderRadius: 10, border: "none", background: ROSE, color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                  Sí, terminar
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
            Regresa a este kiosco cuando el cubículo esté libre e ingresa tu matrícula para confirmar tu acceso.
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

          <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
            {/* Cubículos */}
            <button onClick={() => { setServicio("cubiculos"); setScreen("personas"); }}
              style={{ flex: 1, padding: "32px 20px", borderRadius: 20, border: `2px solid ${TEAL}50`, background: `${TEAL}12`, cursor: "pointer", textAlign: "center", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🏛️</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Cubículos</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>Espacios de estudio grupal e individual</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: `${GREEN}20`, border: `1px solid ${GREEN}40` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN }} />
                <span style={{ fontSize: 11, color: GREEN, fontWeight: 700 }}>{libresCount} disponibles</span>
              </div>
            </button>

            {/* Computadoras */}
            <button onClick={() => { setServicio("computadoras"); setScreen("browse_compu"); }}
              style={{ flex: 1, padding: "32px 20px", borderRadius: 20, border: `2px solid #2563eb50`, background: `#2563eb12`, cursor: "pointer", textAlign: "center", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>💻</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 6 }}>Computadoras</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 16, lineHeight: 1.5 }}>Sala de cómputo con acceso a internet</div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 20, background: `${TEAL}20`, border: `1px solid ${TEAL}40` }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: TEAL }} />
                <span style={{ fontSize: 11, color: TEAL, fontWeight: 700 }}>{compuLibres} disponibles</span>
              </div>
            </button>
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
          <div style={{ fontSize: 44, marginBottom: 16 }}>🏛️</div>
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
              {[["🟢", GREEN, "Disponible"], ["🟡", AMBER, "Reservar turno"], ["🔴", ROSE, "En uso"]].map(([ico, c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.4)" }}><span>{ico}</span>{l}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {cubisFiltrados.map(cubi => {
              const isLibre        = cubi.estado === "libre";
              const isOcupado      = cubi.estado === "ocupado";
              const isSuficiente   = cubi.capacidad >= personas;
              const rem            = isOcupado ? getRemainingMs(cubi) : 0;
              const endTime        = isOcupado && cubi.reserva?.inicio
                ? new Date(new Date(cubi.reserva.inicio).getTime() + cubi.reserva.duracion * 3_600_000)
                : null;
              const canAdvance     = isOcupado && !cubi.nextReserva && rem > 0 && rem <= ADVANCE_MS && isSuficiente;
              const hasNextReserva = isOcupado && !!cubi.nextReserva;
              const clickable      = (isLibre && isSuficiente) || canAdvance;

              let color, icon, label, sublabel;
              if (isLibre && isSuficiente)       { color = GREEN; icon = "✅"; label = "Disponible"; sublabel = null; }
              else if (isLibre && !isSuficiente) { color = "rgba(255,255,255,0.25)"; icon = "🚫"; label = `Máx. ${cubi.capacidad} pers.`; sublabel = null; }
              else if (canAdvance)               { color = AMBER; icon = "⏱️"; label = `Libre a las ${endTime ? fmtTime(endTime) : "—"}`; sublabel = `Faltan ${fmtRemaining(rem)}`; }
              else if (hasNextReserva)           { color = AMBER; icon = "⏱️"; label = "Siguiente turno reservado"; sublabel = endTime ? `Libre a las ${fmtTime(endTime)}` : null; }
              else                               { color = ROSE;  icon = "🔴"; label = "En uso"; sublabel = endTime ? `Libre aprox. ${fmtTime(endTime)}` : null; }

              return (
                <button key={cubi.id}
                  onClick={() => { if (!clickable) return; setSelectedId(cubi.id); setScreen("duration"); }}
                  style={{ padding: "22px 14px", borderRadius: 18, border: `2px solid ${clickable ? `${color}65` : `${color}22`}`, background: `${color}${clickable ? "10" : "06"}`, cursor: clickable ? "pointer" : "default", textAlign: "center", outline: "none", fontFamily: "'DM Sans', sans-serif", opacity: isLibre && !isSuficiente ? 0.5 : 1, transition: "border-color 0.2s" }}>
                  {/* Ícono o dona de cuenta regresiva */}
                  {isOcupado && cubi.reserva ? (() => {
                    const total = cubi.reserva.duracion * 3_600_000;
                    const remaining = getRemainingMs(cubi);
                    const pct = total > 0 ? Math.max(0, remaining / total) : 0;
                    const SIZE = 56, R = 22, CIRC = 2 * Math.PI * R;
                    const ringColor = canAdvance ? AMBER : ROSE;
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
                        <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.7)" }}>{cubi.reserva.nombre?.split(" ")[0]}</span>
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

          <button onClick={confirmarReserva}
            style={{ width: "100%", padding: "22px 0", borderRadius: 16, border: "none", background: isAdvance ? `linear-gradient(135deg, ${AMBER}, ${ROSE})` : `linear-gradient(135deg, ${GREEN}, ${TEAL})`, color: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            {isAdvance ? "⏱️ Confirmar reserva anticipada" : "✓ Confirmar Reserva"}
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
              {selectedCompu.zona} · {selectedCompu.sistema} · Hasta las {fmtTime(endTime)}
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
    const compuFiltradas = compuZonaFilter === "Todas" ? computadoras : computadoras.filter(c => c.zona === compuZonaFilter);
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("bienvenido")} title={account?.nombre.split(" ")[0]} clock={clock} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Selecciona una computadora</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>Sala de cómputo — elige un equipo disponible</div>

          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            {["Todas", ...compuZonas].map(z => (
              <button key={z} onClick={() => setCompuZonaFilter(z)}
                style={{ padding: "10px 18px", borderRadius: 10, border: `1.5px solid ${compuZonaFilter === z ? TEAL : "rgba(255,255,255,0.12)"}`, background: compuZonaFilter === z ? `${TEAL}20` : "transparent", color: compuZonaFilter === z ? TEAL : "rgba(255,255,255,0.45)", fontSize: 13, fontWeight: compuZonaFilter === z ? 700 : 400, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {z}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 14 }}>
              {[["🟢", GREEN, "Disponible"], ["🔴", ROSE, "En uso"], ["🟡", AMBER, "Mantenimiento"]].map(([ico, c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "rgba(255,255,255,0.4)" }}><span>{ico}</span>{l}</div>
              ))}
            </div>
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
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.4)", marginBottom: 6 }}>{pc.zona.replace("Sala ", "")}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    {isLibre ? "Disponible" : isMant ? "Mantenimiento" : "En uso"}
                  </div>
                  {pc.estado === "ocupado" && pc.reserva && (
                    <div style={{ marginTop: 8, padding: "6px 8px", borderRadius: 7, background: "rgba(0,0,0,0.25)" }}>
                      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                        <span style={{ fontWeight: 600, color: "rgba(255,255,255,0.65)" }}>{pc.reserva.nombre?.split(" ")[0]}</span><br />
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
              No hay computadoras en esta zona.
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
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>{selectedCompu.zona} · {selectedCompu.sistema}</div>
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
            <span style={{ display: "block", marginTop: 2, fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{account?.matricula} · {selectedCompu.zona}</span>
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
    const isAdvance = !isCompu && !!selectedCubi?.nextReserva && selectedCubi.nextReserva.expediente === account?.matricula;
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
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginBottom: 36 }}>
          {isCompu
            ? `Dirígete a ${selectedCompu?.zona} y usa ${selectedCompu?.nombre}`
            : isAdvance && availAt
            ? `Tu cubículo estará listo a partir de las ${fmtTime(availAt)}`
            : "Puedes dirigirte directamente a tu cubículo"}
        </div>

        <div style={{ background: CARD, borderRadius: 20, padding: "26px 44px", border: `1.5px solid ${accentColor}45`, marginBottom: 28, width: "100%", maxWidth: 540 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Folio de reserva</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: accentColor, fontFamily: "'Space Mono', monospace", marginBottom: 22 }}>{folio}</div>
          {isCompu ? [
            ["Equipo",      selectedCompu ? `${selectedCompu.nombre} — ${selectedCompu.zona}` : ""],
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
