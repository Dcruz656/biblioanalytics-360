import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter
} from "recharts";
import {
  BookOpen, Users, TrendingUp, MessageSquare, GraduationCap, Settings,
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Search, Bell,
  Download, Activity, AlertTriangle, CheckCircle, Clock, Heart, ThumbsUp,
  ThumbsDown, Minus, Home, FileText, Zap, Target, Award, Brain, BarChart3,
  Filter, Plus, X, Upload, Play, Pause, RefreshCw, Send, Eye, Layers,
  Calendar, ChevronLeft, Moon, Sun, Sliders, Database, Globe
} from "lucide-react";

// ===== THEME =====
const themes = {
  light: {
    bg: "#f6f8fb", card: "#ffffff", cardBorder: "#e8ecf1", navy: "#0e1629",
    navyLight: "#1a2744", text: "#1e293b", textDim: "#64748b", textMuted: "#94a3b8",
    teal: "#0d9488", tealLight: "#14b8a6", blue: "#2563eb", blueLight: "#3b82f6",
    purple: "#7c3aed", amber: "#d97706", rose: "#e11d48", green: "#059669",
    sidebarBg: "linear-gradient(180deg, #0e1629 0%, #1a2744 100%)",
    sidebarText: "#ffffff", sidebarDim: "rgba(255,255,255,0.5)",
    inputBg: "#f1f5f9", hover: "#f8fafc", shadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  dark: {
    bg: "#0b1120", card: "#131c2e", cardBorder: "#1e2d48", navy: "#e2e8f0",
    navyLight: "#cbd5e1", text: "#e2e8f0", textDim: "#94a3b8", textMuted: "#64748b",
    teal: "#14b8a6", tealLight: "#2dd4bf", blue: "#3b82f6", blueLight: "#60a5fa",
    purple: "#8b5cf6", amber: "#f59e0b", rose: "#f43f5e", green: "#10b981",
    sidebarBg: "linear-gradient(180deg, #060d1b 0%, #0e1629 100%)",
    sidebarText: "#ffffff", sidebarDim: "rgba(255,255,255,0.4)",
    inputBg: "#1a2744", hover: "#1e2d48", shadow: "0 1px 3px rgba(0,0,0,0.2)",
  },
};

// ===== API CONFIG =====
const API_URL = "https://biblioanalytics-360.onrender.com";

// ===== RAW DATA GENERATORS =====
function genCirculacion(seed, campus, periodo) {
  const base = campus === "todos" ? 1 : campus === "central" ? 1.2 : campus === "norte" ? 0.7 : 0.5;
  const pMult = periodo === "2024-2" ? 1 : periodo === "2025-1" ? 1.15 : 0.9;
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const pattern = [1240,1380,1520,1290,1680,980,720,1450,1820,0,0,0];
  const pred = [0,0,0,0,0,0,0,0,1780,1950,2100,1420];
  return meses.map((m, i) => ({
    mes: m,
    prestamos: pattern[i] ? Math.round(pattern[i] * base * pMult + (seed * 37 % 100)) : null,
    devoluciones: pattern[i] ? Math.round(pattern[i] * 0.92 * base * pMult + (seed * 23 % 80)) : null,
    prediccion: pred[i] ? Math.round(pred[i] * base * pMult) : null,
  }));
}

function genSentimiento(seed) {
  return [
    { mes: "Ene", positivo: 68 + (seed % 5), negativo: 18 - (seed % 3) },
    { mes: "Feb", positivo: 71 + (seed % 4), negativo: 16 - (seed % 2) },
    { mes: "Mar", positivo: 65 + (seed % 6), negativo: 22 - (seed % 4) },
    { mes: "Abr", positivo: 73 + (seed % 3), negativo: 14 - (seed % 2) },
    { mes: "May", positivo: 76 + (seed % 4), negativo: 12 - (seed % 3) },
    { mes: "Jun", positivo: 70 + (seed % 5), negativo: 17 - (seed % 2) },
    { mes: "Jul", positivo: 74 + (seed % 3), negativo: 13 - (seed % 2) },
    { mes: "Ago", positivo: 79 + (seed % 4), negativo: 10 - (seed % 2) },
    { mes: "Sep", positivo: 82 + (seed % 3), negativo: 8 - (seed % 2) },
  ];
}

const radarBase = [
  { subject: "Acervo", A: 85 }, { subject: "Servicios", A: 78 }, { subject: "Espacios", A: 92 },
  { subject: "Digital", A: 65 }, { subject: "Personal", A: 88 }, { subject: "Horarios", A: 58 },
];

const impactoBase = [
  { rango: "0-5", promedio: 7.2, n: 420 }, { rango: "6-15", promedio: 7.8, n: 680 },
  { rango: "16-30", promedio: 8.3, n: 520 }, { rango: "31-50", promedio: 8.7, n: 310 },
  { rango: "51+", promedio: 9.1, n: 180 },
];

const retencionBase = [
  { sem: "1ro", usr: 92, noUsr: 78 }, { sem: "2do", usr: 88, noUsr: 71 },
  { sem: "3ro", usr: 85, noUsr: 64 }, { sem: "4to", usr: 83, noUsr: 58 },
  { sem: "5to", usr: 80, noUsr: 52 }, { sem: "6to", usr: 78, noUsr: 47 },
  { sem: "7mo", usr: 76, noUsr: 43 }, { sem: "8vo", usr: 74, noUsr: 40 },
];

const colAreas = [
  { area: "Ing. y Tecnología", v: 4250, pct: 28 }, { area: "Cs. Sociales", v: 3180, pct: 21 },
  { area: "Cs. Salud", v: 2540, pct: 17 }, { area: "Humanidades", v: 2100, pct: 14 },
  { area: "Cs. Exactas", v: 1680, pct: 11 }, { area: "Otros", v: 1350, pct: 9 },
];

const pieColors = ["#0d9488","#2563eb","#7c3aed","#d97706","#e11d48","#64748b"];

const iniciativasBase = [
  { nombre: "Digitalización de Acervo Histórico", progreso: 72, meta: "5,000 docs", estado: "progreso" },
  { nombre: "Alfabetización Informacional", progreso: 91, meta: "300 alumnos", estado: "bien" },
  { nombre: "Renovación Sala de Cómputo", progreso: 35, meta: "Q4 2025", estado: "riesgo" },
  { nombre: "Catálogo Interbibliotecario", progreso: 58, meta: "100% integración", estado: "progreso" },
  { nombre: "Capacitación del Personal en IA", progreso: 88, meta: "25 empleados", estado: "bien" },
];

const defaultComments = [
  { id: 1, texto: "Excelente servicio en la sala de consulta, el personal siempre ayuda.", sentimiento: "positivo", score: 0.92, fecha: new Date(Date.now() - 7200000), fuente: "Buzón Digital" },
  { id: 2, texto: "Los horarios de fin de semana son muy limitados.", sentimiento: "negativo", score: 0.85, fecha: new Date(Date.now() - 18000000), fuente: "Encuesta" },
  { id: 3, texto: "La nueva sección de coworking es un gran acierto.", sentimiento: "positivo", score: 0.88, fecha: new Date(Date.now() - 28800000), fuente: "Redes Sociales" },
  { id: 4, texto: "Las computadoras necesitan actualización urgente.", sentimiento: "negativo", score: 0.91, fecha: new Date(Date.now() - 86400000), fuente: "Buzón Físico" },
  { id: 5, texto: "Buen acervo en ciencias sociales, faltan títulos en economía.", sentimiento: "neutral", score: 0.65, fecha: new Date(Date.now() - 90000000), fuente: "Encuesta" },
];

// ===== SIMPLE NLP SIMULATION =====
function analyzeSentiment(text) {
  const lower = text.toLowerCase();
  const pos = ["excelente","bueno","genial","increíble","perfecto","bien","gran","mejor","gracias","ayuda","rápido","cómodo","limpio","amable","recomiendo","útil","eficiente","fantástico","agradable","satisfecho"];
  const neg = ["malo","terrible","pésimo","lento","sucio","falta","nunca","peor","urgente","necesitan","limitado","difícil","problema","queja","roto","viejo","inadecuado","insuficiente","deficiente","horrible"];
  let pScore = 0, nScore = 0;
  pos.forEach(w => { if (lower.includes(w)) pScore += 1; });
  neg.forEach(w => { if (lower.includes(w)) nScore += 1; });
  const total = pScore + nScore || 1;
  if (pScore > nScore) return { sentimiento: "positivo", score: Math.min(0.55 + (pScore / total) * 0.4, 0.98) };
  if (nScore > pScore) return { sentimiento: "negativo", score: Math.min(0.55 + (nScore / total) * 0.4, 0.98) };
  return { sentimiento: "neutral", score: 0.50 + Math.random() * 0.15 };
}

function timeAgo(d) {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "Ahora";
  if (s < 3600) return `Hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `Hace ${Math.floor(s / 3600)}h`;
  return `Hace ${Math.floor(s / 86400)}d`;
}

// ===== COMPONENTS =====
const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0e1629", color: "#fff", padding: 10, borderRadius: 10, fontSize: 11, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#94a3b8" }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{typeof p.value === "number" ? p.value.toLocaleString() : p.value}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({ icon: Icon, label, value, change, changeType, color, t, onClick }) {
  return (
    <div onClick={onClick} className="transition-all duration-200"
      style={{ background: t.card, borderRadius: 16, padding: 18, border: `1px solid ${t.cardBorder}`, cursor: onClick ? "pointer" : "default", boxShadow: t.shadow }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: `${color}15` }}>
          <Icon size={18} color={color} />
        </div>
        {change && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: changeType === "up" ? `${t.green}15` : `${t.rose}15`, color: changeType === "up" ? t.green : t.rose }}>
            {changeType === "up" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{change}
          </div>
        )}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.text, fontFamily: "'DM Sans', sans-serif" }}>{value}</div>
      <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function Badge({ tipo, t }) {
  const cfg = {
    positivo: { color: t.green, icon: <ThumbsUp size={10} />, label: "Positivo" },
    negativo: { color: t.rose, icon: <ThumbsDown size={10} />, label: "Negativo" },
    neutral: { color: t.amber, icon: <Minus size={10} />, label: "Neutral" },
  };
  const c = cfg[tipo] || cfg.neutral;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: `${c.color}15`, color: c.color }}>
      {c.icon} {c.label}
    </span>
  );
}

function ProgressRow({ item, t }) {
  const color = item.estado === "bien" ? t.green : item.estado === "riesgo" ? t.rose : t.blue;
  return (
    <div style={{ padding: "12px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{item.nombre}</span>
        <span style={{ fontSize: 10, color: t.textDim }}>Meta: {item.meta}</span>
      </div>
      <div style={{ width: "100%", height: 6, borderRadius: 3, background: `${t.text}08`, overflow: "hidden" }}>
        <div style={{ width: `${item.progreso}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.8s ease" }} />
      </div>
      <div style={{ textAlign: "right", marginTop: 3, fontSize: 10, fontWeight: 700, color }}>{item.progreso}%</div>
    </div>
  );
}

// ===== DROPDOWN =====
function Dropdown({ label, value, options, onChange, t, icon: Icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  const selected = options.find(o => o.value === value);
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.card, fontSize: 11, fontWeight: 600, color: t.text, cursor: "pointer" }}>
        {Icon && <Icon size={12} color={t.teal} />}
        <span style={{ color: t.textDim }}>{label}:</span>
        <span>{selected?.label}</span>
        <ChevronDown size={12} color={t.textDim} style={{ transform: open ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, marginTop: 4, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 10, padding: 4, zIndex: 100, minWidth: 160, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" }}>
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "none", background: o.value === value ? `${t.teal}12` : "transparent", color: o.value === value ? t.teal : t.text, fontSize: 11, fontWeight: o.value === value ? 600 : 400, cursor: "pointer" }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ===== NAV =====
const navMain = [
  { id: "overview", icon: Home, label: "Vista General" },
  { id: "servicios", icon: BarChart3, label: "Servicios" },
  { id: "predictivo", icon: TrendingUp, label: "Mod. Predictivo" },
  { id: "sentimiento", icon: Heart, label: "Mod. Sentimiento" },
  { id: "impacto", icon: GraduationCap, label: "Mod. Impacto" },
  { id: "datos", icon: Database, label: "Datos & Upload" },
];

// ===== SERVICIOS DATA =====
const mesesFull = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep"];

function genServiciosMes(seed) {
  const b = 1 + (seed % 3) * 0.15;
  return mesesFull.map((m, i) => ({
    mes: m,
    domicilio: Math.round((820 + Math.sin(i*0.8)*180 + (seed*17%60)) * b),
    sala: Math.round((540 + Math.cos(i*0.6)*120 + (seed*13%40)) * b),
    interbibliotecario: Math.round((110 + Math.sin(i*1.1)*35 + (seed*7%20)) * b),
    computadoras: Math.round((1350 + Math.sin(i*0.7)*280 + (seed*11%80)) * b),
    internet: Math.round((2100 + Math.cos(i*0.5)*350 + (seed*9%100)) * b),
    impresiones: Math.round((680 + Math.sin(i*0.9)*150 + (seed*19%50)) * b),
    talleres: Math.round((45 + Math.sin(i*1.2)*15 + (seed*3%8)) * b),
    capacitaciones: Math.round((28 + Math.cos(i*0.8)*10 + (seed*5%6)) * b),
    asesorias: Math.round((92 + Math.sin(i*0.6)*25 + (seed*11%15)) * b),
    cubiculos: Math.round((380 + Math.sin(i*0.7)*80 + (seed*7%30)) * b),
    salasEstudio: Math.round((520 + Math.cos(i*0.5)*110 + (seed*13%40)) * b),
    coworking: Math.round((210 + Math.sin(i*1.0)*55 + (seed*17%25)) * b),
  }));
}

const carreras = ["Ing. Civil","Ing. Software","Medicina","Derecho","Psicología","Contaduría","Diseño","Arquitectura","Enfermería","Admón. Empresas"];
function genServiciosCarrera(seed) {
  const bases = [1.3,1.5,1.1,0.9,1.0,0.8,0.7,0.85,0.95,0.75];
  return carreras.map((c, i) => ({
    carrera: c,
    prestamos: Math.round((420 + (seed*7%80)) * bases[i]),
    computadoras: Math.round((580 + (seed*11%60)) * bases[i]),
    talleres: Math.round((32 + (seed*3%10)) * bases[i] * 0.6),
    espacios: Math.round((290 + (seed*13%50)) * bases[i]),
    total: Math.round((1320 + (seed*17%120)) * bases[i]),
  }));
}

const tiposUsuario = ["Alumno Lic.","Alumno Posgrado","Docente","Investigador","Externo"];
function genServiciosTipoUsuario(seed) {
  const pcts = [58,15,12,8,7];
  return tiposUsuario.map((tipo, i) => ({
    tipo,
    prestamos: Math.round((3200 * pcts[i]/100) + (seed*7%40)),
    computo: Math.round((4800 * pcts[i]/100) + (seed*11%30)),
    talleres: Math.round((180 * pcts[i]/100) + (seed*3%8)),
    espacios: Math.round((2600 * pcts[i]/100) + (seed*13%20)),
    pct: pcts[i],
  }));
}

function genServiciosTurno(seed) {
  return [
    { turno: "Matutino (7–13h)", prestamos: 1420+(seed*7%80), computo: 1850+(seed*11%60), talleres: 72+(seed*3%10), espacios: 980+(seed*13%40), pct: 42 },
    { turno: "Vespertino (13–19h)", prestamos: 1180+(seed*7%60), computo: 1620+(seed*11%50), talleres: 65+(seed*3%8), espacios: 1120+(seed*13%35), pct: 37 },
    { turno: "Nocturno (19–22h)", prestamos: 420+(seed*7%30), computo: 680+(seed*11%25), talleres: 18+(seed*3%5), espacios: 480+(seed*13%20), pct: 21 },
  ];
}

function buildTableRows(mesSvc, carreraSvc, tipoSvc, turnoSvc) {
  const rows = [];
  let id = 1;
  mesesFull.forEach(m => {
    const d = mesSvc.find(x => x.mes === m);
    if (!d) return;
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "Domicilio", valor: d.domicilio });
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "En Sala", valor: d.sala });
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "Interbibliotecario", valor: d.interbibliotecario });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Computadoras", valor: d.computadoras });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Internet WiFi", valor: d.internet });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Impresiones", valor: d.impresiones });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Talleres", valor: d.talleres });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Capacitaciones", valor: d.capacitaciones });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Asesorías", valor: d.asesorias });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Cubículos", valor: d.cubiculos });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Salas de Estudio", valor: d.salasEstudio });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Coworking", valor: d.coworking });
  });
  carreraSvc.forEach(c => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Carrera", servicio: c.carrera, valor: c.total });
  });
  tipoSvc.forEach(u => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Tipo Usuario", servicio: u.tipo, valor: u.prestamos + u.computo + u.talleres + u.espacios });
  });
  turnoSvc.forEach(tr => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Turno", servicio: tr.turno, valor: tr.prestamos + tr.computo + tr.talleres + tr.espacios });
  });
  return rows;
}

// ===== MAIN APP =====
export default function BiblioAnalytics360() {
  const [dark, setDark] = useState(false);
  const t = dark ? themes.dark : themes.light;
  const [nav, setNav] = useState("overview");
  const [campus, setCampus] = useState("todos");
  const [periodo, setPeriodo] = useState("2024-2");
  const [searchQ, setSearchQ] = useState("");
  const [showNotif, setShowNotif] = useState(false);
  const [comments, setComments] = useState(defaultComments);
  const [newComment, setNewComment] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [predHorizon, setPredHorizon] = useState(3);
  const [predModel, setPredModel] = useState("rf");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [dataRows, setDataRows] = useState(15247);
  const [notifications, setNotifications] = useState([
    { id: 1, text: "Predicción Oct actualizada: 1,950 préstamos esperados", type: "info", time: "Hace 2h" },
    { id: 2, text: "Alerta: Sala de Cómputo con 35% de progreso (en riesgo)", type: "warn", time: "Hace 5h" },
    { id: 3, text: "3 nuevos comentarios analizados por NLP", type: "success", time: "Hace 8h" },
  ]);

  // ===== DATOS REALES DEL BACKEND =====
  const [realStats, setRealStats] = useState(null);
  const [realData, setRealData] = useState([]);
  const [realLoading, setRealLoading] = useState(true);
  const [realError, setRealError] = useState(null);

  useEffect(() => {
    setRealLoading(true);
    Promise.all([
      fetch(`${API_URL}/api/v1/uso-computadoras/stats`).then(r => r.json()),
      fetch(`${API_URL}/api/v1/uso-computadoras`).then(r => r.json()),
    ])
      .then(([stats, data]) => {
        setRealStats(stats);
        setRealData(data.data || []);
        setRealLoading(false);
      })
      .catch(() => {
        setRealError("No se pudo conectar al backend");
        setRealLoading(false);
      });
  }, []);

  // Gráfico de barras con datos reales agrupados por propósito
  const realPorProposito = useMemo(() => {
    if (!realStats?.por_proposito) return [];
    return Object.entries(realStats.por_proposito).map(([name, value]) => ({ name, value }));
  }, [realStats]);

  const realPorTipo = useMemo(() => {
    if (!realStats?.por_tipo_usuario) return [];
    return Object.entries(realStats.por_tipo_usuario).map(([name, value]) => ({ name, value }));
  }, [realStats]);

  const realPorBiblioteca = useMemo(() => {
    if (!realStats?.por_biblioteca) return [];
    return Object.entries(realStats.por_biblioteca).map(([name, value]) => ({ name, value }));
  }, [realStats]);

  const seed = campus === "todos" ? 0 : campus === "central" ? 1 : campus === "norte" ? 2 : 3;
  const circulacion = useMemo(() => genCirculacion(seed, campus, periodo), [seed, campus, periodo]);
  const sentTendencia = useMemo(() => genSentimiento(seed), [seed]);

  const [svcView, setSvcView] = useState("temporal");
  const [svcCategory, setSvcCategory] = useState("todos");
  const [svcSearch, setSvcSearch] = useState("");
  const [svcPage, setSvcPage] = useState(0);
  const SVC_PAGE_SIZE = 15;

  const svcMes = useMemo(() => genServiciosMes(seed), [seed]);
  const svcCarrera = useMemo(() => genServiciosCarrera(seed), [seed]);
  const svcTipoUsr = useMemo(() => genServiciosTipoUsuario(seed), [seed]);
  const svcTurno = useMemo(() => genServiciosTurno(seed), [seed]);
  const svcTableAll = useMemo(() => buildTableRows(svcMes, svcCarrera, svcTipoUsr, svcTurno), [svcMes, svcCarrera, svcTipoUsr, svcTurno]);

  const svcTableFiltered = useMemo(() => {
    let rows = svcTableAll;
    if (svcCategory !== "todos") {
      const map = { prestamos: "Préstamos", computo: "Cómputo", formacion: "Formación", espacios: "Espacios" };
      rows = rows.filter(r => r.dimension === map[svcCategory]);
    }
    if (svcSearch.trim()) {
      const q = svcSearch.toLowerCase();
      rows = rows.filter(r =>
        r.servicio.toLowerCase().includes(q) ||
        r.dimension.toLowerCase().includes(q) ||
        r.periodo.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [svcTableAll, svcCategory, svcSearch]);

  const totalPrestamos = useMemo(() => {
    const s = circulacion.reduce((a, c) => a + (c.prestamos || 0), 0);
    return s.toLocaleString();
  }, [circulacion]);

  const lastPrestamos = circulacion.filter(c => c.prestamos).slice(-1)[0]?.prestamos || 0;

  const submitComment = useCallback(() => {
    if (!newComment.trim()) return;
    setAnalyzing(true);
    setTimeout(() => {
      const analysis = analyzeSentiment(newComment);
      const c = {
        id: Date.now(),
        texto: newComment,
        sentimiento: analysis.sentimiento,
        score: analysis.score,
        fecha: new Date(),
        fuente: "Entrada Manual",
      };
      setComments(prev => [c, ...prev]);
      setNewComment("");
      setAnalyzing(false);
      setNotifications(prev => [
        { id: Date.now(), text: `Comentario analizado: ${analysis.sentimiento} (${(analysis.score * 100).toFixed(0)}% confianza)`, type: analysis.sentimiento === "positivo" ? "success" : analysis.sentimiento === "negativo" ? "warn" : "info", time: "Ahora" },
        ...prev,
      ]);
    }, 1200);
  }, [newComment]);

  const exportCSV = useCallback(() => {
    const header = "Mes,Prestamos,Devoluciones,Prediccion\n";
    const rows = circulacion.map(c => `${c.mes},${c.prestamos||""},${c.devoluciones||""},${c.prediccion||""}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `biblioanalytics_${campus}_${periodo}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [circulacion, campus, periodo]);

  const exportSentCSV = useCallback(() => {
    const header = "ID,Texto,Sentimiento,Confianza,Fecha,Fuente\n";
    const rows = comments.map(c => `${c.id},"${c.texto}",${c.sentimiento},${(c.score*100).toFixed(1)}%,${c.fecha.toISOString()},${c.fuente}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "sentimiento_analisis.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [comments]);

  const exportSvcCSV = useCallback(() => {
    const header = "ID,Periodo,Dimension,Servicio,Valor\n";
    const rows = svcTableFiltered.map(r => `${r.id},${r.periodo},${r.dimension},${r.servicio},${r.valor}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `servicios_${svcCategory}_${campus}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [svcTableFiltered, svcCategory, campus]);

  const posCount = comments.filter(c => c.sentimiento === "positivo").length;
  const negCount = comments.filter(c => c.sentimiento === "negativo").length;
  const satPct = comments.length ? Math.round((posCount / comments.length) * 100) : 0;

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif", color: t.text }}>

      {/* SIDEBAR */}
      <aside style={{ width: 240, flexShrink: 0, background: t.sidebarBg, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100%", zIndex: 50 }}>
        <div style={{ padding: "20px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: `linear-gradient(135deg, ${t.teal}, ${t.tealLight})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={16} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: t.sidebarText }}>BiblioAnalytics</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.teal }}>360 — Prototipo</div>
          </div>
        </div>

        <div style={{ padding: "16px 10px", flex: 1 }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, padding: "0 10px", marginBottom: 8, color: t.sidebarDim }}>Analítica</div>
          {navMain.map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", marginBottom: 2, cursor: "pointer",
                background: nav === item.id ? `${t.teal}20` : "transparent",
                color: nav === item.id ? t.tealLight : t.sidebarDim,
                fontSize: 12, fontWeight: nav === item.id ? 600 : 400, textAlign: "left", transition: "all 0.15s" }}>
              <item.icon size={16} />
              <span>{item.label}</span>
              {nav === item.id && <ChevronRight size={12} style={{ marginLeft: "auto" }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button onClick={() => setDark(!dark)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "none", background: "rgba(255,255,255,0.05)", color: t.sidebarDim, fontSize: 11, cursor: "pointer" }}>
            {dark ? <Sun size={14} /> : <Moon size={14} />}
            {dark ? "Modo Claro" : "Modo Oscuro"}
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, padding: "8px 10px", borderRadius: 8, background: "rgba(255,255,255,0.04)" }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: `linear-gradient(135deg, ${t.purple}, ${t.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>DB</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>Daniel B.</div>
              <div style={{ fontSize: 9, color: t.sidebarDim }}>Administrador</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, marginLeft: 240 }}>
        {/* TOP BAR */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", background: `${t.bg}ee`, backdropFilter: "blur(12px)" }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: t.text }}>
              {nav === "overview" && "Vista General"}{nav === "servicios" && "Estadísticas de Servicios"}
              {nav === "predictivo" && "Módulo Predictivo"}
              {nav === "sentimiento" && "Módulo de Sentimiento"}{nav === "impacto" && "Módulo de Impacto"}
              {nav === "datos" && "Datos & Upload"}
            </h1>
            <p style={{ fontSize: 11, color: t.textDim, margin: 0 }}>Biblioteca Central UACJ · Prototipo Funcional</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: t.card, border: `1px solid ${t.cardBorder}`, fontSize: 11 }}>
              <Search size={13} color={t.textDim} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar métricas..."
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: t.text, width: 120 }} />
              {searchQ && <X size={12} color={t.textDim} style={{ cursor: "pointer" }} onClick={() => setSearchQ("")} />}
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)}
                style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
                <Bell size={15} color={t.text} />
                <div style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: t.rose }} />
              </button>
              {showNotif && (
                <div style={{ position: "absolute", top: "100%", right: 0, marginTop: 6, width: 320, background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 14, padding: 12, zIndex: 200, boxShadow: "0 12px 32px rgba(0,0,0,0.15)" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: t.text }}>Notificaciones</div>
                  {notifications.slice(0, 5).map(n => (
                    <div key={n.id} style={{ display: "flex", gap: 8, padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", marginTop: 5, flexShrink: 0, background: n.type === "warn" ? t.amber : n.type === "success" ? t.green : t.blue }} />
                      <div>
                        <div style={{ fontSize: 11, color: t.text, lineHeight: 1.4 }}>{n.text}</div>
                        <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>{n.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportCSV}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.teal}, #0d9488)`, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <Download size={13} /> Exportar
            </button>
          </div>
        </header>

        {/* GLOBAL FILTERS */}
        <div style={{ padding: "0 28px 12px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Dropdown label="Campus" value={campus} onChange={setCampus} t={t} icon={Globe}
            options={[{ value: "todos", label: "Todos los Campus" }, { value: "central", label: "Campus Central" }, { value: "norte", label: "Campus Norte" }, { value: "sur", label: "Campus Sur" }]} />
          <Dropdown label="Periodo" value={periodo} onChange={setPeriodo} t={t} icon={Calendar}
            options={[{ value: "2024-1", label: "Ene – Jul 2024" }, { value: "2024-2", label: "Ago 2024 – Ene 2025" }, { value: "2025-1", label: "Feb – Jul 2025" }]} />
        </div>

        <div style={{ padding: "0 28px 28px" }}>

          {/* ===== OVERVIEW ===== */}
          {nav === "overview" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={BookOpen} label="Préstamos (último mes)" value={lastPrestamos.toLocaleString()} change="+25.5%" changeType="up" color={t.teal} t={t} />
                <StatCard icon={Users} label="Visitas este periodo" value="3,942" change="+21.8%" changeType="up" color={t.blue} t={t} />
                <StatCard icon={Heart} label="Satisfacción NLP" value={`${satPct}%`} change="+3.8pp" changeType="up" color={t.purple} t={t} onClick={() => setNav("sentimiento")} />
                <StatCard icon={GraduationCap} label="Correlación r=" value="0.73" color={t.amber} t={t} onClick={() => setNav("impacto")} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Circulación de Colecciones</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Datos filtrados por: {campus === "todos" ? "Todos" : campus.charAt(0).toUpperCase() + campus.slice(1)} · {periodo}</div>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={circulacion}>
                      <defs>
                        <linearGradient id="gT" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.teal} stopOpacity={0.2} /><stop offset="100%" stopColor={t.teal} stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTooltip />} />
                      <Area type="monotone" dataKey="prestamos" name="Préstamos" stroke={t.teal} fill="url(#gT)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Area type="monotone" dataKey="devoluciones" name="Devoluciones" stroke={t.blue} fill="none" strokeWidth={2} dot={{ r: 2 }} />
                      <Area type="monotone" dataKey="prediccion" name="Predicción ML" stroke={t.amber} fill="none" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4, fill: t.amber, stroke: "#fff", strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Distribución por Área</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 12 }}>Préstamos por campo</div>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart><Pie data={colAreas} dataKey="v" nameKey="area" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} cornerRadius={3}>
                      {colAreas.map((_, i) => <Cell key={i} fill={pieColors[i]} />)}
                    </Pie><Tooltip content={<CTooltip />} /></PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 10px", marginTop: 8 }}>
                    {colAreas.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: pieColors[i], flexShrink: 0 }} />
                        <span style={{ color: t.textDim, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.area}</span>
                        <span style={{ fontWeight: 700, marginLeft: "auto", color: t.text }}>{c.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Monitoreo de Iniciativas</div>
                <div style={{ fontSize: 10, color: t.textDim, marginBottom: 12 }}>Seguimiento de proyectos estratégicos activos</div>
                {iniciativasBase.map((item, i) => <ProgressRow key={i} item={item} t={t} />)}
              </div>
            </div>
          )}

          {/* ===== SERVICIOS ===== */}
          {nav === "servicios" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={BookOpen} label="Préstamos (mes actual)" value={(svcMes[svcMes.length-1]?.domicilio + svcMes[svcMes.length-1]?.sala + svcMes[svcMes.length-1]?.interbibliotecario).toLocaleString()} change="+18.4%" changeType="up" color={t.teal} t={t} />
                <StatCard icon={Activity} label="Usos de Cómputo (real)" value={realLoading ? "..." : realError ? "—" : realStats?.total_sesiones?.toString() ?? "0"} color={t.blue} t={t} />
                <StatCard icon={Users} label="Formación (personas)" value={(svcMes[svcMes.length-1]?.talleres + svcMes[svcMes.length-1]?.capacitaciones + svcMes[svcMes.length-1]?.asesorias).toLocaleString()} change="+7.5%" changeType="up" color={t.purple} t={t} />
                <StatCard icon={Layers} label="Uso de Espacios" value={(svcMes[svcMes.length-1]?.cubiculos + svcMes[svcMes.length-1]?.salasEstudio + svcMes[svcMes.length-1]?.coworking).toLocaleString()} change="+22.3%" changeType="up" color={t.amber} t={t} />
              </div>

              {/* View Toggle */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: 0, borderRadius: 10, overflow: "hidden", border: `1px solid ${t.cardBorder}` }}>
                  {[{v:"temporal",l:"Por Mes",ic:Calendar},{v:"carrera",l:"Por Carrera",ic:GraduationCap},{v:"usuario",l:"Por Tipo Usuario",ic:Users},{v:"turno",l:"Por Turno",ic:Clock}].map(tab => (
                    <button key={tab.v} onClick={() => { setSvcView(tab.v); setSvcPage(0); }}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", border: "none", fontSize: 11, fontWeight: svcView === tab.v ? 600 : 400, cursor: "pointer",
                        background: svcView === tab.v ? `${t.teal}15` : t.card,
                        color: svcView === tab.v ? t.teal : t.textDim }}>
                      <tab.ic size={12} /> {tab.l}
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 4, marginLeft: 8 }}>
                  {[{v:"todos",l:"Todos"},{v:"prestamos",l:"Préstamos"},{v:"computo",l:"Cómputo"},{v:"formacion",l:"Formación"},{v:"espacios",l:"Espacios"}].map(cat => (
                    <button key={cat.v} onClick={() => { setSvcCategory(cat.v); setSvcPage(0); }}
                      style={{ padding: "5px 10px", borderRadius: 8, border: `1px solid ${svcCategory === cat.v ? t.teal : t.cardBorder}`, fontSize: 10, fontWeight: svcCategory === cat.v ? 600 : 400, cursor: "pointer",
                        background: svcCategory === cat.v ? `${t.teal}12` : "transparent",
                        color: svcCategory === cat.v ? t.teal : t.textDim }}>
                      {cat.l}
                    </button>
                  ))}
                </div>
              </div>

              {/* ---- TEMPORAL VIEW ---- */}
              {svcView === "temporal" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>

                  {(svcCategory === "todos" || svcCategory === "prestamos") && (
                    <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Préstamos por Tipo</div>
                      <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Domicilio · En sala · Interbibliotecario</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={svcMes}>
                          <defs>
                            <linearGradient id="svG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.teal} stopOpacity={0.2}/><stop offset="100%" stopColor={t.teal} stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CTooltip />} />
                          <Area type="monotone" dataKey="domicilio" name="Domicilio" stroke={t.teal} fill="url(#svG1)" strokeWidth={2} dot={{ r: 2 }} />
                          <Area type="monotone" dataKey="sala" name="En Sala" stroke={t.blue} fill="none" strokeWidth={2} dot={{ r: 2 }} />
                          <Area type="monotone" dataKey="interbibliotecario" name="Interbiblio." stroke={t.purple} fill="none" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* ===== CÓMPUTO — DATOS REALES ===== */}
                  {(svcCategory === "todos" || svcCategory === "computo") && (
                    <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `2px solid ${t.teal}50` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: realStats ? t.green : realLoading ? t.amber : t.rose, flexShrink: 0 }} />
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Uso de Computadoras</div>
                        <span style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 20, fontSize: 9, fontWeight: 700, background: `${t.teal}15`, color: t.teal }}>DATOS REALES</span>
                      </div>
                      <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>
                        {realLoading ? "Conectando con Google Sheets..." : realError ? realError : `${realStats?.total_sesiones} sesiones registradas · Google Forms en tiempo real`}
                      </div>

                      {realLoading && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: t.textDim, fontSize: 12 }}>
                          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} /> Cargando datos...
                        </div>
                      )}

                      {realError && !realLoading && (
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 180, color: t.rose, fontSize: 12, flexDirection: "column", gap: 8 }}>
                          <AlertTriangle size={24} />
                          <span>{realError}</span>
                        </div>
                      )}

                      {realStats && !realLoading && (
                        <>
                          {/* KPIs reales */}
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
                            <div style={{ padding: 12, borderRadius: 10, background: `${t.teal}08`, border: `1px solid ${t.teal}20`, textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: t.teal }}>{realStats.total_sesiones}</div>
                              <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>Total Sesiones</div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 10, background: `${t.blue}08`, border: `1px solid ${t.blue}20`, textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: t.blue }}>{Object.keys(realStats.por_biblioteca || {}).length}</div>
                              <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>Bibliotecas</div>
                            </div>
                            <div style={{ padding: 12, borderRadius: 10, background: `${t.purple}08`, border: `1px solid ${t.purple}20`, textAlign: "center" }}>
                              <div style={{ fontSize: 24, fontWeight: 700, color: t.purple }}>{realStats.duracion_promedio_minutos ?? "—"}</div>
                              <div style={{ fontSize: 9, color: t.textDim, marginTop: 2 }}>Min. promedio</div>
                            </div>
                          </div>

                          {/* Gráfico por propósito */}
                          {realPorProposito.length > 0 && (
                            <>
                              <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>Por Propósito de Uso</div>
                              <ResponsiveContainer width="100%" height={140}>
                                <BarChart data={realPorProposito} layout="vertical" margin={{ left: 10 }}>
                                  <XAxis type="number" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} width={120} />
                                  <Tooltip content={<CTooltip />} />
                                  <Bar dataKey="value" name="Sesiones" fill={t.teal} radius={[0,4,4,0]} />
                                </BarChart>
                              </ResponsiveContainer>
                            </>
                          )}

                          {/* Por tipo de usuario y biblioteca */}
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                            <div style={{ padding: 10, borderRadius: 10, background: `${t.text}04` }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6 }}>Por Tipo de Usuario</div>
                              {Object.entries(realStats.por_tipo_usuario || {}).map(([tipo, count], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                                  <span style={{ color: t.text }}>{tipo}</span>
                                  <span style={{ fontWeight: 700, color: t.blue }}>{count}</span>
                                </div>
                              ))}
                            </div>
                            <div style={{ padding: 10, borderRadius: 10, background: `${t.text}04` }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6 }}>Por Biblioteca</div>
                              {Object.entries(realStats.por_biblioteca || {}).map(([bib, count], i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 11 }}>
                                  <span style={{ color: t.text }}>{bib}</span>
                                  <span style={{ fontWeight: 700, color: t.purple }}>{count}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {(svcCategory === "todos" || svcCategory === "formacion") && (
                    <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Formación y Asesorías</div>
                      <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Talleres · Capacitaciones · Asesorías individuales</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={svcMes}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CTooltip />} />
                          <Line type="monotone" dataKey="talleres" name="Talleres" stroke={t.purple} strokeWidth={2.5} dot={{ r: 3, fill: t.purple, stroke: "#fff", strokeWidth: 2 }} />
                          <Line type="monotone" dataKey="capacitaciones" name="Capacitaciones" stroke={t.rose} strokeWidth={2} dot={{ r: 3 }} />
                          <Line type="monotone" dataKey="asesorias" name="Asesorías" stroke={t.amber} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {(svcCategory === "todos" || svcCategory === "espacios") && (
                    <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Uso de Espacios</div>
                      <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Cubículos · Salas de estudio · Coworking</div>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={svcMes}>
                          <defs>
                            <linearGradient id="svG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.amber} stopOpacity={0.2}/><stop offset="100%" stopColor={t.amber} stopOpacity={0}/></linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                          <XAxis dataKey="mes" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                          <Tooltip content={<CTooltip />} />
                          <Area type="monotone" dataKey="cubiculos" name="Cubículos" stroke={t.amber} fill="url(#svG2)" strokeWidth={2} dot={{ r: 2 }} />
                          <Area type="monotone" dataKey="salasEstudio" name="Salas de Estudio" stroke={t.green} fill="none" strokeWidth={2} dot={{ r: 2 }} />
                          <Area type="monotone" dataKey="coworking" name="Coworking" stroke={t.rose} fill="none" strokeWidth={2} dot={{ r: 2 }} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )}

              {/* ---- CARRERA VIEW ---- */}
              {svcView === "carrera" && (
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Uso de Servicios por Carrera</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Total acumulado del periodo · Top 10 carreras</div>
                  <ResponsiveContainer width="100%" height={340}>
                    <BarChart data={svcCarrera} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="carrera" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} width={110} />
                      <Tooltip content={<CTooltip />} />
                      <Bar dataKey="prestamos" name="Préstamos" fill={t.teal} stackId="a" radius={0} />
                      <Bar dataKey="computadoras" name="Cómputo" fill={t.blue} stackId="a" radius={0} />
                      <Bar dataKey="talleres" name="Formación" fill={t.purple} stackId="a" radius={0} />
                      <Bar dataKey="espacios" name="Espacios" fill={t.amber} stackId="a" radius={[0,4,4,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* ---- TIPO USUARIO VIEW ---- */}
              {svcView === "usuario" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Distribución por Tipo de Usuario</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                        <Pie data={svcTipoUsr} dataKey="pct" nameKey="tipo" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} cornerRadius={3}>
                          {svcTipoUsr.map((_,i) => <Cell key={i} fill={[t.teal, t.blue, t.purple, t.amber, t.rose][i]} />)}
                        </Pie>
                        <Tooltip content={<CTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Servicios por Tipo de Usuario</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={svcTipoUsr}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                        <XAxis dataKey="tipo" tick={{ fontSize: 8, fill: t.textDim }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTooltip />} />
                        <Bar dataKey="prestamos" name="Préstamos" fill={t.teal} radius={[4,4,0,0]} />
                        <Bar dataKey="computo" name="Cómputo" fill={t.blue} radius={[4,4,0,0]} />
                        <Bar dataKey="talleres" name="Formación" fill={t.purple} radius={[4,4,0,0]} />
                        <Bar dataKey="espacios" name="Espacios" fill={t.amber} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* ---- TURNO VIEW ---- */}
              {svcView === "turno" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Uso por Turno</div>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={svcTurno}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                        <XAxis dataKey="turno" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CTooltip />} />
                        <Bar dataKey="prestamos" name="Préstamos" fill={t.teal} radius={[4,4,0,0]} />
                        <Bar dataKey="computo" name="Cómputo" fill={t.blue} radius={[4,4,0,0]} />
                        <Bar dataKey="talleres" name="Formación" fill={t.purple} radius={[4,4,0,0]} />
                        <Bar dataKey="espacios" name="Espacios" fill={t.amber} radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Proporción por Turno</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 20 }}>
                      {svcTurno.map((tr, i) => {
                        const colors = [t.teal, t.blue, t.purple];
                        const total = tr.prestamos + tr.computo + tr.talleres + tr.espacios;
                        return (
                          <div key={i}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                              <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{tr.turno}</span>
                              <span style={{ fontSize: 12, fontWeight: 700, color: colors[i] }}>{tr.pct}% — {total.toLocaleString()} usos</span>
                            </div>
                            <div style={{ width: "100%", height: 12, borderRadius: 6, background: `${t.text}06`, overflow: "hidden" }}>
                              <div style={{ width: `${tr.pct}%`, height: "100%", borderRadius: 6, background: colors[i], transition: "width 0.8s" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ---- TABLE ---- */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Tabla de Datos Detallada</div>
                    <div style={{ fontSize: 10, color: t.textDim }}>{svcTableFiltered.length} registros</div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 8, background: t.inputBg, border: `1px solid ${t.cardBorder}` }}>
                      <Search size={12} color={t.textDim} />
                      <input value={svcSearch} onChange={e => { setSvcSearch(e.target.value); setSvcPage(0); }}
                        placeholder="Buscar..."
                        style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: t.text, width: 160 }} />
                      {svcSearch && <X size={11} color={t.textDim} style={{ cursor: "pointer" }} onClick={() => setSvcSearch("")} />}
                    </div>
                    <button onClick={exportSvcCSV}
                      style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "transparent", fontSize: 10, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                      <Download size={11} /> CSV
                    </button>
                  </div>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                    <thead>
                      <tr>
                        {["#","Periodo","Dimensión","Servicio","Valor"].map((h, i) => (
                          <th key={i} style={{ textAlign: i === 4 ? "right" : "left", padding: "10px 12px", borderBottom: `2px solid ${t.cardBorder}`, fontSize: 10, fontWeight: 700, color: t.textDim, textTransform: "uppercase" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {svcTableFiltered.slice(svcPage * SVC_PAGE_SIZE, (svcPage + 1) * SVC_PAGE_SIZE).map((row, i) => {
                        const dimColor = { "Préstamos": t.teal, "Cómputo": t.blue, "Formación": t.purple, "Espacios": t.amber, "Por Carrera": t.green, "Por Tipo Usuario": t.rose, "Por Turno": t.amber }[row.dimension] || t.textDim;
                        return (
                          <tr key={row.id} style={{ borderBottom: `1px solid ${t.cardBorder}`, background: i % 2 === 0 ? "transparent" : `${t.text}03` }}>
                            <td style={{ padding: "8px 12px", color: t.textDim, fontSize: 10 }}>{row.id}</td>
                            <td style={{ padding: "8px 12px", color: t.text }}>{row.periodo}</td>
                            <td style={{ padding: "8px 12px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, background: `${dimColor}12`, color: dimColor }}>{row.dimension}</span>
                            </td>
                            <td style={{ padding: "8px 12px", color: t.text, fontWeight: 500 }}>{row.servicio}</td>
                            <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: 700, color: t.text }}>{row.valor.toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {svcTableFiltered.length > SVC_PAGE_SIZE && (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                    <span style={{ fontSize: 10, color: t.textDim }}>
                      Mostrando {svcPage * SVC_PAGE_SIZE + 1}–{Math.min((svcPage + 1) * SVC_PAGE_SIZE, svcTableFiltered.length)} de {svcTableFiltered.length}
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => setSvcPage(p => Math.max(0, p - 1))} disabled={svcPage === 0}
                        style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.cardBorder}`, background: "transparent", fontSize: 10, color: svcPage === 0 ? t.textMuted : t.text, cursor: svcPage === 0 ? "default" : "pointer" }}>
                        <ChevronLeft size={12} />
                      </button>
                      {Array.from({ length: Math.min(5, Math.ceil(svcTableFiltered.length / SVC_PAGE_SIZE)) }, (_, i) => (
                        <button key={i} onClick={() => setSvcPage(i)}
                          style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${svcPage === i ? t.teal : t.cardBorder}`, background: svcPage === i ? `${t.teal}15` : "transparent", fontSize: 10, fontWeight: svcPage === i ? 700 : 400, color: svcPage === i ? t.teal : t.textDim, cursor: "pointer" }}>
                          {i + 1}
                        </button>
                      ))}
                      <button onClick={() => setSvcPage(p => Math.min(Math.ceil(svcTableFiltered.length / SVC_PAGE_SIZE) - 1, p + 1))}
                        style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${t.cardBorder}`, background: "transparent", fontSize: 10, color: t.text, cursor: "pointer" }}>
                        <ChevronRight size={12} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===== PREDICTIVO ===== */}
          {nav === "predictivo" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={Target} label="Precisión del modelo" value={predModel === "rf" ? "94.2%" : predModel === "prophet" ? "91.8%" : "88.5%"} change="+1.3%" changeType="up" color={t.teal} t={t} />
                <StatCard icon={Brain} label="Modelo activo" value={predModel === "rf" ? "Random Forest" : predModel === "prophet" ? "Prophet" : "Regresión"} color={t.blue} t={t} />
                <StatCard icon={Zap} label={`Predicción +${predHorizon} meses`} value={predHorizon <= 2 ? "1,950" : predHorizon <= 4 ? "2,100" : "1,680"} color={t.purple} t={t} />
                <StatCard icon={Activity} label="RMSE (Error)" value={predModel === "rf" ? "48.3" : predModel === "prophet" ? "52.1" : "67.4"} change="-12.7%" changeType="up" color={t.amber} t={t} />
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 20, border: `1px solid ${t.cardBorder}`, marginBottom: 20, display: "flex", gap: 28, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sliders size={14} color={t.teal} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>Controles del Modelo</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: t.textDim }}>Algoritmo</label>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[{ v: "rf", l: "Random Forest" }, { v: "prophet", l: "Prophet" }, { v: "reg", l: "Regresión" }].map(m => (
                      <button key={m.v} onClick={() => setPredModel(m.v)}
                        style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${predModel === m.v ? t.teal : t.cardBorder}`, background: predModel === m.v ? `${t.teal}15` : "transparent", color: predModel === m.v ? t.teal : t.textDim, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                        {m.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 10, color: t.textDim }}>Horizonte: {predHorizon} meses</label>
                  <input type="range" min={1} max={6} value={predHorizon} onChange={e => setPredHorizon(+e.target.value)} style={{ width: 180, accentColor: t.teal }} />
                </div>
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Pronóstico de Circulación</div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={circulacion}>
                    <defs>
                      <linearGradient id="pG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.teal} stopOpacity={0.2} /><stop offset="100%" stopColor={t.teal} stopOpacity={0} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CTooltip />} />
                    <Area type="monotone" dataKey="prestamos" name="Real" stroke={t.teal} fill="url(#pG1)" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="prediccion" name="Predicción" stroke={t.amber} fill="none" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4, fill: t.amber, stroke: "#fff", strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ===== SENTIMIENTO ===== */}
          {nav === "sentimiento" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={Heart} label="Satisfacción" value={`${satPct}%`} color={t.teal} t={t} />
                <StatCard icon={MessageSquare} label="Comentarios" value={comments.length.toString()} color={t.blue} t={t} />
                <StatCard icon={ThumbsUp} label="Positivos" value={posCount.toString()} color={t.green} t={t} />
                <StatCard icon={AlertTriangle} label="Negativos" value={negCount.toString()} color={t.rose} t={t} />
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Brain size={16} color={t.purple} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Analizar Comentario (NLP en tiempo real)</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitComment()}
                    placeholder='Escribe un comentario...'
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.inputBg, fontSize: 12, color: t.text, outline: "none" }} />
                  <button onClick={submitComment} disabled={analyzing || !newComment.trim()}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: analyzing ? t.textDim : `linear-gradient(135deg, ${t.purple}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: analyzing ? "wait" : "pointer", opacity: !newComment.trim() ? 0.5 : 1 }}>
                    {analyzing ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analizando...</> : <><Send size={14} /> Analizar</>}
                  </button>
                </div>
              </div>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Tendencia del Sentimiento</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={sentTendencia}>
                      <defs>
                        <linearGradient id="sG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={t.green} stopOpacity={0.25} /><stop offset="100%" stopColor={t.green} stopOpacity={0} /></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTooltip />} />
                      <Area type="monotone" dataKey="positivo" name="% Positivo" stroke={t.green} fill="url(#sG1)" strokeWidth={2.5} dot={{ r: 3 }} />
                      <Area type="monotone" dataKey="negativo" name="% Negativo" stroke={t.rose} fill="none" strokeWidth={2} dot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Radar de Percepción</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarBase}>
                      <PolarGrid stroke={`${t.text}12`} />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: t.textDim }} />
                      <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                      <Radar dataKey="A" stroke={t.teal} fill={t.teal} fillOpacity={0.2} strokeWidth={2} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Feed de Comentarios</div>
                  <button onClick={exportSentCSV} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "transparent", fontSize: 10, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                    <Download size={11} /> Exportar CSV
                  </button>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ padding: 12, borderRadius: 10, marginBottom: 8, background: `${t.text}04` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Badge tipo={c.sentimiento} t={t} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: t.purple }}>{(c.score * 100).toFixed(0)}% confianza</span>
                        </div>
                        <div style={{ fontSize: 10, color: t.textDim }}>{c.fuente} · {timeAgo(c.fecha)}</div>
                      </div>
                      <p style={{ fontSize: 11, lineHeight: 1.5, color: t.text, margin: 0 }}>{c.texto}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ===== IMPACTO ===== */}
          {nav === "impacto" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={GraduationCap} label="Correlación uso-promedio" value="r = 0.73" color={t.teal} t={t} />
                <StatCard icon={Award} label="Promedio usuarios activos" value="8.6 / 10" change="+0.4" changeType="up" color={t.blue} t={t} />
                <StatCard icon={Users} label="Retención usuarios biblio." value="81%" change="+3.2pp" changeType="up" color={t.purple} t={t} />
                <StatCard icon={Activity} label="Estudiantes analizados" value="2,110" color={t.amber} t={t} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Uso vs. Promedio Académico</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={impactoBase}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="rango" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[6, 10]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTooltip />} />
                      <Bar dataKey="promedio" name="Promedio" radius={[8,8,0,0]}>
                        {impactoBase.map((_, i) => <Cell key={i} fill={[t.blue, t.teal, "#2dd4bf", t.purple, t.amber][i]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 16 }}>Retención por Semestre</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={retencionBase}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="sem" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[30, 100]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTooltip />} />
                      <Line type="monotone" dataKey="usr" name="Usuarios" stroke={t.teal} strokeWidth={3} dot={{ r: 4, fill: t.teal, stroke: "#fff", strokeWidth: 2 }} />
                      <Line type="monotone" dataKey="noUsr" name="No Usuarios" stroke={t.rose} strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4, fill: t.rose, stroke: "#fff", strokeWidth: 2 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ borderRadius: 16, padding: 22, background: `linear-gradient(135deg, ${t.navy}, ${dark ? "#1a2744" : "#1e2d4a"})` }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `${t.teal}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Zap size={22} color={t.tealLight} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Resumen Ejecutivo de Impacto</div>
                    <p style={{ fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                      Correlación estadísticamente significativa (<span style={{ color: t.tealLight }}>r = 0.73, p &lt; 0.001</span>) entre uso de servicios bibliotecarios y rendimiento académico.
                    </p>
                    <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                      {[{ l: "+1.9 pts promedio", c: t.teal }, { l: "+34pp retención", c: t.purple }, { l: "2,110 estudiantes", c: t.amber }].map((b, i) => (
                        <span key={i} style={{ padding: "5px 12px", borderRadius: 8, fontSize: 10, fontWeight: 700, background: `${b.c}25`, color: b.c }}>{b.l}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===== DATOS & UPLOAD ===== */}
          {nav === "datos" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={Database} label="Registros en BD" value={dataRows.toLocaleString()} color={t.teal} t={t} />
                <StatCard icon={FileText} label="Fuentes conectadas" value="3" color={t.blue} t={t} />
                <StatCard icon={CheckCircle} label="Calidad de datos" value="96.8%" color={t.green} t={t} />
                <StatCard icon={Clock} label="Última actualización" value="Hace 2h" color={t.amber} t={t} />
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <Upload size={16} color={t.blue} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Cargar Datos (CSV / Excel)</span>
                </div>
                <div
                  onDragOver={e => { e.preventDefault(); e.currentTarget.style.borderColor = t.teal; }}
                  onDragLeave={e => { e.currentTarget.style.borderColor = t.cardBorder; }}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) { setUploadedFile(file.name); setDataRows(prev => prev + Math.floor(Math.random() * 500 + 100)); }
                  }}
                  style={{ border: `2px dashed ${t.cardBorder}`, borderRadius: 12, padding: 40, textAlign: "center", cursor: "pointer" }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file"; input.accept = ".csv,.xlsx,.xls";
                    input.onchange = (e) => { const file = e.target.files[0]; if (file) { setUploadedFile(file.name); setDataRows(prev => prev + Math.floor(Math.random() * 500 + 100)); } };
                    input.click();
                  }}>
                  <Upload size={32} color={t.textDim} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Arrastra un archivo CSV o Excel aquí</div>
                  <div style={{ fontSize: 10, color: t.textDim }}>o haz clic para seleccionar</div>
                  {uploadedFile && (
                    <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, background: `${t.green}10`, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: t.green }}>
                      <CheckCircle size={14} /> {uploadedFile} cargado
                    </div>
                  )}
                </div>
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Fuentes de Datos Conectadas</div>
                {[
                  { name: "SIAB (Sistema Bibliotecario)", status: "activo", records: "12,450", lastSync: "Hace 2h", icon: BookOpen, color: t.teal },
                  { name: "Sistema Escolar UACJ", status: "activo", records: "2,110", lastSync: "Hace 24h", icon: GraduationCap, color: t.blue },
                  { name: "Google Forms — Uso de Computadoras", status: "activo", records: realLoading ? "..." : `${realStats?.total_sesiones ?? 0}`, lastSync: "Tiempo real", icon: Database, color: t.teal },
                  { name: "Buzón Digital + Encuestas", status: "activo", records: `${comments.length}`, lastSync: "Tiempo real", icon: MessageSquare, color: t.purple },
                ].map((src, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, marginBottom: 8, background: `${t.text}03` }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${src.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <src.icon size={18} color={src.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{src.name}</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>{src.records} registros · {src.lastSync}</div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: `${t.green}12`, color: t.green }}>● Activo</span>
                  </div>
                ))}
              </div>
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Auditoría de Calidad de Datos</div>
                {[
                  { metric: "Registros completos", value: 96.8, color: t.green },
                  { metric: "Campos sin valores nulos", value: 94.2, color: t.green },
                  { metric: "Fechas válidas", value: 99.1, color: t.green },
                  { metric: "Duplicados eliminados", value: 100, color: t.teal },
                  { metric: "Datos anonimizados (SHA-256)", value: 100, color: t.teal },
                ].map((q, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < 4 ? `1px solid ${t.cardBorder}` : "none" }}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: t.text, flex: 1 }}>{q.metric}</span>
                    <div style={{ width: 200, height: 6, borderRadius: 3, background: `${t.text}08`, overflow: "hidden" }}>
                      <div style={{ width: `${q.value}%`, height: "100%", borderRadius: 3, background: q.color }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: q.color, width: 50, textAlign: "right" }}>{q.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
