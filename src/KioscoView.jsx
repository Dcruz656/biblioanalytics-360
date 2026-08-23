import { useState, useEffect } from "react";
import {
  loadCubiculos, saveCubiculos, CUBI_STORAGE_KEY,
  findAccount, loadCubiConfig, CUBI_CONFIG_KEY,
} from "./cubiData";

// ── Palette ──────────────────────────────────────────────
const NAVY_DEEP = "#060d1b";
const NAVY      = "#0e1629";
const CARD      = "#131c2e";
const TEAL      = "#0d9488";
const TEAL_L    = "#14b8a6";
const GREEN     = "#059669";
const ROSE      = "#e11d48";
const AMBER     = "#d97706";

// ── Helpers ──────────────────────────────────────────────
function generateFolio() {
  const d = new Date(), pad = n => String(n).padStart(2, "0");
  return `CUB-${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${String(Date.now()).slice(-4)}`;
}
function addMinutes(date, m) { return new Date(date.getTime() + m * 60000); }
function fmtTime(date) { return date.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); }
function initials(name) { return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(); }

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
  // screens: idle | matricula | bienvenido | browse | duration | success
  const [screen,        setScreen]        = useState("idle");
  const [clock,         setClock]         = useState(new Date());
  const [cubiculos,     setCubiculos]     = useState([]);
  const [cubiConfig,    setCubiConfig]    = useState({ minPersonas: 3, maxPersonas: 5 });
  const [matriculaInput,setMatriculaInput]= useState("");
  const [account,       setAccount]       = useState(null); // { nombre, matricula, carrera }
  const [lookupError,   setLookupError]   = useState("");
  const [looking,       setLooking]       = useState(false);
  const [personas,      setPersonas]      = useState(3);
  const [selectedId,    setSelectedId]    = useState(null);
  const [duracion,      setDuracion]      = useState(2);
  const [folio,         setFolio]         = useState("");
  const [countdown,     setCountdown]     = useState(15);
  const [pisoFilter,    setPisoFilter]    = useState(0);
  const [pulse,         setPulse]         = useState(true);

  // Clock
  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pulse
  useEffect(() => {
    const t = setInterval(() => setPulse(p => !p), 900);
    return () => clearInterval(t);
  }, []);

  // Load cubiculos + config + listen for admin changes
  useEffect(() => {
    const loaded = loadCubiculos();
    if (loaded && loaded.length > 0) setCubiculos(loaded);
    const cfg = loadCubiConfig();
    setCubiConfig(cfg);
    setPersonas(cfg.minPersonas);

    const handler = (e) => {
      if (e.key === CUBI_STORAGE_KEY && e.newValue) {
        try { setCubiculos(JSON.parse(e.newValue, (k, v) => k === "inicio" && v ? new Date(v) : v)); } catch {}
      }
      if (e.key === CUBI_CONFIG_KEY && e.newValue) {
        try {
          const cfg2 = JSON.parse(e.newValue);
          setCubiConfig(cfg2);
        } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Countdown
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
    setSelectedId(null); setDuracion(2); setFolio(""); setPisoFilter(0);
  }

  function handleLookup() {
    if (!matriculaInput.trim()) { setLookupError("Ingresa tu matrícula"); return; }
    setLooking(true); setLookupError("");
    setTimeout(() => {
      const found = findAccount(matriculaInput.trim());
      setLooking(false);
      if (found) { setAccount(found); setPersonas(cubiConfig.minPersonas); setScreen("bienvenido"); }
      else { setLookupError("Matrícula no encontrada. Crea tu cuenta en analitica360.vercel.app/registro"); }
    }, 700);
  }

  function confirmarReserva() {
    const cubi = cubiculos.find(c => c.id === selectedId);
    if (!cubi || !account) return;
    const f = generateFolio();
    const updated = cubiculos.map(c =>
      c.id === selectedId
        ? { ...c, estado: "ocupado", reserva: { nombre: account.nombre, expediente: account.matricula, carrera: account.carrera, duracion, personas, inicio: new Date() } }
        : c
    );
    setCubiculos(updated);
    saveCubiculos(updated);
    setFolio(f);
    setScreen("success");
  }

  const selectedCubi = cubiculos.find(c => c.id === selectedId) || null;
  const libresCount  = cubiculos.filter(c => c.estado === "libre").length;
  const cubisFiltrados = (pisoFilter === 0 ? cubiculos : cubiculos.filter(c => c.piso === pisoFilter))
    .filter(c => c.capacidad >= personas);

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
          <div style={{ fontSize: 46, fontWeight: 800, color: "#fff", letterSpacing: -1, marginBottom: 10 }}>Reserva tu Cubículo</div>
          <div style={{ fontSize: 18, color: "rgba(255,255,255,0.4)", marginBottom: 44 }}>Espacios de estudio disponibles para ti</div>
          {cubiculos.length > 0 && (
            <div style={{ display: "flex", gap: 20, justifyContent: "center", marginBottom: 52 }}>
              {[
                { n: libresCount,                                               label: "Disponibles", color: GREEN },
                { n: cubiculos.filter(c=>c.estado==="ocupado").length,          label: "En uso",      color: ROSE  },
                { n: cubiculos.filter(c=>c.estado==="reservado").length,        label: "Reservados",  color: AMBER },
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

          {lookupError && (
            <div style={{ padding: "14px 18px", borderRadius: 10, background: `${ROSE}15`, border: `1px solid ${ROSE}40`, color: ROSE, fontSize: 13, marginBottom: 22, textAlign: "left", lineHeight: 1.6 }}>
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

  // ── BIENVENIDO + PERSONAS ────────────────────────────────
  if (screen === "bienvenido" && account) {
    const min = cubiConfig.minPersonas;
    const max = cubiConfig.maxPersonas;
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("matricula")} title="Bienvenido" clock={clock} />
        <div style={{ maxWidth: 540, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>

          {/* Avatar + greeting */}
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 800, color: "#fff", margin: "0 auto 20px" }}>
            {initials(account.nombre)}
          </div>
          <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>
            ¡Bienvenido, {account.nombre.split(" ")[0]}!
          </div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 36 }}>
            {account.carrera} · <span style={{ fontFamily: "'Space Mono', monospace" }}>{account.matricula}</span>
          </div>

          {/* Personas picker */}
          <div style={{ background: CARD, borderRadius: 20, padding: "30px 28px", border: `1px solid rgba(255,255,255,0.08)`, marginBottom: 32 }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 6 }}>¿Cuántas personas usarán el cubículo?</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 28 }}>Mínimo {min} · Máximo {max} personas</div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
              <button onClick={() => setPersonas(p => Math.max(min, p - 1))}
                disabled={personas <= min}
                style={{ width: 60, height: 60, borderRadius: 16, border: `1.5px solid ${personas <= min ? "rgba(255,255,255,0.1)" : TEAL}`, background: personas <= min ? "rgba(255,255,255,0.04)" : `${TEAL}18`, color: personas <= min ? "rgba(255,255,255,0.25)" : TEAL, fontSize: 28, fontWeight: 800, cursor: personas <= min ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                −
              </button>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 64, fontWeight: 800, color: "#fff", fontFamily: "'Space Mono', monospace", lineHeight: 1 }}>{personas}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginTop: 4 }}>persona{personas !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => setPersonas(p => Math.min(max, p + 1))}
                disabled={personas >= max}
                style={{ width: 60, height: 60, borderRadius: 16, border: `1.5px solid ${personas >= max ? "rgba(255,255,255,0.1)" : TEAL}`, background: personas >= max ? "rgba(255,255,255,0.04)" : `${TEAL}18`, color: personas >= max ? "rgba(255,255,255,0.25)" : TEAL, fontSize: 28, fontWeight: 800, cursor: personas >= max ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
                +
              </button>
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
        <TopBar onBack={() => setScreen("bienvenido")} title={account?.nombre.split(" ")[0]} clock={clock} />
        <div style={{ padding: "28px 32px" }}>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginBottom: 4 }}>Selecciona un cubículo</div>
          <div style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", marginBottom: 22 }}>
            Para {personas} persona{personas !== 1 ? "s" : ""} · Mostrando espacios con capacidad ≥ {personas}
          </div>

          {/* Filters */}
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", alignItems: "center" }}>
            {[{ v: 0, l: "Todos los pisos" }, { v: 1, l: "Piso 1" }, { v: 2, l: "Piso 2" }].map(p => (
              <button key={p.v} onClick={() => setPisoFilter(p.v)}
                style={{ padding: "10px 22px", borderRadius: 10, border: `1.5px solid ${pisoFilter === p.v ? TEAL : "rgba(255,255,255,0.12)"}`, background: pisoFilter === p.v ? `${TEAL}20` : "transparent", color: pisoFilter === p.v ? TEAL : "rgba(255,255,255,0.45)", fontSize: 14, fontWeight: pisoFilter === p.v ? 700 : 400, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
                {p.l}
              </button>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 16 }}>
              {[["🟢", GREEN, "Disponible"], ["🔴", ROSE, "En uso"], ["🟡", AMBER, "Reservado"]].map(([ico, c, l]) => (
                <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "rgba(255,255,255,0.4)" }}><span>{ico}</span>{l}</div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {cubisFiltrados.map(cubi => {
              const isLibre = cubi.estado === "libre";
              const color   = isLibre ? GREEN : cubi.estado === "ocupado" ? ROSE : AMBER;
              const icon    = isLibre ? "✅" : cubi.estado === "ocupado" ? "🔴" : "⏱️";
              const label   = isLibre ? "Disponible" : cubi.estado === "ocupado" ? "En uso" : "Reservado";
              return (
                <button key={cubi.id} onClick={() => isLibre ? (setSelectedId(cubi.id), setScreen("duration")) : null}
                  style={{ padding: "24px 16px", borderRadius: 18, border: `2px solid ${isLibre ? `${color}60` : `${color}20`}`, background: isLibre ? `${color}10` : `${color}05`, cursor: isLibre ? "pointer" : "not-allowed", textAlign: "center", opacity: isLibre ? 1 : 0.45, outline: "none", fontFamily: "'DM Sans', sans-serif" }}>
                  <div style={{ fontSize: 30, marginBottom: 10 }}>{icon}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{cubi.nombre}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>Piso {cubi.piso} · {cubi.capacidad} personas</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
                </button>
              );
            })}
          </div>

          {cubisFiltrados.filter(c => c.estado === "libre").length === 0 && (
            <div style={{ textAlign: "center", padding: "56px 0", color: "rgba(255,255,255,0.3)", fontSize: 16 }}>
              No hay cubículos disponibles para {personas} persona{personas !== 1 ? "s" : ""} en este momento.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DURATION ─────────────────────────────────────────────
  if (screen === "duration" && selectedCubi) {
    const start = new Date();
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <TopBar onBack={() => setScreen("browse")} title={selectedCubi.nombre} clock={clock} />
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "52px 28px", textAlign: "center" }}>
          <div style={{ background: CARD, borderRadius: 20, padding: "26px 36px", border: `1.5px solid ${GREEN}45`, marginBottom: 38 }}>
            <div style={{ fontSize: 40, fontWeight: 800, color: "#fff", marginBottom: 6 }}>{selectedCubi.nombre}</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 8 }}>Piso {selectedCubi.piso} · Capacidad {selectedCubi.capacidad} personas</div>
            <div style={{ fontSize: 14, color: GREEN, fontWeight: 700 }}>✓ Disponible · {personas} persona{personas !== 1 ? "s" : ""}</div>
          </div>

          <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>¿Cuánto tiempo necesitas?</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.4)", marginBottom: 30 }}>
            {fmtTime(start)} → {fmtTime(addMinutes(start, duracion * 60))}
          </div>

          <div style={{ display: "flex", gap: 16, marginBottom: 36 }}>
            {[1, 2, 3].map(h => (
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
            style={{ width: "100%", padding: "22px 0", borderRadius: 16, border: "none", background: `linear-gradient(135deg, ${GREEN}, ${TEAL})`, color: "#fff", fontSize: 22, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            ✓ Confirmar Reserva
          </button>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────
  if (screen === "success") {
    const pct = Math.min(100, ((15 - countdown) / 15) * 100);
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "28px" }}>
        <div style={{ width: 100, height: 100, borderRadius: "50%", background: `${GREEN}18`, border: `3px solid ${GREEN}70`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 52, marginBottom: 24 }}>✓</div>
        <div style={{ fontSize: 42, fontWeight: 800, color: "#fff", marginBottom: 8 }}>¡Reserva Confirmada!</div>
        <div style={{ fontSize: 16, color: "rgba(255,255,255,0.45)", marginBottom: 36 }}>Puedes dirigirte directamente a tu cubículo</div>

        <div style={{ background: CARD, borderRadius: 20, padding: "26px 44px", border: `1.5px solid ${TEAL}45`, marginBottom: 28, width: "100%", maxWidth: 540 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 10 }}>Folio de reserva</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: TEAL, fontFamily: "'Space Mono', monospace", marginBottom: 22 }}>{folio}</div>
          {[
            ["Cubículo",   selectedCubi ? `${selectedCubi.nombre} — Piso ${selectedCubi.piso}` : ""],
            ["Personas",   `${personas} persona${personas !== 1 ? "s" : ""}`],
            ["Estudiante", account?.nombre || ""],
            ["Matrícula",  account?.matricula || ""],
            ["Carrera",    account?.carrera || ""],
            ["Duración",   `${duracion} hora${duracion > 1 ? "s" : ""}`],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.4)" }}>{k}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ width: "100%", maxWidth: 540, marginBottom: 18 }}>
          <div style={{ width: "100%", height: 6, borderRadius: 3, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: TEAL, transition: "width 1s linear" }} />
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
