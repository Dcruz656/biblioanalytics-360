import { useState, useEffect } from "react";
import { cubiCarreras } from "./cubiData";
import { dbFindAlumno, dbSaveAlumno, dbSavePushSubscription } from "./db";
import { registerServiceWorker, subscribeToPush } from "./pushNotifications";

function LibraryIcon({ size = 68 }) {
  const linesL = [230, 252, 274, 296, 318, 340];
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
      <line x1="82"  y1="432" x2="430" y2="432" stroke="#B0AFC0" strokeWidth="9" strokeLinecap="round"/>
      <line x1="105" y1="450" x2="407" y2="450" stroke="#B0AFC0" strokeWidth="9" strokeLinecap="round"/>
      <rect x="54" y="384" width="404" height="38" rx="19" fill="#D97706"/>
      <rect x="54" y="370" width="404" height="38" rx="19" fill="#FCA326" stroke="#3C3580" strokeWidth="7"/>
      <rect x="76"  y="188" width="70" height="186" rx="5" fill="#7090E8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="366" y="188" width="70" height="186" rx="5" fill="#7090E8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="160" y="188" width="44" height="186" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="308" y="188" width="44" height="186" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="6"/>
      <rect x="240" y="188" width="32" height="178" rx="4" fill="#5ACFE8" stroke="#3C3580" strokeWidth="5"/>
      <path d="M165,206 Q200,198 240,214 L240,364 Q200,356 165,362 Z" fill="#CCCAD8" stroke="#3C3580" strokeWidth="5"/>
      <path d="M272,214 Q312,198 347,206 L347,362 Q312,356 272,364 Z" fill="#CCCAD8" stroke="#3C3580" strokeWidth="5"/>
      {linesL.map((y, i) => <line key={"l"+i} x1="180" y1={y} x2="234" y2={y-2} stroke="#3C3580" strokeWidth="6" strokeLinecap="round"/>)}
      {linesL.map((y, i) => <line key={"r"+i} x1="278" y1={y-2} x2="332" y2={y} stroke="#3C3580" strokeWidth="6" strokeLinecap="round"/>)}
      <polygon points="48,202 256,60 464,202" fill="#D97706" stroke="#3C3580" strokeWidth="7" strokeLinejoin="round"/>
      <polygon points="48,192 256,50 464,192" fill="#FCA326" stroke="#3C3580" strokeWidth="7" strokeLinejoin="round"/>
    </svg>
  );
}

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
  const [form,        setForm]        = useState({ nombre: "", matricula: "", carrera: cubiCarreras[0], pin: "", pinConfirm: "" });
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
    if (!/^\d{4}$/.test(form.pin))
      e.pin = "El PIN debe ser exactamente 4 dígitos numéricos";
    if (form.pin !== form.pinConfirm)
      e.pinConfirm = "Los PINs no coinciden";
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
          // Cuenta existente: activar notificaciones en este dispositivo sin re-registrar
          setSavedAccount({ nombre: exists.nombre ?? form.nombre.trim(), matricula: exists.matricula ?? form.matricula.trim().toUpperCase(), carrera: exists.carrera ?? form.carrera });
          setSubmitting(false);
          setScreen("success");
          return;
        }
        const newAccount = { nombre: form.nombre.trim(), matricula: form.matricula.trim().toUpperCase(), carrera: form.carrera, pin: form.pin };
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
            <div style={{ margin: "0 auto 16px", display:"flex", justifyContent:"center" }}><LibraryIcon size={isMobile ? 64 : 78}/></div>
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

          {/* Separador PIN */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", margin: "6px 0 22px", position: "relative" }}>
            <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", background: NAVY_DEEP, padding: "0 12px", fontSize: 11, color: "rgba(255,255,255,0.3)", fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>PIN de seguridad</span>
          </div>

          <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 18 }}>
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              🔒 El kiosco pedirá este PIN para confirmar que eres tú. Solo tú lo sabes.
            </div>
          </div>

          <Field label="PIN (4 dígitos)" error={errors.pin}>
            <input
              value={form.pin}
              onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) { setForm(p => ({ ...p, pin: e.target.value })); setErrors(p => ({ ...p, pin: "" })); } }}
              placeholder="••••"
              type="tel"
              inputMode="numeric"
              maxLength={4}
              style={{ ...inputBase, border: `1.5px solid ${errors.pin ? ROSE : "rgba(255,255,255,0.1)"}`, fontFamily: "'Space Mono', monospace", letterSpacing: 8, fontSize: 22, textAlign: "center" }}
              onFocus={e => e.target.style.borderColor = TEAL}
              onBlur={e  => e.target.style.borderColor = errors.pin ? ROSE : "rgba(255,255,255,0.1)"}
            />
          </Field>

          <Field label="Confirmar PIN" error={errors.pinConfirm}>
            <input
              value={form.pinConfirm}
              onChange={e => { if (/^\d{0,4}$/.test(e.target.value)) { setForm(p => ({ ...p, pinConfirm: e.target.value })); setErrors(p => ({ ...p, pinConfirm: "" })); } }}
              placeholder="••••"
              type="tel"
              inputMode="numeric"
              maxLength={4}
              style={{ ...inputBase, border: `1.5px solid ${errors.pinConfirm ? ROSE : "rgba(255,255,255,0.1)"}`, fontFamily: "'Space Mono', monospace", letterSpacing: 8, fontSize: 22, textAlign: "center" }}
              onFocus={e => e.target.style.borderColor = TEAL}
              onBlur={e  => e.target.style.borderColor = errors.pinConfirm ? ROSE : "rgba(255,255,255,0.1)"}
            />
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

          <button
            onClick={() => { setScreen("form"); setForm({ nombre: "", matricula: "", carrera: cubiCarreras[0], pin: "", pinConfirm: "" }); setErrors({}); setGlobalError(""); setSavedAccount(null); setPushState("idle"); }}
            style={{ width: "100%", maxWidth: 440, padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.4)", fontSize: 14, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", touchAction: "manipulation" }}>
            Registrar otro alumno
          </button>
        </div>
      </div>
    );
  }

  return null;
}
