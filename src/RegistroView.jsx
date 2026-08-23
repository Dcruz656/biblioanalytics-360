import { useState, useEffect } from "react";
import { cubiCarreras } from "./cubiData";
import { dbFindAlumno, dbSaveAlumno, dbSavePushSubscription } from "./db";
import { registerServiceWorker, subscribeToPush } from "./pushNotifications";

// ── Palette ──────────────────────────────────────────────
const NAVY_DEEP = "#060d1b";
const NAVY      = "#0e1629";
const CARD      = "#131c2e";
const TEAL      = "#0d9488";
const TEAL_L    = "#14b8a6";
const GREEN     = "#059669";
const ROSE      = "#e11d48";

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 500);
  useEffect(() => {
    const h = () => setMobile(window.innerWidth < 500);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return mobile;
}

function initials(name) {
  return name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 12, color: ROSE, marginTop: 5 }}>⚠ {error}</div>}
    </div>
  );
}

const inputBase = {
  width: "100%", background: CARD, borderRadius: 12, padding: "15px 16px",
  color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.2s",
  WebkitAppearance: "none",
};

// ── Main ─────────────────────────────────────────────────
export default function RegistroView() {
  const isMobile = useIsMobile();

  const [screen,      setScreen]      = useState("form");
  const [form,        setForm]        = useState({ nombre: "", matricula: "", carrera: cubiCarreras[0] });
  const [errors,      setErrors]      = useState({});
  const [globalError, setGlobalError] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [savedAccount,setSavedAccount]= useState(null);
  const [pushState,   setPushState]   = useState("idle");

  function validate() {
    const e = {};
    if (!form.nombre.trim() || form.nombre.trim().length < 3)
      e.nombre = "Ingresa tu nombre completo (mínimo 3 caracteres)";
    if (!form.matricula.trim())
      e.matricula = "Ingresa tu número de matrícula";
    if (form.matricula.includes(" "))
      e.matricula = "La matrícula no debe contener espacios";
    return e;
  }

  async function handleActivarNotif(matricula) {
    const mat = matricula ?? savedAccount?.matricula;
    if (!mat) return;
    if (!("Notification" in window)) { setPushState("unsupported"); return; }
    setPushState("requesting");
    await registerServiceWorker();
    const sub = await subscribeToPush();
    if (!sub) { setPushState("denied"); return; }
    await dbSavePushSubscription(mat, sub);
    setPushState("granted");
  }

  // Dispara el diálogo de permiso automáticamente al llegar al éxito
  useEffect(() => {
    if (screen === "success" && savedAccount && pushState === "idle") {
      handleActivarNotif(savedAccount.matricula);
    }
  }, [screen, savedAccount]); // eslint-disable-line

  function handleSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setSubmitting(true);
    setGlobalError("");
    dbFindAlumno(form.matricula.trim())
      .then(exists => {
        if (exists) {
          setGlobalError("Esta matrícula ya tiene una cuenta. Puedes usar el kiosco directamente.");
          setSubmitting(false);
          return;
        }
        const newAccount = { nombre: form.nombre.trim(), matricula: form.matricula.trim().toUpperCase(), carrera: form.carrera };
        return dbSaveAlumno(newAccount).then(() => {
          setSavedAccount(newAccount);
          setSubmitting(false);
          setScreen("success");
        });
      })
      .catch(err => {
        setGlobalError(`Error al registrar: ${err.message}`);
        setSubmitting(false);
      });
  }

  // ── Shared header ──────────────────────────────────────
  const Header = ({ subtitle }) => (
    <div style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "13px 16px" : "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>📚</div>
      <div>
        <div style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: "#fff" }}>Biblioteca Central UACJ</div>
        <div style={{ fontSize: 10, color: TEAL, fontWeight: 600 }}>{subtitle}</div>
      </div>
    </div>
  );

  // ── FORM ─────────────────────────────────────────────────
  if (screen === "form") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>
        <Header subtitle="Servicio de Cubículos — Registro" />

        <div style={{ maxWidth: 520, margin: "0 auto", padding: isMobile ? "28px 16px 48px" : "40px 24px 60px" }}>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: isMobile ? 28 : 40 }}>
            <div style={{ width: isMobile ? 60 : 72, height: isMobile ? 60 : 72, borderRadius: 18, background: `${TEAL}18`, border: `1.5px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 28 : 34, margin: "0 auto 16px" }}>🏛️</div>
            <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Crea tu cuenta</div>
            <div style={{ fontSize: isMobile ? 14 : 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
              Regístrate una vez y usa el kiosco con solo tu matrícula.
            </div>
          </div>

          {/* Benefits */}
          <div style={{ background: `${TEAL}08`, border: `1px solid ${TEAL}25`, borderRadius: 14, padding: isMobile ? "14px 16px" : "16px 20px", marginBottom: isMobile ? 28 : 36 }}>
            {[
              "Reserva cubículos en segundos desde el kiosco",
              "Solo ingresa tu matrícula — sin contraseñas",
              "Registro único, válido en todos los kioscos",
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{ color: TEAL, marginTop: 2, flexShrink: 0, fontSize: 13 }}>✓</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Form fields */}
          <Field label="Nombre completo" error={errors.nombre}>
            <input
              value={form.nombre}
              onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setErrors(p => ({ ...p, nombre: "" })); }}
              placeholder="Ej. Juan Pérez López"
              autoComplete="name"
              style={{ ...inputBase, border: `1.5px solid ${errors.nombre ? ROSE : "rgba(255,255,255,0.1)"}` }}
              onFocus={e => e.target.style.borderColor = TEAL}
              onBlur={e  => e.target.style.borderColor = errors.nombre ? ROSE : "rgba(255,255,255,0.1)"}
            />
          </Field>

          <Field label="Número de matrícula" error={errors.matricula}>
            <input
              value={form.matricula}
              onChange={e => { setForm(p => ({ ...p, matricula: e.target.value })); setErrors(p => ({ ...p, matricula: "" })); setGlobalError(""); }}
              placeholder="Ej. A201234"
              autoCapitalize="characters"
              autoCorrect="off"
              style={{ ...inputBase, border: `1.5px solid ${errors.matricula ? ROSE : "rgba(255,255,255,0.1)"}`, fontFamily: "'Space Mono', monospace", letterSpacing: 1.5 }}
              onFocus={e => e.target.style.borderColor = TEAL}
              onBlur={e  => e.target.style.borderColor = errors.matricula ? ROSE : "rgba(255,255,255,0.1)"}
            />
          </Field>

          <Field label="Carrera" error={errors.carrera}>
            <select
              value={form.carrera}
              onChange={e => setForm(p => ({ ...p, carrera: e.target.value }))}
              style={{ ...inputBase, border: "1.5px solid rgba(255,255,255,0.1)" }}>
              {cubiCarreras.map(c => <option key={c} value={c} style={{ background: CARD }}>{c}</option>)}
            </select>
          </Field>

          {globalError && (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: `${ROSE}15`, border: `1px solid ${ROSE}40`, color: ROSE, fontSize: 13, marginBottom: 20, lineHeight: 1.6 }}>
              ⚠ {globalError}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: "100%", padding: "17px 0", borderRadius: 14, border: "none", background: submitting ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: submitting ? "rgba(255,255,255,0.35)" : "#fff", fontSize: isMobile ? 16 : 18, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s", touchAction: "manipulation" }}>
            {submitting ? "Creando cuenta…" : "Crear cuenta →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
            ¿Ya tienes cuenta? Ve al kiosco e ingresa tu matrícula.
          </div>
        </div>
      </div>
    );
  }

  // ── SUCCESS ──────────────────────────────────────────────
  if (screen === "success" && savedAccount) {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif", display: "flex", flexDirection: "column" }}>
        <Header subtitle="Cuenta creada exitosamente" />

        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: isMobile ? "28px 16px 40px" : "40px 24px", textAlign: "center" }}>

          {/* Check */}
          <div style={{ width: isMobile ? 72 : 90, height: isMobile ? 72 : 90, borderRadius: "50%", background: `${GREEN}18`, border: `3px solid ${GREEN}70`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: isMobile ? 34 : 44, marginBottom: 18 }}>✓</div>

          <div style={{ fontSize: isMobile ? 26 : 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>¡Cuenta creada!</div>
          <div style={{ fontSize: isMobile ? 14 : 15, color: "rgba(255,255,255,0.45)", marginBottom: isMobile ? 24 : 32, lineHeight: 1.6 }}>
            Ya puedes usar el kiosco de la biblioteca<br />ingresando solo tu matrícula.
          </div>

          {/* Account card */}
          <div style={{ background: CARD, borderRadius: 18, padding: isMobile ? "20px 20px" : "24px 36px", border: `1.5px solid ${TEAL}45`, marginBottom: isMobile ? 20 : 28, width: "100%", maxWidth: 440 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", margin: "0 auto 14px" }}>
              {initials(savedAccount.nombre)}
            </div>
            <div style={{ fontSize: isMobile ? 17 : 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{savedAccount.nombre}</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>{savedAccount.carrera}</div>
            <div style={{ padding: "12px 14px", borderRadius: 10, background: `${TEAL}12`, border: `1px solid ${TEAL}30` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Tu matrícula</div>
              <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, color: TEAL, fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>{savedAccount.matricula}</div>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: isMobile ? "14px 16px" : "18px 22px", marginBottom: isMobile ? 16 : 24, maxWidth: 440, width: "100%", textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Cómo usar el kiosco</div>
            {[
              "Ve al kiosco de la biblioteca",
              "Toca la pantalla para comenzar",
              "Ingresa tu matrícula",
              "Selecciona cubículo y duración",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: i < 3 ? 9 : 0 }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${TEAL}20`, border: `1px solid ${TEAL}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: TEAL, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{step}</span>
              </div>
            ))}
          </div>

          {/* Push notifications — se activa automáticamente */}
          {pushState === "idle" || pushState === "requesting" ? (
            <div style={{ width: "100%", maxWidth: 440, marginBottom: 14, borderRadius: 14, border: `1px solid ${TEAL}40`, background: `${TEAL}10`, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 26, flexShrink: 0, animation: "pulse 1.2s ease-in-out infinite" }}>🔔</div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 3 }}>Activando notificaciones…</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                  Acepta el permiso que aparece en pantalla para recibir avisos cuando venza tu reserva.
                </div>
              </div>
            </div>
          ) : pushState === "denied" ? (
            <div style={{ width: "100%", maxWidth: 440, marginBottom: 14, borderRadius: 14, border: `1px solid ${ROSE}40`, background: `${ROSE}10`, padding: "16px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: ROSE, marginBottom: 6 }}>⚠ Notificaciones bloqueadas</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 12, lineHeight: 1.5 }}>
                No recibirás avisos cuando tu reserva esté por vencer. Puedes activarlas desde la configuración de tu navegador, o intentar de nuevo.
              </div>
              <button onClick={() => handleActivarNotif()}
                style={{ width: "100%", padding: "12px 0", borderRadius: 10, border: `1px solid ${TEAL}50`, background: "transparent", color: TEAL, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation" }}>
                Intentar activar de nuevo
              </button>
            </div>
          ) : pushState === "granted" ? (
            <div style={{ width: "100%", maxWidth: 440, marginBottom: 14, borderRadius: 14, border: `1px solid ${GREEN}50`, background: `${GREEN}10`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>🔔✓</span>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Notificaciones activadas</div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Recibirás un aviso 10 min antes y al vencer tu reserva.</div>
              </div>
            </div>
          ) : null}

          <button onClick={() => window.location.href = "/kiosco"}
            style={{ width: "100%", maxWidth: 440, padding: "16px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: "#fff", fontSize: isMobile ? 15 : 17, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 10, touchAction: "manipulation" }}>
            Ir al kiosco →
          </button>

          <button onClick={() => { setScreen("form"); setForm({ nombre: "", matricula: "", carrera: cubiCarreras[0] }); setErrors({}); setGlobalError(""); setSavedAccount(null); setPushState("idle"); }}
            style={{ width: "100%", maxWidth: 440, padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation" }}>
            Registrar otro alumno
          </button>
        </div>
      </div>
    );
  }

  return null;
}
