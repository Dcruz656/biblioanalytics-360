import { useState } from "react";
import { loadAccounts, saveAccounts, cubiCarreras } from "./cubiData";

// ── Palette ──────────────────────────────────────────────
const NAVY_DEEP = "#060d1b";
const NAVY      = "#0e1629";
const CARD      = "#131c2e";
const TEAL      = "#0d9488";
const TEAL_L    = "#14b8a6";
const GREEN     = "#059669";
const ROSE      = "#e11d48";

function initials(name) {
  return name.trim().split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

// ── Field ────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.45)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1.2 }}>{label}</div>
      {children}
      {error && <div style={{ fontSize: 12, color: ROSE, marginTop: 5 }}>⚠ {error}</div>}
    </div>
  );
}

const inputBase = {
  width: "100%", background: CARD, borderRadius: 12, padding: "15px 18px",
  color: "#fff", fontSize: 16, outline: "none", boxSizing: "border-box",
  fontFamily: "'DM Sans', sans-serif", transition: "border-color 0.2s",
};

// ── Main ─────────────────────────────────────────────────
export default function RegistroView() {
  const [screen,     setScreen]     = useState("form"); // form | success
  const [form,       setForm]       = useState({ nombre: "", matricula: "", carrera: cubiCarreras[0] });
  const [errors,     setErrors]     = useState({});
  const [globalError,setGlobalError]= useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedAccount, setSavedAccount] = useState(null);

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

  function handleSubmit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setSubmitting(true);
    setGlobalError("");

    setTimeout(() => {
      const accounts = loadAccounts();
      const exists = accounts.find(
        a => String(a.matricula).toLowerCase() === form.matricula.toLowerCase().trim()
      );
      if (exists) {
        setGlobalError("Esta matrícula ya tiene una cuenta registrada. Puedes usar el kiosco directamente.");
        setSubmitting(false);
        return;
      }
      const newAccount = { nombre: form.nombre.trim(), matricula: form.matricula.trim().toUpperCase(), carrera: form.carrera };
      saveAccounts([...accounts, newAccount]);
      setSavedAccount(newAccount);
      setSubmitting(false);
      setScreen("success");
    }, 800);
  }

  // ── FORM ─────────────────────────────────────────────────
  if (screen === "form") {
    return (
      <div style={{ minHeight: "100vh", background: NAVY_DEEP, fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>📚</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Biblioteca Central UACJ</div>
            <div style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>Servicio de Cubículos — Registro</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ maxWidth: 520, margin: "0 auto", padding: "40px 24px 60px" }}>

          {/* Hero */}
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: `${TEAL}18`, border: `1.5px solid ${TEAL}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34, margin: "0 auto 20px" }}>🏛️</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Crea tu cuenta</div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
              Regístrate una sola vez y usa el kiosco de la biblioteca con solo tu matrícula.
            </div>
          </div>

          {/* Benefits */}
          <div style={{ background: `${TEAL}08`, border: `1px solid ${TEAL}25`, borderRadius: 14, padding: "16px 20px", marginBottom: 36 }}>
            {[
              "Reserva cubículos en segundos desde el kiosco",
              "Solo ingresa tu matrícula — sin contraseñas",
              "Registro único, válido en todos los kioscos",
            ].map((b, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                <span style={{ color: TEAL, marginTop: 1, flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>{b}</span>
              </div>
            ))}
          </div>

          {/* Form */}
          <Field label="Nombre completo" error={errors.nombre}>
            <input
              value={form.nombre}
              onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setErrors(p => ({ ...p, nombre: "" })); }}
              placeholder="Ej. Juan Pérez López"
              style={{ ...inputBase, border: `1.5px solid ${errors.nombre ? ROSE : "rgba(255,255,255,0.1)"}` }}
              onFocus={e  => e.target.style.borderColor = TEAL}
              onBlur={e   => e.target.style.borderColor = errors.nombre ? ROSE : "rgba(255,255,255,0.1)"}
            />
          </Field>

          <Field label="Número de matrícula" error={errors.matricula}>
            <input
              value={form.matricula}
              onChange={e => { setForm(p => ({ ...p, matricula: e.target.value })); setErrors(p => ({ ...p, matricula: "" })); setGlobalError(""); }}
              placeholder="Ej. A201234"
              style={{ ...inputBase, border: `1.5px solid ${errors.matricula ? ROSE : "rgba(255,255,255,0.1)"}`, fontFamily: "'Space Mono', monospace", letterSpacing: 1.5, fontSize: 18 }}
              onFocus={e  => e.target.style.borderColor = TEAL}
              onBlur={e   => e.target.style.borderColor = errors.matricula ? ROSE : "rgba(255,255,255,0.1)"}
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
            <div style={{ padding: "14px 18px", borderRadius: 12, background: `${ROSE}15`, border: `1px solid ${ROSE}40`, color: ROSE, fontSize: 13, marginBottom: 22, lineHeight: 1.6 }}>
              ⚠ {globalError}
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting}
            style={{ width: "100%", padding: "18px 0", borderRadius: 14, border: "none", background: submitting ? "rgba(255,255,255,0.08)" : `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: submitting ? "rgba(255,255,255,0.35)" : "#fff", fontSize: 18, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", transition: "all 0.2s" }}>
            {submitting ? "Creando cuenta…" : "Crear cuenta →"}
          </button>

          <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "rgba(255,255,255,0.3)" }}>
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

        {/* Header */}
        <div style={{ background: NAVY, borderBottom: "1px solid rgba(255,255,255,0.06)", padding: "16px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${TEAL}, ${TEAL_L})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>📚</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>Biblioteca Central UACJ</div>
            <div style={{ fontSize: 11, color: TEAL, fontWeight: 600 }}>Cuenta creada exitosamente</div>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 24px", textAlign: "center" }}>

          {/* Check */}
          <div style={{ width: 90, height: 90, borderRadius: "50%", background: `${GREEN}18`, border: `3px solid ${GREEN}70`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, marginBottom: 22 }}>✓</div>

          <div style={{ fontSize: 32, fontWeight: 800, color: "#fff", marginBottom: 6 }}>¡Cuenta creada!</div>
          <div style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", marginBottom: 36, lineHeight: 1.6 }}>
            Ya puedes usar el kiosco de la biblioteca<br />ingresando solo tu matrícula.
          </div>

          {/* Account card */}
          <div style={{ background: CARD, borderRadius: 20, padding: "24px 36px", border: `1.5px solid ${TEAL}45`, marginBottom: 32, width: "100%", maxWidth: 420 }}>
            <div style={{ width: 60, height: 60, borderRadius: "50%", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 auto 16px" }}>
              {initials(savedAccount.nombre)}
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{savedAccount.nombre}</div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", marginBottom: 18 }}>{savedAccount.carrera}</div>
            <div style={{ padding: "12px 16px", borderRadius: 10, background: `${TEAL}12`, border: `1px solid ${TEAL}30` }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Tu matrícula</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: TEAL, fontFamily: "'Space Mono', monospace", letterSpacing: 2 }}>{savedAccount.matricula}</div>
            </div>
          </div>

          {/* Instructions */}
          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "18px 22px", marginBottom: 28, maxWidth: 420, width: "100%", textAlign: "left" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Cómo usar el kiosco</div>
            {[
              "Ve al kiosco de la biblioteca",
              "Toca la pantalla para comenzar",
              "Ingresa tu matrícula",
              "Selecciona cubículo y duración",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: i < 3 ? 10 : 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${TEAL}20`, border: `1px solid ${TEAL}50`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: TEAL, flexShrink: 0 }}>{i + 1}</div>
                <span style={{ fontSize: 13, color: "rgba(255,255,255,0.55)" }}>{step}</span>
              </div>
            ))}
          </div>

          <button onClick={() => window.location.href = "/kiosco"}
            style={{ width: "100%", maxWidth: 420, padding: "16px 0", borderRadius: 14, border: "none", background: `linear-gradient(135deg, ${TEAL}, #2563eb)`, color: "#fff", fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "'DM Sans', sans-serif", marginBottom: 12 }}>
            Ir al kiosco →
          </button>

          <button onClick={() => { setScreen("form"); setForm({ nombre: "", matricula: "", carrera: cubiCarreras[0] }); setErrors({}); setGlobalError(""); }}
            style={{ width: "100%", maxWidth: 420, padding: "14px 0", borderRadius: 14, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: "rgba(255,255,255,0.45)", fontSize: 15, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
            Registrar otro alumno
          </button>
        </div>
      </div>
    );
  }

  return null;
}
