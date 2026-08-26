/**
 * CubiQRView — Sistema de reservas por QR
 *
 * /cubiculo        → flujo general: registro → selección → espera 5 min
 * /cubiculo/:id    → cubículo específico: confirmar check-in o check-out
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { dbFindAlumno, dbSaveAlumno, dbLoadCubiculos, dbSaveCubiculo, dbSaveHistorialReserva, subscribeCubiculos } from "./db";
import { serverNow } from "./serverTime";

// ── icons ──────────────────────────────────────────────────────────────────
const LibraryIcon = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none">
    <defs><linearGradient id="lbg" x1="56" y1="200" x2="456" y2="460" gradientUnits="userSpaceOnUse"><stop stopColor="#e0f2fe"/><stop offset="1" stopColor="#bae6fd"/></linearGradient></defs>
    <rect x="56" y="200" width="400" height="260" rx="8" fill="url(#lbg)"/>
    <polygon points="256,60 480,210 32,210" fill="#f97316"/>
    <rect x="90"  y="230" width="50" height="180" rx="6" fill="#0ea5e9"/>
    <rect x="160" y="230" width="50" height="180" rx="6" fill="#38bdf8"/>
    <rect x="302" y="230" width="50" height="180" rx="6" fill="#38bdf8"/>
    <rect x="372" y="230" width="50" height="180" rx="6" fill="#0ea5e9"/>
    <rect x="196" y="300" width="120" height="160" rx="6" fill="#1e40af"/>
    <ellipse cx="256" cy="290" rx="40" ry="26" fill="#fef3c7" stroke="#f59e0b" strokeWidth="4"/>
    <path d="M216 290 Q256 270 296 290" fill="none" stroke="#f59e0b" strokeWidth="4"/>
    <rect x="56" y="440" width="400" height="20" rx="4" fill="#0369a1"/>
  </svg>
);

const CubiIcon = ({ size = 40, color = "#0d9488" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
    <rect x="5" y="5" width="90" height="90" rx="8" stroke={color} strokeWidth="5" fill="none"/>
    <line x1="50" y1="5"  x2="50" y2="95" stroke={color} strokeWidth="4"/>
    <line x1="5"  y1="50" x2="95" y2="50" stroke={color} strokeWidth="4"/>
    <rect x="10" y="10" width="35" height="35" rx="3" fill={color} fillOpacity=".15"/>
    <rect x="55" y="10" width="35" height="35" rx="3" fill={color} fillOpacity=".15"/>
    <rect x="10" y="55" width="35" height="35" rx="3" fill={color} fillOpacity=".15"/>
    <rect x="55" y="55" width="35" height="35" rx="3" fill={color} fillOpacity=".15"/>
  </svg>
);

// ── helpers ────────────────────────────────────────────────────────────────
function calcTurno(d) {
  const h = d.getHours();
  return h >= 7 && h < 14 ? 'Matutino' : h >= 14 && h < 20 ? 'Vespertino' : 'Nocturno';
}
function fmtHM(d) {
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function fmtMS(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}:${String(s).padStart(2,'0')}`;
}

function useMs(targetMs) {
  const [left, setLeft] = useState(() => Math.max(0, targetMs - Date.now()));
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setLeft(Math.max(0, targetMs - Date.now())), 500);
    return () => clearInterval(id);
  }, [targetMs]);
  return left;
}

// ── estilos ────────────────────────────────────────────────────────────────
const bg  = 'linear-gradient(160deg,#0e1629 0%,#1a2744 100%)';
const P   = { minHeight:'100vh', background:bg, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', padding:'24px 16px 40px', fontFamily:"'Inter',sans-serif", color:'#fff', boxSizing:'border-box' };
const CRD = { background:'rgba(255,255,255,0.06)', backdropFilter:'blur(14px)', borderRadius:20, border:'1px solid rgba(255,255,255,0.11)', padding:'24px 22px', width:'100%', maxWidth:390 };
const LBL = { fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.45)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'block' };
const INP = { width:'100%', padding:'13px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:16, fontWeight:700, outline:'none', boxSizing:'border-box', fontFamily:"'Space Mono',monospace" };
const BTN = (c='#0d9488', dis=false) => ({ width:'100%', padding:'14px', borderRadius:14, border:'none', background:dis?'rgba(255,255,255,0.08)':`linear-gradient(135deg,${c},${c}cc)`, color:dis?'rgba(255,255,255,0.3)':'#fff', fontSize:15, fontWeight:800, cursor:dis?'not-allowed':'pointer', boxShadow:dis?'none':`0 6px 18px ${c}44`, letterSpacing:.3 });
const SEC = { width:'100%', padding:'12px', borderRadius:13, border:'1px solid rgba(255,255,255,0.15)', background:'transparent', color:'rgba(255,255,255,0.7)', fontSize:14, fontWeight:600, cursor:'pointer' };
const ERR = { background:'rgba(225,29,72,0.14)', border:'1px solid rgba(225,29,72,0.35)', borderRadius:11, padding:'10px 14px', fontSize:12, color:'#fda4af', marginTop:10 };
const HDR = { marginBottom:28, textAlign:'center' };
const DIV = { height:1, background:'rgba(255,255,255,0.08)', margin:'18px 0' };

const stCol  = e => e==='libre'?'#22c55e':e==='ocupado'?'#e11d48':'#f59e0b';
const stLbl  = e => e==='libre'?'Libre':e==='ocupado'?'Ocupado':'Reservado';
const FIVE_MIN = 5 * 60 * 1000;

// ── Header fijo ────────────────────────────────────────────────────────────
function Header({ subtitle }) {
  return (
    <div style={HDR}>
      <LibraryIcon size={58}/>
      <div style={{fontSize:14,fontWeight:800,marginTop:10,letterSpacing:.3}}>Biblioteca Central UACJ</div>
      {subtitle && <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:4}}>{subtitle}</div>}
    </div>
  );
}

// ── Pantalla de éxito ──────────────────────────────────────────────────────
function SuccessScreen({ icon, color, title, sub, children }) {
  return (
    <div style={{...CRD, textAlign:'center'}}>
      <div style={{width:64,height:64,borderRadius:'50%',background:`${color}22`,border:`2px solid ${color}`,display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:28}}>{icon}</div>
      <div style={{fontSize:20,fontWeight:800,color,marginBottom:6}}>{title}</div>
      <div style={{fontSize:13,color:'rgba(255,255,255,0.55)',marginBottom:16,lineHeight:1.5}}>{sub}</div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════
export default function CubiQRView({ cubiId }) {
  const isGeneral = !cubiId;

  // ── state ────────────────────────────────────────────────────────────────
  const [cubiculos,   setCubiculos]   = useState([]);
  const [screen,      setScreen]      = useState(isGeneral ? 'login' : 'loading');
  const [loading,     setLoading]     = useState(false);
  const [errorMsg,    setErrorMsg]    = useState('');

  // Flujo general
  const [matricula,  setMatricula]  = useState('');
  const [alumno,      setAlumno]      = useState(null);
  const [draft,       setDraft]       = useState({ nombre:'', carrera:'' });
  const [personas,    setPersonas]    = useState(1);
  const [duracion,    setDuracion]    = useState(2);
  const [pending,     setPending]     = useState(null); // { cubiculo, expiresAt }

  // Flujo específico
  const [cubiculo,    setCubiculo]    = useState(null);
  const [checkExpe,   setCheckExpe]   = useState('');

  // Countdown de 5 min
  const expiresAt = pending?.expiresAt ?? 0;
  const msLeft    = useMs(expiresAt);

  // ── carga y suscripción ──────────────────────────────────────────────────
  useEffect(() => {
    dbLoadCubiculos().then(list => {
      setCubiculos(list);
      if (!isGeneral) {
        const found = list.find(c =>
          String(c.id) === String(cubiId) ||
          c.nombre     === cubiId         ||
          encodeURIComponent(c.nombre) === cubiId
        );
        if (!found) { setScreen('not-found'); return; }
        setCubiculo(found);
        setScreen(
          found.estado === 'reservado' && found.reserva?.pendingCheckin ? 'checkin' :
          found.estado === 'ocupado'                                    ? 'checkout' : 'libre-info'
        );
      }
    });

    const unsub = subscribeCubiculos((updated) => {
      setCubiculos(prev => prev.map(c =>
        (String(c.id) === String(updated.id) || c.nombre === updated.nombre) ? updated : c
      ));
      if (!isGeneral && cubiculo && (String(updated.id) === String(cubiculo?.id) || updated.nombre === cubiculo?.nombre)) {
        setCubiculo(updated);
      }
    });
    return unsub;
  // eslint-disable-next-line
  }, []);

  // Auto-cancelar reserva pendiente al vencer los 5 min
  useEffect(() => {
    if (!pending || msLeft > 0) return;
    dbSaveCubiculo({ ...pending.cubiculo, estado: 'libre', reserva: null })
      .then(() => setScreen('timeout'));
  }, [pending, msLeft]);

  // ── handlers: flujo general ──────────────────────────────────────────────
  async function handleLogin() {
    if (!matricula.trim()) return;
    setLoading(true); setErrorMsg('');
    const found = await dbFindAlumno(matricula.trim());
    setAlumno(found || null);
    setScreen(found ? 'personas' : 'register');
    setLoading(false);
  }

  async function handleRegister() {
    if (!draft.nombre.trim() || !draft.carrera.trim()) { setErrorMsg('Completa todos los campos.'); return; }
    setLoading(true); setErrorMsg('');
    try {
      const a = { matricula: matricula.trim(), nombre: draft.nombre.trim(), carrera: draft.carrera.trim() };
      await dbSaveAlumno(a);
      setAlumno(a);
      setScreen('personas');
    } catch(e) { setErrorMsg(e.message || 'Error al registrar. Intenta de nuevo.'); }
    setLoading(false);
  }

  async function handleSelectCubi(c) {
    setLoading(true);
    const expiresAt = serverNow().getTime() + FIVE_MIN;
    const updated = {
      ...c, estado: 'reservado',
      reserva: {
        nombre: alumno.nombre, matricula: alumno.matricula, carrera: alumno.carrera,
        personas, duracion, inicio: null, pendingCheckin: true,
        reservedAt: new Date(expiresAt - FIVE_MIN).toISOString(),
      },
    };
    await dbSaveCubiculo(updated);
    setPending({ cubiculo: updated, expiresAt });
    setScreen('pending');
    setLoading(false);
  }

  // ── handlers: flujo específico ───────────────────────────────────────────
  async function handleCheckin() {
    if (!checkExpe.trim()) { setErrorMsg('Ingresa tu matrícula.'); return; }
    setLoading(true); setErrorMsg('');
    const res = cubiculo.reserva;
    if (String(res?.matricula).toLowerCase() !== checkExpe.trim().toLowerCase()) {
      setErrorMsg('La matrícula no coincide con la reserva de este cubículo.');
      setLoading(false); return;
    }
    try {
      const inicio = serverNow();
      await dbSaveCubiculo({ ...cubiculo, estado:'ocupado', reserva:{ ...res, inicio, pendingCheckin:false } });
      setScreen('success-in');
    } catch(e) {
      setErrorMsg('Error al registrar. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCheckout() {
    if (!checkExpe.trim()) { setErrorMsg('Ingresa tu matrícula para confirmar.'); return; }
    setLoading(true); setErrorMsg('');
    const res = cubiculo.reserva;
    if (String(res?.matricula).toLowerCase() !== checkExpe.trim().toLowerCase()) {
      setErrorMsg('La matrícula no coincide. Solo quien hizo Check-In puede hacer Check-Out.');
      setLoading(false); return;
    }
    try {
      const finNow = serverNow();
      const inicioDate = res.inicio instanceof Date ? res.inicio : (res.inicio ? new Date(res.inicio) : null);
      await dbSaveHistorialReserva({
        tipo:'cubiculos', cubicule:cubiculo.nombre,
        nombre:res.nombre, matricula:res.matricula, carrera:res.carrera,
        duracion:res.duracion,
        inicio: inicioDate ? inicioDate.toISOString() : null,
        fin: finNow.toISOString(),
        turno: inicioDate ? calcTurno(inicioDate) : 'Matutino',
        personas: res.personas || 1, piso: cubiculo.piso,
      });
      await dbSaveCubiculo({ ...cubiculo, estado:'libre', reserva:null });
      setScreen('success-out');
    } catch(e) {
      setErrorMsg('Error al registrar la salida. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  // ── renders ───────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div style={P}>
      <div style={{width:40,height:40,border:'3px solid rgba(255,255,255,0.12)',borderTopColor:'#0d9488',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── FLUJO GENERAL ─────────────────────────────────────────────────────────

  if (screen === 'login') return (
    <div style={P}>
      <Header subtitle="Reserva un cubículo de estudio"/>
      <div style={CRD}>
        <label style={LBL}>Número de matrícula</label>
        <input style={INP} placeholder="Ej. 190123" value={matricula}
          onChange={e=>{setMatricula(e.target.value);setErrorMsg('');}}
          onKeyDown={e=>e.key==='Enter'&&!loading&&handleLogin()}/>
        {errorMsg && <div style={ERR}>{errorMsg}</div>}
        <div style={{marginTop:16}}/>
        <button style={BTN('#0d9488', loading || !matricula.trim())} onClick={handleLogin} disabled={loading||!matricula.trim()}>
          {loading ? 'Buscando…' : 'Continuar →'}
        </button>
      </div>
    </div>
  );

  if (screen === 'register') return (
    <div style={P}>
      <Header subtitle="Crear cuenta"/>
      <div style={CRD}>
        <div style={{background:'rgba(13,148,136,0.12)',border:'1px solid rgba(13,148,136,0.3)',borderRadius:12,padding:'10px 14px',marginBottom:18,fontSize:12,color:'rgba(255,255,255,0.7)'}}>
          No encontramos la matrícula <strong style={{color:'#5eead4',fontFamily:"'Space Mono',monospace"}}>{matricula}</strong>. Regístrate para continuar.
        </div>
        <label style={LBL}>Nombre completo</label>
        <input style={{...INP,marginBottom:14,fontFamily:'inherit'}} placeholder="Tu nombre" value={draft.nombre}
          onChange={e=>setDraft(p=>({...p,nombre:e.target.value}))}/>
        <label style={LBL}>Carrera</label>
        <input style={{...INP,fontFamily:'inherit'}} placeholder="Ej. Ing. Sistemas" value={draft.carrera}
          onChange={e=>setDraft(p=>({...p,carrera:e.target.value}))}/>
        {errorMsg && <div style={ERR}>{errorMsg}</div>}
        <div style={{marginTop:16}}/>
        <button style={BTN('#0d9488', loading||!draft.nombre.trim()||!draft.carrera.trim())} onClick={handleRegister}
          disabled={loading||!draft.nombre.trim()||!draft.carrera.trim()}>
          {loading ? 'Registrando…' : 'Crear cuenta y continuar →'}
        </button>
        <div style={{marginTop:10}}/>
        <button style={SEC} onClick={()=>{setMatricula('');setScreen('login');}}>← Cambiar matrícula</button>
      </div>
    </div>
  );

  if (screen === 'personas') return (
    <div style={P}>
      <Header subtitle="Detalles de la reserva"/>
      <div style={CRD}>
        <div style={{fontSize:13,fontWeight:600,color:'rgba(255,255,255,0.6)',marginBottom:16}}>
          Hola, <strong style={{color:'#fff'}}>{alumno?.nombre}</strong>
        </div>
        <div style={DIV}/>

        <label style={LBL}>¿Cuántas personas?</label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6,marginBottom:20}}>
          {[1,2,3,4,5,6].map(n=>(
            <button key={n} onClick={()=>setPersonas(n)} style={{
              padding:'10px 0',borderRadius:10,
              border:`1.5px solid ${personas===n?'#0d9488':'rgba(255,255,255,0.12)'}`,
              background:personas===n?'rgba(13,148,136,0.22)':'transparent',
              color:personas===n?'#5eead4':'rgba(255,255,255,0.5)',
              fontSize:14,fontWeight:personas===n?800:400,cursor:'pointer',
            }}>{n}</button>
          ))}
        </div>

        <label style={LBL}>Duración de la sesión</label>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:8}}>
          {[1,2,3].map(d=>(
            <button key={d} onClick={()=>setDuracion(d)} style={{
              padding:'12px 0',borderRadius:10,
              border:`1.5px solid ${duracion===d?'#0d9488':'rgba(255,255,255,0.12)'}`,
              background:duracion===d?'rgba(13,148,136,0.22)':'transparent',
              color:duracion===d?'#5eead4':'rgba(255,255,255,0.5)',
              fontSize:14,fontWeight:duracion===d?800:400,cursor:'pointer',
            }}>{d}h</button>
          ))}
        </div>
        <div style={{fontSize:10,color:'rgba(255,255,255,0.3)',marginBottom:20,textAlign:'center'}}>
          Al cumplir el tiempo el cubículo se libera automáticamente
        </div>

        <button style={BTN()} onClick={()=>setScreen('select')}>Ver cubículos disponibles →</button>
      </div>
    </div>
  );

  if (screen === 'select') {
    const libres = cubiculos.filter(c => c.estado === 'libre');
    return (
      <div style={P}>
        <Header subtitle="Elige un cubículo"/>
        <div style={CRD}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.5)'}}><strong style={{color:'#22c55e'}}>{libres.length}</strong> disponibles de {cubiculos.length}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.35)'}}>{personas} pers. · {duracion}h</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:16}}>
            {cubiculos.map(c=>{
              const libre = c.estado === 'libre';
              return (
                <button key={c.id} onClick={()=>libre&&!loading&&handleSelectCubi(c)} disabled={!libre||loading}
                  style={{
                    padding:'12px 6px',borderRadius:12,cursor:libre?'pointer':'default',
                    border:`1.5px solid ${libre?'rgba(34,197,94,0.5)':'rgba(255,255,255,0.08)'}`,
                    background:libre?'rgba(34,197,94,0.1)':'rgba(255,255,255,0.03)',
                    display:'flex',flexDirection:'column',alignItems:'center',gap:6,
                    opacity:libre?1:0.45,
                  }}>
                  <CubiIcon size={28} color={libre?'#22c55e':stCol(c.estado)}/>
                  <div style={{fontSize:11,fontWeight:700,color:libre?'#fff':'rgba(255,255,255,0.4)',fontFamily:"'Space Mono',monospace"}}>{c.nombre}</div>
                  <div style={{fontSize:8,fontWeight:600,color:stCol(c.estado),background:`${stCol(c.estado)}20`,padding:'1px 7px',borderRadius:6}}>
                    {stLbl(c.estado)}
                  </div>
                  {c.piso && <div style={{fontSize:8,color:'rgba(255,255,255,0.3)'}}>Piso {c.piso}</div>}
                </button>
              );
            })}
          </div>
          {libres.length === 0 && (
            <div style={{textAlign:'center',padding:'20px 0',color:'rgba(255,255,255,0.4)',fontSize:13}}>
              No hay cubículos disponibles en este momento.<br/>
              <span style={{fontSize:11}}>Intenta más tarde.</span>
            </div>
          )}
          <button style={SEC} onClick={()=>setScreen('personas')}>← Atrás</button>
        </div>
      </div>
    );
  }

  if (screen === 'pending') {
    const c = pending?.cubiculo;
    const pct = Math.max(0, (msLeft / FIVE_MIN) * 100);
    const urgent = msLeft < 60000;
    return (
      <div style={P}>
        <Header subtitle="Dirígete al cubículo"/>
        <div style={{...CRD, textAlign:'center'}}>
          <CubiIcon size={52} color="#0d9488"/>
          <div style={{fontSize:22,fontWeight:800,marginTop:12}}>{c?.nombre}</div>
          <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',marginTop:4}}>Piso {c?.piso || 1}</div>

          <div style={{margin:'20px 0 6px',fontSize:12,color:'rgba(255,255,255,0.5)'}}>
            Tiempo para hacer Check-In
          </div>
          <div style={{fontSize:42,fontWeight:800,fontFamily:"'Space Mono',monospace",color:urgent?'#f87171':'#5eead4',lineHeight:1}}>
            {fmtMS(msLeft)}
          </div>
          <div style={{height:6,borderRadius:3,background:'rgba(255,255,255,0.1)',margin:'14px 0',overflow:'hidden'}}>
            <div style={{height:'100%',borderRadius:3,background:urgent?'#e11d48':'#0d9488',width:`${pct}%`,transition:'width .5s linear'}}/>
          </div>

          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'14px',marginBottom:20,fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.6}}>
            Ve al cubículo <strong style={{color:'#fff'}}>{c?.nombre}</strong> y escanea el código QR pegado en él para confirmar tu Check-In.
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:8,fontSize:11,color:'rgba(255,255,255,0.4)',textAlign:'left'}}>
            <div>👤 <strong style={{color:'rgba(255,255,255,0.7)'}}>{alumno?.nombre}</strong></div>
            <div>🏫 {alumno?.carrera}</div>
            <div>👥 {personas} persona{personas>1?'s':''} · ⏱ {duracion}h</div>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'timeout') return (
    <div style={P}>
      <Header/>
      <SuccessScreen icon="⏰" color="#f59e0b" title="Tiempo expirado"
        sub="No se realizó el Check-In en 5 minutos. El cubículo quedó liberado.">
        <button style={BTN()} onClick={()=>{setScreen('login');setMatricula('');setAlumno(null);setPending(null);}}>
          Intentar de nuevo
        </button>
      </SuccessScreen>
    </div>
  );

  // ── FLUJO ESPECÍFICO POR QR ───────────────────────────────────────────────

  if (screen === 'not-found') return (
    <div style={P}>
      <Header/>
      <div style={{...CRD, textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🔍</div>
        <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>Cubículo no encontrado</div>
        <div style={{fontSize:12,color:'rgba(255,255,255,0.45)'}}>El código QR puede estar desactualizado. Comunícate con el personal.</div>
      </div>
    </div>
  );

  if (screen === 'libre-info') return (
    <div style={P}>
      <Header subtitle={cubiculo?.nombre}/>
      <div style={{...CRD, textAlign:'center'}}>
        <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'5px 14px',borderRadius:20,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.4)',fontSize:12,fontWeight:700,color:'#22c55e',marginBottom:20}}>
          <span>●</span> Disponible
        </div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.5)',lineHeight:1.7,marginBottom:20}}>
          Este cubículo está libre.<br/>
          Acude al kiosco de la biblioteca para hacer una reserva.
        </div>
        <button style={BTN()} onClick={()=>window.location.href='/kiosco'}>Ir al kiosco →</button>
      </div>
    </div>
  );

  if (screen === 'checkin') {
    const res = cubiculo?.reserva;
    return (
      <div style={P}>
        <Header subtitle="Confirmar Check-In"/>
        <div style={CRD}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
            <CubiIcon size={36} color="#f59e0b"/>
            <div>
              <div style={{fontSize:18,fontWeight:800}}>{cubiculo.nombre}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>Piso {cubiculo.piso || 1}</div>
            </div>
            <div style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'#f59e0b',background:'rgba(245,158,11,0.15)',padding:'3px 10px',borderRadius:12,border:'1px solid rgba(245,158,11,0.35)'}}>Reservado</div>
          </div>

          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 14px',marginBottom:16,fontSize:12,color:'rgba(255,255,255,0.6)',lineHeight:1.7}}>
            Reservado para <strong style={{color:'#fff'}}>{res?.nombre}</strong><br/>
            {res?.personas} persona{res?.personas>1?'s':''} · {res?.duracion}h · {res?.carrera}
          </div>
          <div style={DIV}/>

          <label style={LBL}>Confirma con tu matrícula</label>
          <input style={INP} placeholder={`Ej. ${res?.matricula?.toString().slice(0,3)||'190'}***`}
            value={checkExpe} onChange={e=>{setCheckExpe(e.target.value);setErrorMsg('');}}
            onKeyDown={e=>e.key==='Enter'&&!loading&&handleCheckin()}/>
          {errorMsg && <div style={ERR}>{errorMsg}</div>}
          <div style={{marginTop:16}}/>
          <button style={BTN('#22c55e', loading||!checkExpe.trim())} onClick={handleCheckin}
            disabled={loading||!checkExpe.trim()}>
            {loading?'Verificando…':'✓ Confirmar Check-In'}
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'checkout') {
    const res = cubiculo?.reserva;
    const inicio = res?.inicio instanceof Date ? res.inicio : (res?.inicio ? new Date(res.inicio) : null);
    const finExp = inicio ? new Date(inicio.getTime() + (res.duracion||1)*3600000) : null;
    return (
      <div style={P}>
        <Header subtitle="Check-Out anticipado"/>
        <div style={CRD}>
          <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
            <CubiIcon size={36} color="#e11d48"/>
            <div>
              <div style={{fontSize:18,fontWeight:800}}>{cubiculo.nombre}</div>
              <div style={{fontSize:10,color:'rgba(255,255,255,0.4)'}}>Piso {cubiculo.piso || 1}</div>
            </div>
            <div style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'#e11d48',background:'rgba(225,29,72,0.15)',padding:'3px 10px',borderRadius:12,border:'1px solid rgba(225,29,72,0.35)'}}>Ocupado</div>
          </div>

          {res && (
            <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 14px',marginBottom:16,fontSize:12,lineHeight:1.7}}>
              <div style={{color:'rgba(255,255,255,0.6)'}}>Matrícula: <strong style={{color:'#fff',fontFamily:"'Space Mono',monospace"}}>{res.matricula}</strong> · <span style={{color:'rgba(255,255,255,0.5)'}}>{res.carrera}</span></div>
              {finExp && <div style={{color:'rgba(255,255,255,0.45)'}}>Reservado hasta <strong style={{color:'#5eead4'}}>{fmtHM(finExp)}</strong> (auto-libera al vencer)</div>}
              <div style={{color:'rgba(255,255,255,0.35)',fontSize:11,marginTop:4}}>Check-Out voluntario libera el espacio antes de tiempo</div>
            </div>
          )}
          <div style={DIV}/>

          <label style={LBL}>Tu matrícula para confirmar Check-Out</label>
          <input style={INP} placeholder="Tu matrícula" value={checkExpe}
            onChange={e=>{setCheckExpe(e.target.value);setErrorMsg('');}}
            onKeyDown={e=>e.key==='Enter'&&!loading&&handleCheckout()}/>
          {errorMsg && <div style={ERR}>{errorMsg}</div>}
          <div style={{marginTop:16}}/>
          <button style={BTN('#e11d48',loading||!checkExpe.trim())} onClick={handleCheckout}
            disabled={loading||!checkExpe.trim()}>
            {loading?'Verificando…':'↑ Confirmar Check-Out'}
          </button>
          <div style={{marginTop:10}}/>
          <button style={SEC} onClick={()=>window.history.back()}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (screen === 'success-in') return (
    <div style={P}>
      <Header/>
      <SuccessScreen icon="✓" color="#22c55e" title="¡Check-In exitoso!"
        sub={`Cubículo ${cubiculo?.nombre} registrado. El espacio se liberará automáticamente al vencer el tiempo.`}>
        <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 14px',fontSize:12,color:'rgba(255,255,255,0.5)',textAlign:'left',lineHeight:1.6,marginBottom:16}}>
          Al terminar antes del tiempo: escanea nuevamente el QR de este cubículo para hacer <strong style={{color:'#fff'}}>Check-Out</strong> voluntario y liberar el espacio.
        </div>
      </SuccessScreen>
    </div>
  );

  if (screen === 'success-out') return (
    <div style={P}>
      <Header/>
      <SuccessScreen icon="✓" color="#0d9488" title="¡Check-Out exitoso!"
        sub={`Cubículo ${cubiculo?.nombre} liberado. Gracias por registrar tu salida.`}>
        <div style={{display:'inline-flex',alignItems:'center',gap:7,padding:'6px 16px',borderRadius:20,background:'rgba(34,197,94,0.15)',border:'1px solid rgba(34,197,94,0.4)',fontSize:12,fontWeight:700,color:'#22c55e'}}>
          <span>●</span> Cubículo libre
        </div>
      </SuccessScreen>
    </div>
  );

  return null;
}
