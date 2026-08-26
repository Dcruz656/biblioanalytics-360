import { useState, useEffect, useCallback } from "react";
import { dbFindAlumno, dbLoadCubiculos, dbSaveCubiculo, dbSaveHistorialReserva, subscribeCubiculos } from "./db";
import { serverNow } from "./serverTime";

// ── icons ─────────────────────────────────────────────────────────────────────
const LibraryIcon = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="56" y="200" width="400" height="260" rx="8" fill="#e8f4f8"/>
    <rect x="56" y="200" width="400" height="260" rx="8" fill="url(#libGrad)"/>
    <defs>
      <linearGradient id="libGradQ" x1="56" y1="200" x2="456" y2="460" gradientUnits="userSpaceOnUse">
        <stop stopColor="#e0f2fe"/><stop offset="1" stopColor="#bae6fd"/>
      </linearGradient>
    </defs>
    <rect x="56" y="200" width="400" height="260" rx="8" fill="url(#libGradQ)"/>
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

const CubiIcon = ({ size = 52, color = "#0d9488" }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="5" y="5" width="90" height="90" rx="8" stroke={color} strokeWidth="5" fill="none"/>
    <line x1="50" y1="5"  x2="50" y2="95" stroke={color} strokeWidth="4"/>
    <line x1="5"  y1="50" x2="95" y2="50" stroke={color} strokeWidth="4"/>
    <rect x="10" y="10" width="35" height="35" rx="3" fill={color} fillOpacity=".12"/>
    <rect x="55" y="10" width="35" height="35" rx="3" fill={color} fillOpacity=".12"/>
    <rect x="10" y="55" width="35" height="35" rx="3" fill={color} fillOpacity=".12"/>
    <rect x="55" y="55" width="35" height="35" rx="3" fill={color} fillOpacity=".12"/>
    <rect x="14" y="14" width="27" height="5"  rx="2" fill={color} fillOpacity=".6"/>
    <rect x="59" y="14" width="27" height="5"  rx="2" fill={color} fillOpacity=".6"/>
    <rect x="14" y="59" width="27" height="5"  rx="2" fill={color} fillOpacity=".6"/>
    <rect x="59" y="59" width="27" height="5"  rx="2" fill={color} fillOpacity=".6"/>
  </svg>
);

// ── helpers ───────────────────────────────────────────────────────────────────
function calcTurno(date) {
  const h = date.getHours();
  if (h >= 7 && h < 14) return 'Matutino';
  if (h >= 14 && h < 20) return 'Vespertino';
  return 'Nocturno';
}

function fmtHM(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function useCountdown(inicio, duracion) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!inicio || !duracion) { setRemaining(null); return; }
    const finMs = (inicio instanceof Date ? inicio : new Date(inicio)).getTime() + duracion * 3600000;
    const tick = () => {
      const left = Math.max(0, finMs - Date.now());
      const m = Math.floor(left / 60000);
      const s = Math.floor((left % 60000) / 1000);
      setRemaining({ ms: left, m, s, pct: Math.max(0, left / (duracion * 3600000)) * 100 });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [inicio, duracion]);
  return remaining;
}

// ── styles ────────────────────────────────────────────────────────────────────
const S = {
  page:   { minHeight:'100vh', background:'linear-gradient(160deg,#0e1629 0%,#1a2744 100%)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'24px 16px', fontFamily:"'Inter',sans-serif", color:'#fff' },
  card:   { background:'rgba(255,255,255,0.06)', backdropFilter:'blur(12px)', borderRadius:20, border:'1px solid rgba(255,255,255,0.12)', padding:'28px 24px', width:'100%', maxWidth:380 },
  label:  { fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.5)', textTransform:'uppercase', letterSpacing:1, marginBottom:6, display:'block' },
  input:  { width:'100%', padding:'12px 16px', borderRadius:12, border:'1px solid rgba(255,255,255,0.15)', background:'rgba(255,255,255,0.08)', color:'#fff', fontSize:15, fontWeight:600, outline:'none', boxSizing:'border-box', fontFamily:"'Space Mono',monospace", letterSpacing:1 },
  btnPrimary: (c='#0d9488') => ({ width:'100%', padding:'14px', borderRadius:14, border:'none', background:`linear-gradient(135deg,${c},${c}dd)`, color:'#fff', fontSize:15, fontWeight:800, cursor:'pointer', boxShadow:`0 6px 20px ${c}55`, letterSpacing:.3 }),
  btnSecondary: { width:'100%', padding:'12px', borderRadius:14, border:'1px solid rgba(255,255,255,0.18)', background:'transparent', color:'rgba(255,255,255,0.8)', fontSize:14, fontWeight:600, cursor:'pointer' },
  badge: (c) => ({ display:'inline-flex', alignItems:'center', gap:6, padding:'4px 12px', borderRadius:20, background:`${c}25`, border:`1px solid ${c}55`, fontSize:12, fontWeight:700, color:c }),
  err:   { background:'rgba(225,29,72,0.15)', border:'1px solid rgba(225,29,72,0.35)', borderRadius:12, padding:'10px 14px', fontSize:12, color:'#fda4af', marginTop:10 },
  success: { textAlign:'center' },
};

// ── main component ────────────────────────────────────────────────────────────
export default function CubiQRView({ cubiId }) {
  const [cubiculo,   setCubiculo]   = useState(null);
  const [screen,     setScreen]     = useState('loading');
  const [expediente, setExpediente] = useState('');
  const [duracion,   setDuracion]   = useState(2);
  const [errorMsg,   setErrorMsg]   = useState('');
  const [loading,    setLoading]    = useState(false);
  const [checkedIn,  setCheckedIn]  = useState(null);

  const cd = useCountdown(cubiculo?.reserva?.inicio, cubiculo?.reserva?.duracion);

  const loadCubi = useCallback(async () => {
    const list = await dbLoadCubiculos();
    const found = list.find(c =>
      String(c.id)     === String(cubiId) ||
      c.nombre         === cubiId         ||
      encodeURIComponent(c.nombre) === cubiId
    );
    if (!found) { setScreen('not-found'); return; }
    setCubiculo(found);
    setScreen(found.estado === 'libre' ? 'libre' : 'ocupado');
  }, [cubiId]);

  useEffect(() => { loadCubi(); }, [loadCubi]);

  useEffect(() => {
    const unsub = subscribeCubiculos((updated, eventType) => {
      if (!cubiculo) return;
      if (String(updated.id) === String(cubiculo.id) || updated.nombre === cubiculo.nombre) {
        setCubiculo(updated);
        if (screen !== 'success-in' && screen !== 'success-out') {
          setScreen(updated.estado === 'libre' ? 'libre' : 'ocupado');
        }
      }
    });
    return unsub;
  }, [cubiculo, screen]);

  async function handleCheckin() {
    if (!expediente.trim()) { setErrorMsg('Ingresa tu número de expediente.'); return; }
    setLoading(true); setErrorMsg('');
    const alumno = await dbFindAlumno(expediente.trim());
    if (!alumno) {
      setErrorMsg('Expediente no encontrado. Primero regístrate en analitica360.vercel.app/registro');
      setLoading(false); return;
    }
    const inicio = serverNow();
    const updated = {
      ...cubiculo, estado: 'ocupado',
      reserva: { nombre: alumno.nombre, expediente: alumno.matricula, carrera: alumno.carrera, duracion, inicio, personas: 1 },
    };
    await dbSaveCubiculo(updated);
    setCubiculo(updated);
    setCheckedIn({ alumno, inicio, duracion });
    setScreen('success-in');
    setLoading(false);
  }

  async function handleCheckout() {
    if (!expediente.trim()) { setErrorMsg('Ingresa tu expediente para confirmar.'); return; }
    setLoading(true); setErrorMsg('');
    const res = cubiculo.reserva;
    if (String(res?.expediente)?.toLowerCase() !== expediente.trim().toLowerCase()) {
      setErrorMsg('El expediente no coincide con quien realizó el Check-In.');
      setLoading(false); return;
    }
    const finNow = serverNow();
    const entry = {
      tipo: 'cubiculos', cubicule: cubiculo.nombre,
      nombre: res.nombre, expediente: res.expediente, carrera: res.carrera,
      duracion: res.duracion,
      inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
      fin: finNow.toISOString(),
      turno: calcTurno(res.inicio instanceof Date ? res.inicio : new Date(res.inicio)),
      personas: res.personas || 1, piso: cubiculo.piso,
    };
    await dbSaveHistorialReserva(entry);
    await dbSaveCubiculo({ ...cubiculo, estado: 'libre', reserva: null });
    setScreen('success-out');
    setLoading(false);
  }

  // ── screens ────────────────────────────────────────────────────────────────
  if (screen === 'loading') return (
    <div style={S.page}>
      <div style={{width:40,height:40,border:'3px solid rgba(255,255,255,0.15)',borderTopColor:'#0d9488',borderRadius:'50%',animation:'spin 1s linear infinite'}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (screen === 'not-found') return (
    <div style={S.page}>
      <div style={{...S.card, textAlign:'center'}}>
        <div style={{fontSize:40,marginBottom:12}}>🔍</div>
        <div style={{fontSize:18,fontWeight:700,marginBottom:8}}>Cubículo no encontrado</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.5)'}}>El código QR puede estar desactualizado. Comunícate con el personal.</div>
      </div>
    </div>
  );

  if (screen === 'success-in') {
    const inicio = checkedIn?.inicio || cubiculo?.reserva?.inicio;
    const dur    = checkedIn?.duracion || cubiculo?.reserva?.duracion;
    const fin    = inicio ? new Date((inicio instanceof Date ? inicio : new Date(inicio)).getTime() + dur * 3600000) : null;
    return (
      <div style={S.page}>
        <div style={{...S.card, textAlign:'center'}}>
          <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(5,150,105,0.2)',border:'2px solid #059669',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:30}}>✓</div>
          <div style={{fontSize:20,fontWeight:800,color:'#6ee7b7',marginBottom:6}}>¡Check-In exitoso!</div>
          <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{cubiculo.nombre}</div>
          {fin && <div style={{fontSize:13,color:'rgba(255,255,255,0.6)',marginBottom:16}}>Reservado hasta las <strong style={{color:'#fff'}}>{fmtHM(fin)}</strong> · {dur}h</div>}
          <div style={{...S.badge('#059669'),justifyContent:'center',width:'100%',marginBottom:20}}>
            <span>●</span> Cubículo ocupado
          </div>
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 16px',fontSize:12,color:'rgba(255,255,255,0.55)',lineHeight:1.6,textAlign:'left'}}>
            Al terminar tu sesión, vuelve a escanear el QR de este cubículo para hacer <strong style={{color:'#fff'}}>Check-Out</strong> y liberarlo para otros alumnos.
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'success-out') return (
    <div style={S.page}>
      <div style={{...S.card, textAlign:'center'}}>
        <div style={{width:64,height:64,borderRadius:'50%',background:'rgba(13,148,136,0.2)',border:'2px solid #0d9488',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:30}}>✓</div>
        <div style={{fontSize:20,fontWeight:800,color:'#5eead4',marginBottom:6}}>¡Check-Out exitoso!</div>
        <div style={{fontSize:15,fontWeight:700,marginBottom:4}}>{cubiculo.nombre} liberado</div>
        <div style={{fontSize:13,color:'rgba(255,255,255,0.55)',marginBottom:20}}>Gracias por registrar tu salida. El cubículo ya está disponible.</div>
        <div style={{...S.badge('#0d9488'),justifyContent:'center',width:'100%'}}>
          <span>●</span> Cubículo libre
        </div>
      </div>
    </div>
  );

  // ── libre ──────────────────────────────────────────────────────────────────
  if (screen === 'libre') return (
    <div style={S.page}>
      <div style={{marginBottom:24,textAlign:'center'}}>
        <LibraryIcon size={64}/>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:8,letterSpacing:1,textTransform:'uppercase'}}>Biblioteca Central UACJ</div>
      </div>
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <CubiIcon size={36} color="#0d9488"/>
          <div>
            <div style={{fontSize:18,fontWeight:800}}>{cubiculo.nombre}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>Piso {cubiculo.piso || 1}</div>
          </div>
          <span style={{...S.badge('#059669'),marginLeft:'auto'}}><span>●</span> Libre</span>
        </div>

        <div style={{height:1,background:'rgba(255,255,255,0.08)',marginBottom:18}}/>

        <div style={{marginBottom:14}}>
          <label style={S.label}>Tu expediente</label>
          <input style={S.input} placeholder="Ej. 190123" value={expediente}
            onChange={e=>{setExpediente(e.target.value);setErrorMsg('');}}
            onKeyDown={e=>e.key==='Enter'&&handleCheckin()}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={S.label}>Duración de la sesión</label>
          <div style={{display:'flex',gap:8}}>
            {[1,2,3].map(d=>(
              <button key={d} onClick={()=>setDuracion(d)} style={{
                flex:1,padding:'10px 0',borderRadius:12,border:`1.5px solid ${duracion===d?'#0d9488':'rgba(255,255,255,0.12)'}`,
                background:duracion===d?'rgba(13,148,136,0.2)':'transparent',
                color:duracion===d?'#5eead4':'rgba(255,255,255,0.5)',
                fontSize:13,fontWeight:duracion===d?700:400,cursor:'pointer',
              }}>{d}h</button>
            ))}
          </div>
        </div>

        {errorMsg && <div style={S.err}>{errorMsg}</div>}

        <button style={S.btnPrimary('#0d9488')} onClick={handleCheckin} disabled={loading}>
          {loading ? 'Verificando...' : '✓ Confirmar Check-In'}
        </button>
      </div>

      <div style={{marginTop:16,fontSize:11,color:'rgba(255,255,255,0.3)',textAlign:'center'}}>
        ¿No tienes cuenta? <a href="/registro" style={{color:'#5eead4',textDecoration:'none'}}>Regístrate aquí</a>
      </div>
    </div>
  );

  // ── ocupado ────────────────────────────────────────────────────────────────
  const res = cubiculo.reserva;
  const finExpected = res?.inicio
    ? new Date((res.inicio instanceof Date ? res.inicio : new Date(res.inicio)).getTime() + (res.duracion||1) * 3600000)
    : null;

  return (
    <div style={S.page}>
      <div style={{marginBottom:24,textAlign:'center'}}>
        <LibraryIcon size={64}/>
        <div style={{fontSize:11,color:'rgba(255,255,255,0.4)',marginTop:8,letterSpacing:1,textTransform:'uppercase'}}>Biblioteca Central UACJ</div>
      </div>
      <div style={S.card}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:16}}>
          <CubiIcon size={36} color="#e11d48"/>
          <div>
            <div style={{fontSize:18,fontWeight:800}}>{cubiculo.nombre}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.45)'}}>Piso {cubiculo.piso || 1}</div>
          </div>
          <span style={{...S.badge('#e11d48'),marginLeft:'auto'}}><span>●</span> Ocupado</span>
        </div>

        {res && (
          <div style={{background:'rgba(255,255,255,0.05)',borderRadius:12,padding:'12px 14px',marginBottom:16}}>
            <div style={{fontSize:12,color:'rgba(255,255,255,0.5)',marginBottom:2}}>En uso por</div>
            <div style={{fontSize:14,fontWeight:700}}>{res.nombre}</div>
            <div style={{fontSize:11,color:'rgba(255,255,255,0.4)'}}>{res.carrera}</div>
            {finExpected && (
              <div style={{fontSize:11,color:'rgba(255,255,255,0.5)',marginTop:6}}>
                Reserva hasta las <strong style={{color:'#fff'}}>{fmtHM(finExpected)}</strong>
              </div>
            )}
            {cd && (
              <>
                <div style={{height:4,borderRadius:2,background:'rgba(255,255,255,0.08)',marginTop:10,overflow:'hidden'}}>
                  <div style={{height:'100%',borderRadius:2,background:cd.pct>30?'#0d9488':'#e11d48',width:`${cd.pct}%`,transition:'width 1s linear'}}/>
                </div>
                <div style={{fontSize:10,color:'rgba(255,255,255,0.4)',marginTop:4,textAlign:'right'}}>
                  {cd.m}m {cd.s}s restantes
                </div>
              </>
            )}
          </div>
        )}

        <div style={{height:1,background:'rgba(255,255,255,0.08)',marginBottom:18}}/>

        <div style={{marginBottom:6,fontSize:12,color:'rgba(255,255,255,0.45)'}}>
          Si este es <strong style={{color:'rgba(255,255,255,0.75)'}}>tu cubículo</strong>, ingresa tu expediente para hacer Check-Out:
        </div>

        <div style={{marginBottom:14}}>
          <input style={S.input} placeholder="Tu expediente" value={expediente}
            onChange={e=>{setExpediente(e.target.value);setErrorMsg('');}}
            onKeyDown={e=>e.key==='Enter'&&handleCheckout()}/>
        </div>

        {errorMsg && <div style={S.err}>{errorMsg}</div>}

        <button style={{...S.btnPrimary('#e11d48'),marginBottom:10}} onClick={handleCheckout} disabled={loading}>
          {loading ? 'Verificando...' : '↑ Confirmar Check-Out'}
        </button>
        <button style={S.btnSecondary} onClick={()=>window.history.back()}>Cancelar</button>
      </div>
    </div>
  );
}
