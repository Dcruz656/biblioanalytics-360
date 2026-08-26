import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { loadCubiConfig, saveCubiConfig, CUBI_CONFIG_KEY, compuZonas, compuSistemas, cubiCarreras } from "./cubiData";
import { dbLoadCubiculos, dbSaveCubiculo, dbSeedCubiculos, dbDeleteCubiculo, dbLoadComputadoras, dbSaveComputadora, dbSeedComputadoras, dbDeleteComputadora, dbLoadAlumnos, dbUpdateAlumno, dbDeleteAlumno, subscribeCubiculos, subscribeComputadoras, subscribeAlumnos, loadAppConfig, saveAppConfig, dbLoadAppConfig, dbSaveAppConfig, subscribeAppConfig, dbSaveHistorialReserva, dbLoadHistorialReservas, subscribeHistorialReservas } from "./db";
import { serverNow } from "./serverTime";
import { getOwnSubscription } from "./pushNotifications";
import html2canvas from "html2canvas";
import { generateExcel, generatePDF, generateServiceExcel, generateServicePDF } from "./exportUtils";
import { QRCodeSVG } from "qrcode.react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart,
  Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter,
  ReferenceLine, LabelList, Sector
} from "recharts";
import {
  BookOpen, Users, TrendingUp, MessageSquare, GraduationCap, Settings,
  ChevronRight, ChevronDown, ArrowUpRight, ArrowDownRight, Search, Bell,
  Download, Activity, AlertTriangle, CheckCircle, Clock, Heart, ThumbsUp,
  ThumbsDown, Minus, Home, FileText, Zap, Target, Award, Brain, BarChart3,
  Filter, Plus, X, Upload, Play, Pause, RefreshCw, Send, Eye, Layers,
  Calendar, ChevronLeft, Moon, Sun, Sliders, Database, Globe, Wrench, Monitor, LayoutGrid, Edit2, Edit3, Trash2, Shield, QrCode, Printer
} from "lucide-react";

// ===== THEME =====
const themes = {
  light: {
    bg: "#f0f4fa", card: "#ffffff", cardBorder: "#e2e8f0", navy: "#0e1629",
    navyLight: "#1a2744", text: "#1e293b", textDim: "#64748b", textMuted: "#94a3b8",
    teal: "#0d9488", tealLight: "#14b8a6", blue: "#2563eb", blueLight: "#3b82f6",
    purple: "#7c3aed", amber: "#d97706", rose: "#e11d48", green: "#059669",
    sidebarBg: "linear-gradient(180deg, #0e1629 0%, #162040 100%)",
    sidebarText: "#ffffff", sidebarDim: "rgba(255,255,255,0.5)",
    inputBg: "#f1f5f9", hover: "#f8fafc", shadow: "0 4px 20px rgba(0,0,0,0.06)",
  },
  dark: {
    bg: "#0d1321", card: "#141f33", cardBorder: "#1e2f4d", navy: "#e2e8f0",
    navyLight: "#cbd5e1", text: "#e2e8f0", textDim: "#94a3b8", textMuted: "#64748b",
    teal: "#14b8a6", tealLight: "#2dd4bf", blue: "#3b82f6", blueLight: "#60a5fa",
    purple: "#8b5cf6", amber: "#f59e0b", rose: "#f43f5e", green: "#10b981",
    sidebarBg: "linear-gradient(180deg, #070e1c 0%, #0d1828 50%, #0e1629 100%)",
    sidebarText: "#ffffff", sidebarDim: "rgba(255,255,255,0.38)",
    inputBg: "#1a2744", hover: "#1e2d48", shadow: "0 4px 20px rgba(0,0,0,0.35)",
  },
};

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

// ===== FORMATTERS =====
const fmtK = v => {
  if (v == null) return "";
  if (v >= 1000) return `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K`;
  return v;
};
const fmtPct = v => (v == null ? "" : `${v}%`);

// ===== ACTIVE PIE SHAPE =====
const PieActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent } = props;
  const label = payload?.area || payload?.tipo || payload?.name || "";
  return (
    <g>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 4} outerRadius={outerRadius + 8} startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} innerRadius={innerRadius - 8} outerRadius={innerRadius - 5} startAngle={startAngle} endAngle={endAngle} fill={fill} opacity={0.4} />
      <text x={cx} y={cy - 7} textAnchor="middle" fill={fill} fontSize={15} fontWeight={800}>{(percent * 100).toFixed(0)}%</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={500}>{label}</text>
    </g>
  );
};

// ===== COMPONENTS =====
const CTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#0b1120", border: "1px solid rgba(255,255,255,0.08)", color: "#fff", padding: "10px 14px", borderRadius: 12, fontSize: 11, boxShadow: "0 12px 32px rgba(0,0,0,0.45)", minWidth: 140 }}>
      <div style={{ fontWeight: 700, marginBottom: 8, color: "#e2e8f0", fontSize: 11, paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 5, paddingLeft: 8, borderLeft: `2.5px solid ${p.color}` }}>
          <span style={{ color: "#94a3b8", flex: 1 }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: "#fff", fontFamily: "'Space Mono', monospace", fontSize: 11 }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
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
  { id: "servicios", icon: BarChart3, label: "Estadísticas" },
  { id: "predictivo", icon: TrendingUp, label: "Mod. Predictivo" },
  { id: "sentimiento", icon: Heart, label: "Mod. Sentimiento" },
  { id: "impacto", icon: GraduationCap, label: "Mod. Impacto" },
  { id: "datos", icon: Database, label: "Datos & Upload" },
  { id: "herramientas", icon: LayoutGrid, label: "Servicios" },
  { id: "configuracion", icon: Settings, label: "Configuración" },
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

// Build flat table rows for search
function buildTableRows(mesSvc, carreraSvc, tipoSvc, turnoSvc) {
  const rows = [];
  let id = 1;
  mesesFull.forEach(m => {
    const d = mesSvc.find(x => x.mes === m);
    if (!d) return;
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "Domicilio", valor: d.domicilio, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "En Sala", valor: d.sala, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Préstamos", servicio: "Interbibliotecario", valor: d.interbibliotecario, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Computadoras", valor: d.computadoras, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Internet WiFi", valor: d.internet, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Cómputo", servicio: "Impresiones", valor: d.impresiones, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Talleres", valor: d.talleres, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Capacitaciones", valor: d.capacitaciones, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Formación", servicio: "Asesorías", valor: d.asesorias, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Cubículos", valor: d.cubiculos, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Salas de Estudio", valor: d.salasEstudio, tipo: "—", turno: "—" });
    rows.push({ id: id++, periodo: m, dimension: "Espacios", servicio: "Coworking", valor: d.coworking, tipo: "—", turno: "—" });
  });
  carreraSvc.forEach(c => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Carrera", servicio: c.carrera, valor: c.total, tipo: "—", turno: "—" });
  });
  tipoSvc.forEach(u => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Tipo Usuario", servicio: u.tipo, valor: u.prestamos + u.computo + u.talleres + u.espacios, tipo: u.tipo, turno: "—" });
  });
  turnoSvc.forEach(tr => {
    rows.push({ id: id++, periodo: "Acum.", dimension: "Por Turno", servicio: tr.turno, valor: tr.prestamos + tr.computo + tr.talleres + tr.espacios, tipo: "—", turno: tr.turno });
  });
  return rows;
}

function calcTurno(inicio) {
  if (!inicio) return 'Vespertino';
  const h = new Date(inicio).getHours();
  if (h >= 7 && h < 14) return 'Matutino';
  if (h >= 14 && h < 20) return 'Vespertino';
  return 'Nocturno';
}

function buildSvcMesFromHistorial(historial) {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const now = new Date();
  return Array.from({ length: 9 }, (_, idx) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (8 - idx), 1);
    const m = d.getMonth(), y = d.getFullYear();
    const rows = historial.filter(h => { const f = new Date(h.fin); return f.getMonth() === m && f.getFullYear() === y; });
    return { mes: MESES[m], cubiculos: rows.filter(r => r.tipo === 'cubiculos').length, computadoras: rows.filter(r => r.tipo === 'computadoras').length };
  });
}

function buildSvcCarreraFromHistorial(historial) {
  const map = {};
  historial.forEach(h => {
    const c = h.carrera || 'Sin carrera';
    if (!map[c]) map[c] = { carrera: c, prestamos: 0, computadoras: 0, talleres: 0, espacios: 0, total: 0 };
    if (h.tipo === 'cubiculos') map[c].espacios++;
    else if (h.tipo === 'computadoras') map[c].computadoras++;
    map[c].total++;
  });
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
}

function buildSvcTurnoFromHistorial(historial) {
  const tipos = { Matutino: { cubi: 0, compu: 0 }, Vespertino: { cubi: 0, compu: 0 }, Nocturno: { cubi: 0, compu: 0 } };
  let total = 0;
  historial.forEach(h => {
    const t = h.turno || 'Vespertino';
    if (!tipos[t]) return;
    if (h.tipo === 'cubiculos') tipos[t].cubi++;
    else if (h.tipo === 'computadoras') tipos[t].compu++;
    total++;
  });
  return ['Matutino','Vespertino','Nocturno'].map(t => ({
    turno: t, prestamos: 0, computo: tipos[t].compu, talleres: 0, espacios: tipos[t].cubi,
    pct: total > 0 ? Math.round(((tipos[t].cubi + tipos[t].compu) / total) * 100) : 0,
  }));
}

function getCubiRemainingMs(cubi) {
  if (!cubi?.reserva?.inicio) return 0;
  const end = new Date(cubi.reserva.inicio).getTime() + cubi.reserva.duracion * 3_600_000;
  return Math.max(0, end - serverNow());
}

// ===== COMPUTADORAS INITIAL DATA =====
function createInitComputadoras() {
  return [
    { id:1,  nombre:"PC-01", zona:"Sala General",       sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:2,  nombre:"PC-02", zona:"Sala General",       sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:3,  nombre:"PC-03", zona:"Sala General",       sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:4,  nombre:"PC-04", zona:"Sala General",       sistema:"Ubuntu 22.04",estado:"libre", reserva:null },
    { id:5,  nombre:"PC-05", zona:"Sala General",       sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:6,  nombre:"PC-06", zona:"Sala General",       sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:7,  nombre:"PC-07", zona:"Sala Silencio",      sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:8,  nombre:"PC-08", zona:"Sala Silencio",      sistema:"Ubuntu 22.04",estado:"libre", reserva:null },
    { id:9,  nombre:"PC-09", zona:"Sala Silencio",      sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:10, nombre:"PC-10", zona:"Sala Silencio",      sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:11, nombre:"PC-11", zona:"Sala Investigación", sistema:"Ubuntu 22.04",estado:"libre", reserva:null },
    { id:12, nombre:"PC-12", zona:"Sala Investigación", sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:13, nombre:"PC-13", zona:"Sala Investigación", sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:14, nombre:"PC-14", zona:"Sala Investigación", sistema:"Windows 11",  estado:"libre", reserva:null },
    { id:15, nombre:"PC-15", zona:"Sala General",       sistema:"Ubuntu 22.04",estado:"libre", reserva:null },
  ];
}

// ===== CUBICULOS INITIAL DATA =====
function createInitCubiculos() {
  return [
    { id: 1,  nombre: "C-01", capacidad: 4, piso: 1, estado: "libre", reserva: null },
    { id: 2,  nombre: "C-02", capacidad: 4, piso: 1, estado: "libre", reserva: null },
    { id: 3,  nombre: "C-03", capacidad: 6, piso: 1, estado: "libre", reserva: null },
    { id: 4,  nombre: "C-04", capacidad: 4, piso: 1, estado: "libre", reserva: null },
    { id: 5,  nombre: "C-05", capacidad: 4, piso: 1, estado: "libre", reserva: null },
    { id: 6,  nombre: "C-06", capacidad: 8, piso: 1, estado: "libre", reserva: null },
    { id: 7,  nombre: "C-07", capacidad: 4, piso: 2, estado: "libre", reserva: null },
    { id: 8,  nombre: "C-08", capacidad: 4, piso: 2, estado: "libre", reserva: null },
    { id: 9,  nombre: "C-09", capacidad: 6, piso: 2, estado: "libre", reserva: null },
    { id: 10, nombre: "C-10", capacidad: 4, piso: 2, estado: "libre", reserva: null },
    { id: 11, nombre: "C-11", capacidad: 4, piso: 2, estado: "libre", reserva: null },
    { id: 12, nombre: "C-12", capacidad: 8, piso: 2, estado: "libre", reserva: null },
  ];
}

// ── LiveClock — componente aislado para no re-renderizar todo el dashboard ──
function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  return (
    <div style={{ textAlign: "right", lineHeight: 1.3 }}>
      <div style={{ fontSize: 13, fontWeight: 800, fontFamily: "'Space Mono', monospace", color: "#fff", letterSpacing: .5 }}>{time}</div>
      <div style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", textTransform: "capitalize" }}>{date}</div>
    </div>
  );
}

// ===== MAIN APP =====
export default function BiblioAnalytics360() {
  const [dark, setDark] = useState(false);
  const [accentPreset, setAccentPreset] = useState("teal");
  const [userProfile, setUserProfile] = useState({ name: "Daniel B.", role: "Administrador", institution: "UACJ" });
  const [profileDraft, setProfileDraft] = useState(null);
  const [alertThresholds, setAlertThresholds] = useState({ prestamos: 900, satisfaccion: 65, calidad: 80 });
  const [alertToggles, setAlertToggles] = useState({ prestamos: true, sentimiento: true, calidad: true, uploads: true });
  const [pinRequired,  setPinRequired]  = useState(true);
  useEffect(() => { dbLoadAppConfig().then(cfg => setPinRequired(cfg.pinRequired)); }, []);
  useEffect(() => subscribeAppConfig(cfg => { if (typeof cfg.pinRequired === 'boolean') setPinRequired(cfg.pinRequired); }), []);
  const [syncingSource,  setSyncingSource]  = useState(null);
  const [userSearch,     setUserSearch]     = useState("");
  const [userEditId,     setUserEditId]     = useState(null);
  const [userEditDraft,  setUserEditDraft]  = useState({});
  const [userDeleteId,   setUserDeleteId]   = useState(null);
  const [testPushState, setTestPushState] = useState("idle"); // "idle"|"sending"|"ok"|"error"
  const [testPushMsg, setTestPushMsg] = useState("");
  const [alumnos, setAlumnos] = useState([]);
  // Herramientas — Cubículos
  const [cubiculos, setCubiculos] = useState(createInitCubiculos);
  const [cubiSelectedId, setCubiSelectedId] = useState(null);
  // Cubicle service config (min/max personas)
  const [cubiConfig, setCubiConfig] = useState(() => loadCubiConfig());
  const [cubiConfigDraft, setCubiConfigDraft] = useState(null);
  useEffect(() => { saveCubiConfig(cubiConfig); }, [cubiConfig]);
  const [cubiNuevoForm,  setCubiNuevoForm]  = useState({ nombre: "", capacidad: 4, piso: 1 });
  const [cubiEditMode,   setCubiEditMode]   = useState(false);
  const [cubiEditDraft,  setCubiEditDraft]  = useState(null);
  const [cubiClock, setCubiClock] = useState(new Date(serverNow()));
  useEffect(() => { const t = setInterval(() => setCubiClock(new Date(serverNow())), 1000); return () => clearInterval(t); }, []);

  // Herramientas — sub-nav
  const [herrTool, setHerrTool] = useState("cubiculos");

  // Herramientas — Computadoras
  const [computadoras, setComputadoras] = useState(createInitComputadoras);
  const [compuSelectedId, setCompuSelectedId] = useState(null);
  const [compuZonaFilter, setCompuZonaFilter] = useState("Todas");
  const [compuAsignForm, setCompuAsignForm]   = useState({ nombre: "", matricula: "", carrera: cubiCarreras[0], duracion: 1 });
  const [compuNuevoForm, setCompuNuevoForm]   = useState({ nombre: "", zona: "Sala General", sistema: "Windows 11" });
  const [compuHistorial, setCompuHistorial]   = useState([]);

  // Cargar cubículos y computadoras desde Supabase al montar; suscribir actualizaciones en tiempo real
  useEffect(() => {
    dbLoadCubiculos().then(data => {
      if (data && data.length > 0) setCubiculos(data);
      else dbSeedCubiculos(createInitCubiculos());
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
        setNotifications(prev => [{ id: Date.now(), text: "Reserva actualizada desde otra terminal", type: "info", time: "Ahora" }, ...prev]);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    dbLoadComputadoras().then(data => {
      if (data && data.length > 0) setComputadoras(data);
      else dbSeedComputadoras(createInitComputadoras());
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

  // Recargar datos de Supabase cuando el tab vuelve al foco (Realtime se congela en background)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      dbLoadCubiculos().then(data => { if (data && data.length > 0) setCubiculos(data); });
      dbLoadComputadoras().then(data => { if (data && data.length > 0) setComputadoras(data); });
      dbLoadAlumnos().then(data => { if (data) setAlumnos(data); });
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  // Heartbeat: recarga completa cada 30s para mantener datos frescos si Realtime se duerme
  useEffect(() => {
    const hb = setInterval(() => {
      dbLoadCubiculos().then(data => { if (data && data.length > 0) setCubiculos(data); });
      dbLoadComputadoras().then(data => { if (data && data.length > 0) setComputadoras(data); });
      dbLoadHistorialReservas().then(d => { if (d) setHistorialReservas(d); });
    }, 30_000);
    return () => clearInterval(hb);
  }, []);

  // Auto-liberar cubículos y computadoras vencidas (cada 30 s)
  useEffect(() => {
    const release = () => {
      setCubiculos(prev => {
        let changed = false;
        const next = prev.map(c => {
          // Auto-liberar pendingCheckin vencido (> 5 min sin check-in)
          if (c.estado === "reservado" && c.reserva?.pendingCheckin && c.reserva?.reservedAt) {
            if (serverNow() - new Date(c.reserva.reservedAt).getTime() > 5 * 60 * 1000) {
              changed = true;
              const freed = { ...c, estado: "libre", reserva: null };
              dbSaveCubiculo(freed);
              return freed;
            }
            return c;
          }
          if (c.estado !== "ocupado" || !c.reserva) return c;
          if (getCubiRemainingMs(c) > 0) return c;
          changed = true;
          const hh = new Date(c.reserva.inicio).getHours();
          const turno = hh >= 7 && hh < 14 ? "Matutino" : hh >= 14 && hh < 20 ? "Vespertino" : "Nocturno";
          dbSaveHistorialReserva({
            cubicule: c.nombre, tipo: "cubiculos",
            nombre: c.reserva.nombre, matricula: c.reserva.matricula, carrera: c.reserva.carrera,
            duracion: c.reserva.duracion, personas: c.reserva.personas || null, piso: c.piso,
            inicio: c.reserva.inicio instanceof Date ? c.reserva.inicio.toISOString() : c.reserva.inicio,
            fin: new Date(serverNow()).toISOString(), turno,
          });
          const freed = { ...c, estado: "libre", reserva: null };
          dbSaveCubiculo(freed);
          return freed;
        });
        return changed ? next : prev;
      });
      setComputadoras(prev => {
        let changed = false;
        const next = prev.map(c => {
          if (c.estado !== "ocupado" || !c.reserva) return c;
          const end = new Date(c.reserva.inicio).getTime() + c.reserva.duracion * 3_600_000;
          if (Math.max(0, end - serverNow()) > 0) return c;
          changed = true;
          const hh = new Date(c.reserva.inicio).getHours();
          const turno = hh >= 7 && hh < 14 ? "Matutino" : hh >= 14 && hh < 20 ? "Vespertino" : "Nocturno";
          dbSaveHistorialReserva({
            cubicule: c.nombre, tipo: "computadoras",
            nombre: c.reserva.nombre, matricula: c.reserva.matricula, carrera: c.reserva.carrera,
            duracion: c.reserva.duracion, personas: null, piso: null,
            inicio: c.reserva.inicio instanceof Date ? c.reserva.inicio.toISOString() : c.reserva.inicio,
            fin: new Date(serverNow()).toISOString(), turno,
          });
          const freed = { ...c, estado: "libre", reserva: null };
          dbSaveComputadora(freed);
          return freed;
        });
        return changed ? next : prev;
      });
    };
    release();
    const t = setInterval(release, 5_000);
    return () => clearInterval(t);
  }, []);

  // Config sync via localStorage (local only, no need for DB)
  useEffect(() => {
    const handler = (e) => {
      if (e.key === CUBI_CONFIG_KEY && e.newValue) {
        try { setCubiConfig(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  // Alumnos — cargar y suscribir cambios en tiempo real
  useEffect(() => {
    dbLoadAlumnos().then(data => { if (data) setAlumnos(data); });
    const unsub = subscribeAlumnos((row, eventType) => {
      setAlumnos(prev => {
        if (eventType === 'DELETE') return prev.filter(a => a.matricula !== row.matricula);
        const idx = prev.findIndex(a => a.matricula === row.matricula);
        if (idx >= 0) { const a = [...prev]; a[idx] = row; return a; }
        return [...prev, row];
      });
    });
    return unsub;
  }, []);
  const [cubiReservaForm, setCubiReservaForm] = useState({ nombre: "", matricula: "", carrera: cubiCarreras[0], duracion: 2 });
  const [cubiPisoFilter, setCubiPisoFilter] = useState(0);
  const [cubiHistorial, setCubiHistorial] = useState([]);
  // Export state
  const [showExport, setShowExport] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportPeriodos, setExportPeriodos] = useState(["2024-2"]);
  const [exportCampus, setExportCampus] = useState("todos");
  const [exportServicios, setExportServicios] = useState(["prestamos","computo","formacion","espacios"]);
  const [exportSecciones, setExportSecciones] = useState(["overview","servicios","predictivo","sentimiento","impacto"]);
  const [exportFormat, setExportFormat] = useState("pdf");
  const [isExportRendering, setIsExportRendering] = useState(false);
  const exportChartRefs = { overview: useRef(null), servicios: useRef(null), predictivo: useRef(null), sentimiento: useRef(null), impacto: useRef(null) };
  const [pieActiveIdx, setPieActiveIdx] = useState(null);
  const [svcPieActiveIdx, setSvcPieActiveIdx] = useState(null);
  const accentPresets = {
    teal:   { primary: "#0d9488", light: "#14b8a6", label: "Verde Azulado" },
    blue:   { primary: "#2563eb", light: "#3b82f6", label: "Azul" },
    purple: { primary: "#7c3aed", light: "#8b5cf6", label: "Morado" },
    rose:   { primary: "#e11d48", light: "#f43f5e", label: "Rosa" },
    amber:  { primary: "#d97706", light: "#f59e0b", label: "Ámbar" },
  };
  const baseTheme = dark ? themes.dark : themes.light;
  const accent = accentPresets[accentPreset];
  const t = { ...baseTheme, teal: accent.primary, tealLight: accent.light };
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

  const seed = campus === "todos" ? 0 : campus === "central" ? 1 : campus === "norte" ? 2 : 3;
  const circulacion = useMemo(() => genCirculacion(seed, campus, periodo), [seed, campus, periodo]);
  const sentTendencia = useMemo(() => genSentimiento(seed), [seed]);

  // Historial de reservas reales
  const [historialReservas, setHistorialReservas] = useState([]);
  useEffect(() => { dbLoadHistorialReservas().then(d => setHistorialReservas(d)); }, []);
  useEffect(() => {
    const unsub = subscribeHistorialReservas(() => {
      dbLoadHistorialReservas().then(d => setHistorialReservas(d));
    });
    return unsub;
  }, []);

  // Servicios state
  const [svcView, setSvcView] = useState("realtime"); // kept for export compat
  const [svcCategory, setSvcCategory] = useState("todos");
  const [svcSearch, setSvcSearch] = useState("");
  const [svcPage, setSvcPage] = useState(0);
  const SVC_PAGE_SIZE = 15;
  const [svcService,       setSvcService]       = useState("cubiculos");
  const [svcDateFrom,      setSvcDateFrom]      = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0,10); });
  const [svcDateTo,        setSvcDateTo]        = useState(() => new Date().toISOString().slice(0,10));
  const [svcCarreraFilter, setSvcCarreraFilter] = useState("");
  const [svcTurnoFilter,   setSvcTurnoFilter]   = useState("");
  const [svcDurFilter,     setSvcDurFilter]     = useState(null);

  // Servicios data — real when historial exists, mock as fallback
  const svcMes = useMemo(() => {
    const mock = genServiciosMes(seed);
    if (!historialReservas.length) return mock;
    const real = buildSvcMesFromHistorial(historialReservas);
    return mock.map((m, i) => ({ ...m, cubiculos: real[i]?.cubiculos ?? 0, computadoras: real[i]?.computadoras ?? 0 }));
  }, [seed, historialReservas]);
  const svcCarrera = useMemo(() => {
    if (!historialReservas.length) return genServiciosCarrera(seed);
    return buildSvcCarreraFromHistorial(historialReservas);
  }, [seed, historialReservas]);
  const svcTipoUsr = useMemo(() => genServiciosTipoUsuario(seed), [seed]);
  const svcTurno = useMemo(() => {
    if (!historialReservas.length) return genServiciosTurno(seed);
    return buildSvcTurnoFromHistorial(historialReservas);
  }, [seed, historialReservas]);
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

  const svcTotalUsos = useMemo(() => {
    const d = svcMes[svcMes.length - 1];
    if (!d) return 0;
    return d.domicilio + d.sala + d.interbibliotecario + d.computadoras + d.internet + d.impresiones + d.talleres + d.capacitaciones + d.asesorias + d.cubiculos + d.salasEstudio + d.coworking;
  }, [svcMes]);

  const totalPrestamos = useMemo(() => {
    const s = circulacion.reduce((a, c) => a + (c.prestamos || 0), 0);
    return s.toLocaleString();
  }, [circulacion]);

  const lastPrestamos = circulacion.filter(c => c.prestamos).slice(-1)[0]?.prestamos || 0;
  const circAvg = useMemo(() => {
    const vals = circulacion.filter(c => c.prestamos).map(c => c.prestamos);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
  }, [circulacion]);

  // Handle comment submission
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

  // Export CSV
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

  const handleExport = useCallback(async () => {
    setExportLoading(true);
    try {
      if (nav === "servicios") {
        const expFromDate = new Date(svcDateFrom);
        const expToDate   = new Date(svcDateTo + 'T23:59:59');
        const svcRecs = historialReservas
          .filter(h => h.tipo === svcService)
          .filter(h => { const d = new Date(h.fin||h.inicio); return d >= expFromDate && d <= expToDate; })
          .filter(h => !svcCarreraFilter || h.carrera === svcCarreraFilter)
          .filter(h => !svcTurnoFilter   || h.turno   === svcTurnoFilter)
          .filter(h => svcDurFilter == null || h.duracion === svcDurFilter);
        const serviceName = svcService === "cubiculos" ? "Cubículos" : "Computadoras";
        const pLabel = `${svcDateFrom} – ${svcDateTo}`;
        if (exportFormat === "excel") {
          generateServiceExcel(svcRecs, svcService, pLabel, { institution: "UACJ" });
          setShowExport(false);
          setNotifications(prev => [{ id: Date.now(), text: `Excel de ${serviceName} exportado`, type: "success", time: "Ahora" }, ...prev]);
        } else {
          setIsExportRendering(true);
          await new Promise(r => setTimeout(r, 900));
          let chartImage = null;
          const ref = exportChartRefs.servicios?.current;
          if (ref) {
            try {
              const canvas = await html2canvas(ref, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
              chartImage = canvas.toDataURL("image/png");
            } catch (_) {}
          }
          setIsExportRendering(false);
          await generateServicePDF(chartImage, svcRecs, svcService, pLabel, { institution: "UACJ" });
          setShowExport(false);
          setNotifications(prev => [{ id: Date.now(), text: `PDF de ${serviceName} generado`, type: "success", time: "Ahora" }, ...prev]);
        }
      } else {
        const exportData = { circulacion, svcMes, svcCarrera, svcTipoUsr, svcTurno, comments, impactoBase, retencionBase, radarBase, colAreas };
        const exportFilters = { campus: exportCampus, periodos: exportPeriodos, servicios: exportServicios, secciones: exportSecciones };
        if (exportFormat === "excel") {
          generateExcel(exportData, exportFilters);
          setShowExport(false);
          setNotifications(prev => [{ id: Date.now(), text: "Excel exportado correctamente", type: "success", time: "Ahora" }, ...prev]);
        } else {
          setIsExportRendering(true);
          await new Promise(r => setTimeout(r, 900));
          const images = {};
          for (const sec of exportSecciones) {
            const ref = exportChartRefs[sec]?.current;
            if (ref) {
              try {
                const canvas = await html2canvas(ref, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
                images[sec] = canvas.toDataURL("image/png");
              } catch (_) {}
            }
          }
          setIsExportRendering(false);
          await generatePDF(images, exportData, exportFilters, { institution: "UACJ", predModel, predHorizon });
          setShowExport(false);
          setNotifications(prev => [{ id: Date.now(), text: "PDF generado y descargado correctamente", type: "success", time: "Ahora" }, ...prev]);
        }
      }
    } catch (err) {
      console.error("Export error:", err);
      setNotifications(prev => [{ id: Date.now(), text: "Error al exportar. Intenta de nuevo.", type: "warn", time: "Ahora" }, ...prev]);
    } finally {
      setExportLoading(false);
      setIsExportRendering(false);
    }
  }, [nav, svcService, svcDateFrom, svcDateTo, svcCarreraFilter, svcTurnoFilter, svcDurFilter, historialReservas, exportFormat, exportCampus, exportPeriodos, exportServicios, exportSecciones, circulacion, svcMes, svcCarrera, svcTipoUsr, svcTurno, comments, predModel, predHorizon]);

  const posCount = comments.filter(c => c.sentimiento === "positivo").length;
  const negCount = comments.filter(c => c.sentimiento === "negativo").length;
  const satPct = comments.length ? Math.round((posCount / comments.length) * 100) : 0;

  // Cubicle computed values
  const cubiLibres    = cubiculos.filter(c => c.estado === "libre").length;
  const cubiOcupados  = cubiculos.filter(c => c.estado === "ocupado").length;
  const cubiReservados = cubiculos.filter(c => c.estado === "reservado").length;
  const cubiTasaUso   = cubiculos.length ? Math.round(((cubiOcupados + cubiReservados) / cubiculos.length) * 100) : 0;
  const cubiSelected  = cubiculos.find(c => c.id === cubiSelectedId) || null;
  const cubiFiltered  = cubiPisoFilter === 0 ? cubiculos : cubiculos.filter(c => c.piso === cubiPisoFilter);
  const cubiActivas   = cubiculos.filter(c => c.reserva !== null);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: t.bg, fontFamily: "'DM Sans', sans-serif", color: t.text }}>

      {/* SIDEBAR */}
      <aside style={{ width: 240, flexShrink: 0, background: t.sidebarBg, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100%", zIndex: 50, boxShadow: "4px 0 24px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 12, background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 4px 16px ${t.teal}50`, flexShrink: 0 }}>
            <BookOpen size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff", letterSpacing: -.2 }}>BiblioAnalytics</div>
            <div style={{ fontSize: 10, fontWeight: 600, color: t.teal, letterSpacing: .5 }}>360 · UACJ</div>
          </div>
        </div>

        <div style={{ padding: "16px 10px", flex: 1, overflowY: "auto" }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, padding: "0 10px", marginBottom: 10, color: t.sidebarDim }}>Analítica</div>
          {navMain.slice(0, 6).map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: "0 10px 10px 0", border: "none", marginBottom: 3, cursor: "pointer",
                background: nav === item.id ? `linear-gradient(90deg, ${t.blue}35, ${t.teal}12)` : "transparent",
                boxShadow: nav === item.id ? `inset 3px 0 0 ${t.teal}` : "none",
                color: nav === item.id ? "#fff" : t.sidebarDim,
                fontSize: 12, fontWeight: nav === item.id ? 700 : 400, textAlign: "left", transition: "all 0.15s" }}>
              <item.icon size={15} />
              <span>{item.label}</span>
              {nav === item.id && <ChevronRight size={11} style={{ marginLeft: "auto", opacity: 0.6 }} />}
            </button>
          ))}
          <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "10px 10px" }} />
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, padding: "0 10px", marginBottom: 10, color: t.sidebarDim }}>Sistema</div>
          {navMain.slice(6).map(item => (
            <button key={item.id} onClick={() => setNav(item.id)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px", borderRadius: "0 10px 10px 0", border: "none", marginBottom: 3, cursor: "pointer",
                background: nav === item.id ? `linear-gradient(90deg, ${t.blue}35, ${t.teal}12)` : "transparent",
                boxShadow: nav === item.id ? `inset 3px 0 0 ${t.teal}` : "none",
                color: nav === item.id ? "#fff" : t.sidebarDim,
                fontSize: 12, fontWeight: nav === item.id ? 700 : 400, textAlign: "left", transition: "all 0.15s" }}>
              <item.icon size={15} />
              <span>{item.label}</span>
              {nav === item.id && <ChevronRight size={11} style={{ marginLeft: "auto", opacity: 0.6 }} />}
            </button>
          ))}
        </div>

        <div style={{ padding: "14px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 10px", borderRadius: 12, background: "rgba(255,255,255,0.05)", marginBottom: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: `linear-gradient(135deg, ${t.blue}, ${t.purple})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0, boxShadow: `0 3px 10px ${t.blue}50` }}>
              {userProfile.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userProfile.name}</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 1 }}>{userProfile.institution}</div>
            </div>
          </div>
          <button onClick={() => setDark(!dark)}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.45)", fontSize: 10, cursor: "pointer", transition: "all 0.15s" }}>
            {dark ? <Sun size={12} /> : <Moon size={12} />}
            {dark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, marginLeft: 240 }}>
        {/* TOP BAR */}
        <header style={{ position: "sticky", top: 0, zIndex: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", background: `${t.bg}f0`, backdropFilter: "blur(16px)", borderBottom: `1px solid ${t.cardBorder}` }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: t.text, letterSpacing: -.3 }}>
              {nav === "overview" && "Vista General"}{nav === "servicios" && "Estadísticas de Servicios"}
              {nav === "predictivo" && "Módulo Predictivo"}
              {nav === "sentimiento" && "Módulo de Sentimiento"}{nav === "impacto" && "Módulo de Impacto"}
              {nav === "datos" && "Datos & Upload"}
              {nav === "herramientas" && "Servicios"}
              {nav === "configuracion" && "Configuración"}
            </h1>
            <p style={{ fontSize: 10, color: t.textDim, margin: 0, letterSpacing: .3 }}>Biblioteca Central UACJ · Prototipo Funcional</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 10, background: t.card, border: `1px solid ${t.cardBorder}`, fontSize: 11, boxShadow: t.shadow }}>
              <Search size={13} color={t.textDim} />
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Buscar métricas..."
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: t.text, width: 130 }} />
              {searchQ && <X size={12} color={t.textDim} style={{ cursor: "pointer" }} onClick={() => setSearchQ("")} />}
            </div>
            <div style={{ height: 28, width: 1, background: t.cardBorder }} />
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowNotif(!showNotif)}
                style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.card, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative", boxShadow: t.shadow }}>
                <Bell size={15} color={t.text} />
                {notifications.length > 0 && <div style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: t.rose, border: `2px solid ${t.bg}` }} />}
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
            <button onClick={() => setShowExport(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 14px ${t.teal}40` }}>
              <Download size={13} /> Exportar
            </button>
            <div style={{ height: 28, width: 1, background: t.cardBorder }} />
            <div style={{ padding: "4px 10px", borderRadius: 10, background: t.card, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow }}>
              <LiveClock />
            </div>
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
          {nav === "overview" && (() => {
            const nowD  = new Date();
            const d7ago  = new Date(nowD.getTime() -  7 * 86400000);
            const d14ago = new Date(nowD.getTime() - 14 * 86400000);
            const d30ago = new Date(nowD.getTime() - 30 * 86400000);
            const MESES  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const DIAS   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

            const cubiH  = historialReservas.filter(h => h.tipo === 'cubiculos');
            const compuH = historialReservas.filter(h => h.tipo === 'computadoras');
            const last7  = historialReservas.filter(h => new Date(h.fin||h.inicio) >= d7ago);
            const prev7  = historialReservas.filter(h => { const d = new Date(h.fin||h.inicio); return d >= d14ago && d < d7ago; });

            const cubiLibresN  = cubiculos.filter(c => c.estado === 'libre').length;
            const cubiOcupN    = cubiculos.filter(c => c.estado === 'ocupado').length;
            const cubiResvN    = cubiculos.filter(c => c.estado === 'reservado').length;
            const compuLibresN = computadoras.filter(c => c.estado === 'libre').length;
            const compuOcupN   = computadoras.filter(c => c.estado === 'ocupado').length;
            const totalDisp    = cubiculos.length + computadoras.length;
            const totalOcup    = cubiOcupN + compuOcupN;
            const tasaActual   = totalDisp > 0 ? Math.round((totalOcup / totalDisp) * 100) : 0;

            const totalReservas = historialReservas.length;
            const uniqueAlmn    = new Set(historialReservas.map(h => h.matricula).filter(Boolean)).size;
            const tend7Pct      = prev7.length > 0 ? Math.round(((last7.length - prev7.length) / prev7.length) * 100) : (last7.length > 0 ? 100 : 0);
            const tend7Color    = tend7Pct >= 0 ? t.green : t.rose;
            const avgDur        = historialReservas.length > 0
              ? (historialReservas.reduce((a, h) => a + (h.duracion || 0), 0) / historialReservas.length).toFixed(1)
              : '0';

            const hourCounts = Array.from({length:24}, (_, h) =>
              historialReservas.filter(r => new Date(r.inicio||r.fin).getHours() === h).length);
            const maxH      = Math.max(...hourCounts, 0);
            const peakHour  = historialReservas.length > 0 ? `${String(hourCounts.indexOf(maxH)).padStart(2,'0')}:00` : '—';

            const carreraMap  = {};
            historialReservas.forEach(h => { const c = h.carrera||'Otra'; carreraMap[c] = (carreraMap[c]||0)+1; });
            const topCarreras = Object.entries(carreraMap).sort((a,b)=>b[1]-a[1]).slice(0,8)
              .map(([carrera, total]) => ({ carrera: carrera.replace('Ing. ','Ing.'), total }));
            const topCarreraName = topCarreras[0]?.carrera || '—';

            const trend30 = Array.from({length:30}, (_, i) => {
              const d  = new Date(d30ago.getTime() + i * 86400000);
              const ds = d.toDateString();
              return {
                label:       i % 5 === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '',
                cubiculos:   cubiH.filter(h  => new Date(h.fin||h.inicio).toDateString() === ds).length,
                computadoras: compuH.filter(h => new Date(h.fin||h.inicio).toDateString() === ds).length,
              };
            });

            const turnoData = ['Matutino','Vespertino','Nocturno'].map(turno => ({
              turno: turno.slice(0,3), reservas: historialReservas.filter(h => h.turno === turno).length,
            }));
            const horaData  = Array.from({length:24}, (_, h) => ({
              hora: h % 4 === 0 ? `${String(h).padStart(2,'0')}h` : '', reservas: hourCounts[h],
            }));
            const diasData  = DIAS.map((d, i) => ({
              dia: d, reservas: historialReservas.filter(h => new Date(h.fin||h.inicio).getDay() === i).length,
            }));
            const durData   = [1,2,3].map(d => ({
              dur: `${d}h`, reservas: historialReservas.filter(h => h.duracion === d).length,
            }));
            const splitData = [
              { name: 'Cubículos',    value: cubiH.length  },
              { name: 'Computadoras', value: compuH.length },
            ];

            const alumnoMap  = {};
            historialReservas.forEach(h => {
              if (!h.matricula) return;
              if (!alumnoMap[h.matricula]) alumnoMap[h.matricula] = { nombre: h.nombre||h.matricula, carrera: h.carrera||'—', count: 0 };
              alumnoMap[h.matricula].count++;
            });
            const topAlumnos = Object.values(alumnoMap).sort((a,b) => b.count - a.count).slice(0,5);
            const recentRecs = [...historialReservas]
              .sort((a,b) => new Date(b.fin||b.inicio) - new Date(a.fin||a.inicio))
              .slice(0, 8);

            // ── Retención
            const alumnoUsage    = Object.values(alumnoMap);
            const nuevosUsers    = alumnoUsage.filter(u => u.count === 1).length;
            const recurUsers     = alumnoUsage.filter(u => u.count >= 2 && u.count < 5).length;
            const frecuUsers     = alumnoUsage.filter(u => u.count >= 5).length;
            const totalUniqU     = nuevosUsers + recurUsers + frecuUsers;
            const retData = [
              { name:'Nuevos (1 reserva)',    value:nuevosUsers, color:t.blue   },
              { name:'Recurrentes (2–4)',     value:recurUsers,  color:t.teal   },
              { name:'Frecuentes (5+)',       value:frecuUsers,  color:t.purple },
            ];

            // ── Nuevos usuarios por semana (últimas 8 semanas)
            const sortedH = [...historialReservas].sort((a,b) => new Date(a.inicio||a.fin) - new Date(b.inicio||b.fin));
            const firstSeen = {};
            sortedH.forEach(h => { if (h.matricula && !firstSeen[h.matricula]) firstSeen[h.matricula] = new Date(h.inicio||h.fin); });
            const weeklyNew = Array.from({length:8}, (_, i) => {
              const wEnd   = new Date(nowD.getTime() - (7-i-1)*7*86400000);
              const wStart = new Date(wEnd.getTime() - 7*86400000);
              return { semana:`S-${7-i}`, nuevos: Object.values(firstSeen).filter(d => d>=wStart && d<wEnd).length };
            });

            // ── Heatmap turno × día de semana
            const TURNOS_F = ['Matutino','Vespertino','Nocturno'];
            const heatData = DIAS.map((dia, di) => {
              const row = { dia };
              TURNOS_F.forEach(t2 => { row[t2] = historialReservas.filter(h => new Date(h.fin||h.inicio).getDay()===di && h.turno===t2).length; });
              return row;
            });
            const heatMax = Math.max(...heatData.flatMap(r => TURNOS_F.map(t2 => r[t2])), 1);

            // ── Carrera × Servicio
            const crossData = topCarreras.slice(0,6).map(({carrera}) => ({
              carrera: carrera.length > 14 ? carrera.slice(0,14)+'…' : carrera,
              cubiculos:    cubiH.filter(h  => h.carrera === carrera).length,
              computadoras: compuH.filter(h => h.carrera === carrera).length,
            }));

            // ── Rotación por espacio
            const cubiRot  = cubiculos.map(c => ({
              nombre:c.nombre, piso:c.piso,
              total: cubiH.filter(h => h.cubicule===c.nombre || h.cubicule===c.id).length,
            })).sort((a,b)=>b.total-a.total);
            const compuRot = computadoras.map(c => ({
              nombre:c.nombre, zona:c.zona,
              total: compuH.filter(h => h.pc===c.nombre || h.pc===c.id).length,
            })).sort((a,b)=>b.total-a.total);
            const maxRotC  = Math.max(...cubiRot.map(c=>c.total),  1);
            const maxRotP  = Math.max(...compuRot.map(c=>c.total), 1);

            // ── RFM Segmentation
            const rfmData = Object.entries(alumnoMap).map(([exp,{nombre,carrera,count}]) => {
              const recs    = historialReservas.filter(h => h.matricula===exp);
              const lastD   = new Date(Math.max(...recs.map(h=>new Date(h.fin||h.inicio))));
              const days    = Math.floor((nowD-lastD)/86400000);
              const segment = (days<=30&&count>=5)?'Frecuente': days<=30?'Activo': days<=60?'En riesgo':'Inactivo';
              return { exp, nombre, carrera, count, days, segment };
            });
            const segColors = { Frecuente:t.teal, Activo:t.green, 'En riesgo':t.amber, Inactivo:t.rose };
            const segCounts = ['Frecuente','Activo','En riesgo','Inactivo'].map(s=>({
              s, count:rfmData.filter(u=>u.segment===s).length, color:segColors[s],
            }));

            // ── Score de salud (0–100)
            const s1h = Math.min(35, tasaActual<=60 ? (tasaActual/60)*35 : Math.max(0,35-((tasaActual-60)/40)*35));
            const s2h = ((Math.min(50,Math.max(-50,tend7Pct))+50)/100)*25;
            const s3h = totalUniqU>0 ? (((recurUsers+frecuUsers)/totalUniqU)*25) : 12.5;
            const tSum = turnoData.reduce((a,d)=>a+d.reservas,0);
            const tBal = tSum>0 ? Math.max(0,1-(Math.max(...turnoData.map(d=>d.reservas))/tSum-1/3)*2) : 0.5;
            const s4h = tBal*15;
            const healthScore = Math.round(s1h+s2h+s3h+s4h);
            const healthLabel = healthScore>=75?'Óptimo':healthScore>=50?'Normal':healthScore>=30?'Atención':'Crítico';
            const healthColor = healthScore>=75?t.green:healthScore>=50?t.teal:healthScore>=30?t.amber:t.rose;

            // ── Alertas automáticas
            const alerts = [];
            if (tasaActual>=80)       alerts.push({type:'warn', msg:`Alta demanda: ${tasaActual}% de capacidad ocupada`});
            if (tend7Pct<=-20)        alerts.push({type:'warn', msg:`Caída de uso: ${tend7Pct}% vs semana anterior`});
            if (last7.length===0&&historialReservas.length>0) alerts.push({type:'warn', msg:'Sin reservas en los últimos 7 días'});
            const enRiesgo = rfmData.filter(u=>u.segment==='En riesgo').length;
            if (enRiesgo>0)           alerts.push({type:'warn', msg:`${enRiesgo} alumno${enRiesgo>1?'s':''} en riesgo de abandono (+60d sin actividad)`});
            if (tend7Pct>=20)         alerts.push({type:'ok',   msg:`Crecimiento saludable: +${tend7Pct}% esta semana`});
            if (frecuUsers>0)         alerts.push({type:'ok',   msg:`${frecuUsers} alumno${frecuUsers>1?'s':''} frecuentes (5+ reservas)`});
            if (tasaActual===0&&totalDisp>0) alerts.push({type:'info', msg:'Todos los espacios disponibles ahora'});
            if (alerts.length===0)    alerts.push({type:'ok',   msg:'Todos los indicadores en rango normal'});

            const CH         = 180;
            const PC         = [t.teal, t.blue, t.purple, t.amber, t.rose, '#059669'];
            const stColor    = e => e==='libre'?t.green:e==='ocupado'?t.rose:t.amber;
            const cc         = (title, sub, children, sx={}) => (
              <div style={{background:t.card,borderRadius:16,padding:22,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,...sx}}>
                <div style={{paddingBottom:11,marginBottom:14,borderBottom:`1px solid ${t.cardBorder}`}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1}}>{title}</div>
                  <div style={{fontSize:10,color:t.textDim,marginTop:3}}>{sub}</div>
                </div>
                {children}
              </div>
            );

            return (
              <div style={{padding:'24px 28px'}}>
                {/* Hero KPIs */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:14}}>
                  {[
                    {label:'Total reservas',   value:totalReservas.toLocaleString(),           sub:'historial completo',                 color:t.teal,   Ic:Activity},
                    {label:'Alumnos únicos',   value:uniqueAlmn.toLocaleString(),               sub:`de ${alumnos.length} registrados`,    color:t.blue,   Ic:Users},
                    {label:'Ocupación actual', value:`${tasaActual}%`,                          sub:`${totalOcup} / ${totalDisp} espacios`, color:t.purple, Ic:Target},
                    {label:'Duración prom.',   value:`${avgDur}h`,                              sub:'por sesión · todos los servicios',   color:t.amber,  Ic:Clock},
                  ].map(({label,value,sub,color,Ic})=>(
                    <div key={label} style={{background:t.card,borderRadius:14,padding:'18px 20px',border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,borderTop:`3px solid ${color}`}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <div style={{width:32,height:32,borderRadius:10,background:`${color}22`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 12px ${color}30`}}>
                          <Ic size={14} color={color}/>
                        </div>
                        <span style={{fontSize:9,color:t.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:1}}>{label}</span>
                      </div>
                      <div style={{fontSize:26,fontWeight:800,color:t.text,fontFamily:"'Space Mono',monospace",lineHeight:1}}>{value}</div>
                      <div style={{fontSize:9,color:t.textDim,marginTop:5}}>{sub}</div>
                    </div>
                  ))}
                </div>

                {/* Mini KPIs */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:10,marginBottom:16}}>
                  {[
                    {label:'Cubículos libres',     value:`${cubiLibresN} / ${cubiculos.length}`,     sub:'disponibles ahora',         color:t.green,  Ic:Layers},
                    {label:'Computadoras libres',  value:`${compuLibresN} / ${computadoras.length}`, sub:'disponibles ahora',         color:t.teal,   Ic:Monitor},
                    {label:'Hora pico',            value:peakHour,                                   sub:'mayor demanda histórica',   color:t.purple, Ic:Zap},
                    {label:'Tendencia 7 días',     value:last7.length===0&&prev7.length===0?'—':`${tend7Pct>0?'+':''}${tend7Pct}%`, sub:'vs semana anterior', color:tend7Color, Ic:TrendingUp},
                    {label:'Carrera top',          value:topCarreraName.length>13?topCarreraName.slice(0,13)+'…':topCarreraName, sub:'más reservas históricas', color:t.amber, Ic:Award},
                  ].map(({label,value,sub,color,Ic})=>(
                    <div key={label} style={{background:t.card,borderRadius:12,padding:'12px 16px',border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,display:'flex',alignItems:'center',gap:12}}>
                      <div style={{width:34,height:34,borderRadius:10,background:`${color}22`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:`0 4px 12px ${color}30`}}>
                        <Ic size={15} color={color}/>
                      </div>
                      <div>
                        <div style={{fontSize:9,color:t.textDim,textTransform:'uppercase',letterSpacing:.8,fontWeight:600}}>{label}</div>
                        <div style={{fontSize:15,fontWeight:800,fontFamily:"'Space Mono',monospace",color:t.text,lineHeight:1.2,marginTop:2}}>{value}</div>
                        <div style={{fontSize:9,color:t.textDim,marginTop:2}}>{sub}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Estado en tiempo real */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Estado actual — Cubículos', `${cubiOcupN} ocupados · ${cubiLibresN} libres · ${cubiResvN} reservados`,
                    <div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:6}}>
                        {cubiculos.map(c=>{
                          const col = stColor(c.estado);
                          return (
                            <div key={c.id} style={{borderRadius:8,padding:'7px 4px',textAlign:'center',background:`${col}14`,border:`1.5px solid ${col}45`}}>
                              <div style={{fontSize:8,fontWeight:700,color:col,fontFamily:"'Space Mono',monospace"}}>{c.nombre}</div>
                              <div style={{width:8,height:8,borderRadius:'50%',background:col,margin:'4px auto 0'}}/>
                            </div>
                          );
                        })}
                      </div>
                      <div style={{display:'flex',gap:16,marginTop:10,justifyContent:'center'}}>
                        {[{l:'Libre',c:t.green},{l:'Ocupado',c:t.rose},{l:'Reservado',c:t.amber}].map(({l,c})=>(
                          <div key={l} style={{display:'flex',alignItems:'center',gap:5,fontSize:9,color:t.textDim}}>
                            <div style={{width:8,height:8,borderRadius:'50%',background:c}}/>{l}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {cc('Estado actual — Computadoras', `${compuOcupN} ocupadas · ${compuLibresN} libres de ${computadoras.length} totales`,
                    <div>
                      {compuZonas.map(zona=>{
                        const zc  = computadoras.filter(c => c.zona === zona);
                        const occ = zc.filter(c => c.estado === 'ocupado').length;
                        const pct = zc.length > 0 ? Math.round((occ / zc.length) * 100) : 0;
                        return (
                          <div key={zona} style={{marginBottom:12}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                              <span style={{fontSize:11,fontWeight:600,color:t.text}}>{zona}</span>
                              <span style={{fontSize:10,color:t.textDim,fontFamily:"'Space Mono',monospace"}}>{occ}/{zc.length} · {pct}%</span>
                            </div>
                            <div style={{height:7,borderRadius:4,background:`${t.text}10`,overflow:'hidden'}}>
                              <div style={{height:'100%',borderRadius:4,background:pct>75?t.rose:pct>40?t.amber:t.green,width:`${pct}%`,transition:'width .4s'}}/>
                            </div>
                            <div style={{display:'flex',gap:3,marginTop:5,flexWrap:'wrap'}}>
                              {zc.map(c=><div key={c.id} title={c.nombre} style={{width:10,height:10,borderRadius:2,background:stColor(c.estado)}}/>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Tendencia 30 días */}
                {cc('Tendencia de reservas — últimos 30 días', 'Actividad diaria por servicio',
                  <ResponsiveContainer width="100%" height={CH+20}>
                    <AreaChart data={trend30}>
                      <defs>
                        <linearGradient id="ovGT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.teal} stopOpacity={.28}/><stop offset="100%" stopColor={t.teal} stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="ovGB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.blue} stopOpacity={.22}/><stop offset="100%" stopColor={t.blue} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                      <XAxis dataKey="label" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip content={<CTooltip t={t}/>}/>
                      <Area type="monotone" dataKey="cubiculos"    name="Cubículos"    stroke={t.teal} fill="url(#ovGT)" strokeWidth={2} stackId="a" activeDot={{r:4,fill:t.teal,stroke:'#fff',strokeWidth:2}}/>
                      <Area type="monotone" dataKey="computadoras" name="Computadoras" stroke={t.blue} fill="url(#ovGB)" strokeWidth={2} stackId="a" activeDot={{r:4,fill:t.blue,stroke:'#fff',strokeWidth:2}}/>
                    </AreaChart>
                  </ResponsiveContainer>,
                  {marginBottom:14}
                )}

                {/* Fila charts: carrera + turno + split */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Reservas por carrera', 'Top 8 programas académicos (histórico)',
                    topCarreras.length > 0 ? (
                      <ResponsiveContainer width="100%" height={CH+60}>
                        <BarChart data={topCarreras} layout="vertical" margin={{left:4,right:24}}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} horizontal={false}/>
                          <XAxis type="number" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false}/>
                          <YAxis type="category" dataKey="carrera" tick={{fontSize:8,fill:t.textDim}} axisLine={false} tickLine={false} width={68}/>
                          <Tooltip content={<CTooltip t={t}/>}/>
                          <Bar dataKey="total" name="Reservas" radius={[0,5,5,0]}>
                            {topCarreras.map((_,i)=><Cell key={i} fill={PC[i%PC.length]}/>)}
                            <LabelList dataKey="total" position="right" style={{fontSize:9,fill:t.textDim}}/>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{height:CH+60,display:'flex',alignItems:'center',justifyContent:'center',color:t.textMuted,fontSize:12}}>Sin datos</div>
                  )}
                  {cc('Por turno', 'Distribución histórica',
                    <ResponsiveContainer width="100%" height={CH+60}>
                      <BarChart data={turnoData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="turno" tick={{fontSize:10,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                          {turnoData.map((_,i)=><Cell key={i} fill={[t.amber,t.teal,t.purple][i]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {cc('Cubi vs Computadoras', 'Split de uso por servicio',
                    <div>
                      <ResponsiveContainer width="100%" height={140}>
                        <PieChart>
                          <Pie data={splitData} dataKey="value" cx="50%" cy="50%" innerRadius={38} outerRadius={60} paddingAngle={3} cornerRadius={4} animationDuration={800}>
                            {splitData.map((_,i)=><Cell key={i} fill={[t.teal,t.blue][i]}/>)}
                          </Pie>
                          <Tooltip content={<CTooltip t={t}/>}/>
                        </PieChart>
                      </ResponsiveContainer>
                      <div style={{display:'flex',flexDirection:'column',gap:7,marginTop:6}}>
                        {splitData.map((d,i)=>(
                          <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',fontSize:10}}>
                            <div style={{display:'flex',alignItems:'center',gap:6}}>
                              <div style={{width:8,height:8,borderRadius:'50%',background:[t.teal,t.blue][i]}}/>
                              <span style={{color:t.textDim}}>{d.name}</span>
                            </div>
                            <span style={{fontWeight:700,color:t.text,fontFamily:"'Space Mono',monospace"}}>{d.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Fila charts: hora + día semana + duración */}
                <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Actividad por hora del día', 'Reservas totales por franja horaria (0–23h)',
                    <ResponsiveContainer width="100%" height={CH}>
                      <BarChart data={horaData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="hora" tick={{fontSize:8,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[3,3,0,0]} fill={t.purple}/>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {cc('Por día de semana', 'Patrón semanal histórico',
                    <ResponsiveContainer width="100%" height={CH}>
                      <BarChart data={diasData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="dia" tick={{fontSize:10,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[5,5,0,0]} fill={t.green}/>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  {cc('Por duración de sesión', 'Sesiones de 1h, 2h y 3h',
                    <ResponsiveContainer width="100%" height={CH}>
                      <BarChart data={durData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="dur" tick={{fontSize:12,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                          {durData.map((_,i)=><Cell key={i} fill={[t.teal,t.blue,t.purple][i]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Score de salud + Alertas */}
                <div style={{display:'grid',gridTemplateColumns:'220px 1fr',gap:14,marginBottom:14}}>
                  {/* Score */}
                  <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                    <div style={{fontSize:10,color:t.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:.9}}>Score de Salud</div>
                    <div style={{position:'relative',width:110,height:110}}>
                      <svg viewBox="0 0 110 110" width="110" height="110">
                        <circle cx="55" cy="55" r="46" fill="none" stroke={`${t.text}0c`} strokeWidth="10"/>
                        <circle cx="55" cy="55" r="46" fill="none" stroke={healthColor} strokeWidth="10"
                          strokeDasharray={`${2*Math.PI*46*healthScore/100} ${2*Math.PI*46}`}
                          strokeLinecap="round" transform="rotate(-90 55 55)" style={{transition:'stroke-dasharray .6s ease'}}/>
                      </svg>
                      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
                        <div style={{fontSize:26,fontWeight:800,color:healthColor,fontFamily:"'Space Mono',monospace",lineHeight:1}}>{healthScore}</div>
                        <div style={{fontSize:9,color:t.textDim}}>/ 100</div>
                      </div>
                    </div>
                    <div style={{fontSize:13,fontWeight:700,color:healthColor}}>{healthLabel}</div>
                    <div style={{fontSize:9,color:t.textDim,textAlign:'center',lineHeight:1.5}}>
                      Basado en ocupación, tendencia,<br/>retención y equilibrio de turnos
                    </div>
                  </div>
                  {/* Alertas */}
                  <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                    <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Alertas inteligentes</div>
                    <div style={{fontSize:10,color:t.textDim,marginBottom:14}}>Detección automática de condiciones relevantes</div>
                    <div style={{display:'flex',flexDirection:'column',gap:8}}>
                      {alerts.map((a,i)=>{
                        const col = a.type==='warn'?t.amber:a.type==='ok'?t.green:t.blue;
                        const bg  = a.type==='warn'?`${t.amber}12`:a.type==='ok'?`${t.green}12`:`${t.blue}12`;
                        return (
                          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:10,background:bg,border:`1px solid ${col}30`}}>
                            <div style={{width:7,height:7,borderRadius:'50%',background:col,flexShrink:0}}/>
                            <span style={{fontSize:11,color:t.text}}>{a.msg}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Retención + Nuevos usuarios por semana */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Retención de usuarios', '% de alumnos que regresaron más de una vez',
                    <div>
                      <div style={{display:'flex',gap:20,marginBottom:16,justifyContent:'center'}}>
                        {retData.map(d=>(
                          <div key={d.name} style={{textAlign:'center'}}>
                            <div style={{fontSize:22,fontWeight:800,color:d.color,fontFamily:"'Space Mono',monospace"}}>{d.value}</div>
                            <div style={{fontSize:9,color:t.textDim,marginTop:2}}>{d.name}</div>
                          </div>
                        ))}
                      </div>
                      <ResponsiveContainer width="100%" height={CH-20}>
                        <BarChart data={retData} layout="vertical" margin={{left:8,right:28}}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} horizontal={false}/>
                          <XAxis type="number" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                          <YAxis type="category" dataKey="name" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} width={90}/>
                          <Tooltip content={<CTooltip t={t}/>}/>
                          <Bar dataKey="value" name="Alumnos" radius={[0,5,5,0]}>
                            {retData.map((d,i)=><Cell key={i} fill={d.color}/>)}
                            <LabelList dataKey="value" position="right" style={{fontSize:10,fill:t.textDim,fontWeight:700}}/>
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {cc('Nuevos usuarios por semana', 'Alumnos que aparecen por primera vez en historial',
                    <ResponsiveContainer width="100%" height={CH+20}>
                      <AreaChart data={weeklyNew}>
                        <defs>
                          <linearGradient id="ovGN" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={t.purple} stopOpacity={.28}/><stop offset="100%" stopColor={t.purple} stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="semana" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Area type="monotone" dataKey="nuevos" name="Nuevos alumnos" stroke={t.purple} fill="url(#ovGN)" strokeWidth={2}
                          activeDot={{r:4,fill:t.purple,stroke:'#fff',strokeWidth:2}}/>
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Heatmap turno × día + Carrera × Servicio */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Heatmap turno × día de semana', 'Intensidad de uso por combinación turno–día',
                    <div style={{overflowX:'auto'}}>
                      <table style={{width:'100%',borderCollapse:'separate',borderSpacing:4}}>
                        <thead>
                          <tr>
                            <th style={{width:70,fontSize:9,color:t.textDim,fontWeight:600,textAlign:'left',paddingBottom:4}}/>
                            {TURNOS_F.map(t2=>(
                              <th key={t2} style={{fontSize:10,color:t.textDim,fontWeight:600,textAlign:'center',paddingBottom:6,whiteSpace:'nowrap'}}>{t2.slice(0,3)}.</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {heatData.map(row=>(
                            <tr key={row.dia}>
                              <td style={{fontSize:10,color:t.textDim,fontWeight:600,paddingRight:4,paddingTop:3}}>{row.dia}</td>
                              {TURNOS_F.map(t2=>{
                                const v   = row[t2];
                                const pct = v/heatMax;
                                const bg  = pct===0?`${t.text}08`:`${t.teal}`;
                                return (
                                  <td key={t2} style={{padding:0}}>
                                    <div style={{
                                      height:34,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',
                                      background:pct===0?`${t.text}08`:`${t.teal}`,
                                      opacity:pct===0?1:Math.max(0.12,pct),
                                      border:`1px solid ${t.cardBorder}`,
                                    }}>
                                      <span style={{fontSize:10,fontWeight:700,color:pct>0.5?'#fff':t.text,fontFamily:"'Space Mono',monospace"}}>{v||''}</span>
                                    </div>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {cc('Carrera × Servicio', 'Preferencia de uso por tipo de espacio (top 6 carreras)',
                    crossData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={CH+60}>
                        <BarChart data={crossData} layout="vertical" margin={{left:4,right:24}}>
                          <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} horizontal={false}/>
                          <XAxis type="number" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                          <YAxis type="category" dataKey="carrera" tick={{fontSize:8,fill:t.textDim}} axisLine={false} tickLine={false} width={76}/>
                          <Tooltip content={<CTooltip t={t}/>}/>
                          <Bar dataKey="cubiculos"    name="Cubículos"    radius={[0,3,3,0]} fill={t.teal}/>
                          <Bar dataKey="computadoras" name="Computadoras" radius={[0,3,3,0]} fill={t.blue}/>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <div style={{height:CH+60,display:'flex',alignItems:'center',justifyContent:'center',color:t.textMuted,fontSize:12}}>Sin datos</div>
                  )}
                </div>

                {/* Rotación por espacio */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
                  {cc('Rotación — Cubículos', 'Número total de reservas por espacio (de mayor a menor)',
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {cubiRot.map((c,i)=>(
                        <div key={c.nombre} style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:36,fontSize:9,color:t.textDim,fontWeight:600,flexShrink:0,fontFamily:"'Space Mono',monospace"}}>{c.nombre}</div>
                          <div style={{flex:1,height:14,borderRadius:4,background:`${t.text}09`,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,background:i===0?t.teal:i===1?t.blue:i===cubiRot.length-1?t.rose:`${t.teal}80`,width:`${(c.total/maxRotC)*100}%`,transition:'width .4s'}}/>
                          </div>
                          <div style={{width:20,fontSize:10,fontWeight:700,color:t.text,textAlign:'right',fontFamily:"'Space Mono',monospace",flexShrink:0}}>{c.total}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {cc('Rotación — Computadoras', 'Número total de reservas por equipo (de mayor a menor)',
                    <div style={{display:'flex',flexDirection:'column',gap:6}}>
                      {compuRot.map((c,i)=>(
                        <div key={c.nombre} style={{display:'flex',alignItems:'center',gap:8}}>
                          <div style={{width:36,fontSize:9,color:t.textDim,fontWeight:600,flexShrink:0,fontFamily:"'Space Mono',monospace"}}>{c.nombre}</div>
                          <div style={{flex:1,height:14,borderRadius:4,background:`${t.text}09`,overflow:'hidden'}}>
                            <div style={{height:'100%',borderRadius:4,background:i===0?t.blue:i===1?t.teal:i===compuRot.length-1?t.rose:`${t.blue}80`,width:`${(c.total/maxRotP)*100}%`,transition:'width .4s'}}/>
                          </div>
                          <div style={{width:20,fontSize:10,fontWeight:700,color:t.text,textAlign:'right',fontFamily:"'Space Mono',monospace",flexShrink:0}}>{c.total}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* RFM Segmentación de usuarios */}
                {cc('Segmentación de usuarios (RFM)', 'Clasificación por recencia, frecuencia y actividad — base para acciones de retención',
                  <div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:16}}>
                      {segCounts.map(({s,count,color})=>(
                        <div key={s} style={{borderRadius:12,padding:'14px 12px',background:`${color}10`,border:`1px solid ${color}30`,textAlign:'center'}}>
                          <div style={{fontSize:22,fontWeight:800,color,fontFamily:"'Space Mono',monospace"}}>{count}</div>
                          <div style={{fontSize:10,fontWeight:700,color,marginTop:4}}>{s}</div>
                          <div style={{fontSize:9,color:t.textDim,marginTop:3,lineHeight:1.4}}>
                            {s==='Frecuente'?'5+ reservas, activos<30d':s==='Activo'?'activos últimos 30d':s==='En riesgo'?'31–60d sin actividad':'+60d sin actividad'}
                          </div>
                        </div>
                      ))}
                    </div>
                    {rfmData.filter(u=>u.segment!=='Inactivo').length>0 && (
                      <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                          <thead>
                            <tr>{['Alumno','Carrera','Reservas','Último uso','Segmento'].map(h=>(
                              <th key={h} style={{textAlign:'left',color:t.textDim,fontWeight:600,paddingBottom:6,borderBottom:`1px solid ${t.cardBorder}`,paddingRight:10}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {rfmData.filter(u=>u.segment!=='Inactivo').sort((a,b)=>b.count-a.count).slice(0,8).map((u,i)=>(
                              <tr key={i} style={{borderBottom:`1px solid ${t.cardBorder}40`}}>
                                <td style={{padding:'5px 10px 5px 0',color:t.text,maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.nombre}</td>
                                <td style={{color:t.textDim,paddingRight:10,maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{u.carrera}</td>
                                <td style={{color:t.text,fontFamily:"'Space Mono',monospace",paddingRight:10,fontWeight:700}}>{u.count}</td>
                                <td style={{color:t.textDim,paddingRight:10,whiteSpace:'nowrap'}}>{u.days===0?'hoy':u.days===1?'ayer':`hace ${u.days}d`}</td>
                                <td>
                                  <span style={{fontSize:9,padding:'2px 8px',borderRadius:10,fontWeight:700,background:`${segColors[u.segment]}18`,color:segColors[u.segment]}}>
                                    {u.segment}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>,
                  {marginBottom:14}
                )}

                {/* Bottom: top alumnos + últimas reservas */}
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
                  {cc('Top 5 alumnos más activos', 'Por número de reservas históricas totales',
                    topAlumnos.length > 0 ? (
                      <div style={{display:'flex',flexDirection:'column',gap:8}}>
                        {topAlumnos.map((a,i)=>(
                          <div key={a.exp||i} style={{display:'flex',alignItems:'center',gap:12,padding:'8px 12px',borderRadius:10,background:`${t.text}04`}}>
                            <div style={{width:26,height:26,borderRadius:'50%',background:`${PC[i%PC.length]}1a`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,color:PC[i%PC.length],flexShrink:0}}>{i+1}</div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:11,fontWeight:600,color:t.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.nombre}</div>
                              <div style={{fontSize:9,color:t.textDim}}>{a.carrera}</div>
                            </div>
                            <div style={{fontSize:14,fontWeight:800,color:t.teal,fontFamily:"'Space Mono',monospace",flexShrink:0}}>{a.count}</div>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{color:t.textMuted,fontSize:12,textAlign:'center',padding:'24px 0'}}>Sin datos registrados aún</div>
                  )}
                  {cc('Últimas reservas', 'Actividad reciente de todos los servicios',
                    recentRecs.length > 0 ? (
                      <div style={{overflowX:'auto'}}>
                        <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                          <thead>
                            <tr>{['Tipo','Alumno','Carrera','Dur.','Fin'].map(h=>(
                              <th key={h} style={{textAlign:'left',color:t.textDim,fontWeight:600,paddingBottom:7,borderBottom:`1px solid ${t.cardBorder}`,paddingRight:8,whiteSpace:'nowrap'}}>{h}</th>
                            ))}</tr>
                          </thead>
                          <tbody>
                            {recentRecs.map((r,i)=>{
                              const fin = r.fin ? new Date(r.fin) : null;
                              return (
                                <tr key={i} style={{borderBottom:`1px solid ${t.cardBorder}40`}}>
                                  <td style={{padding:'5px 8px 5px 0'}}>
                                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,fontWeight:600,
                                      background:r.tipo==='cubiculos'?`${t.teal}18`:`${t.blue}18`,
                                      color:r.tipo==='cubiculos'?t.teal:t.blue}}>
                                      {r.tipo==='cubiculos'?'Cubi':'PC'}
                                    </span>
                                  </td>
                                  <td style={{color:t.text,maxWidth:90,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:8}}>{r.nombre||'—'}</td>
                                  <td style={{color:t.textDim,maxWidth:80,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:8}}>{r.carrera||'—'}</td>
                                  <td style={{color:t.text,fontFamily:"'Space Mono',monospace",paddingRight:8}}>{r.duracion||'—'}h</td>
                                  <td style={{color:t.textDim,whiteSpace:'nowrap'}}>{fin?`${String(fin.getHours()).padStart(2,'0')}:${String(fin.getMinutes()).padStart(2,'0')}`:'—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : <div style={{color:t.textMuted,fontSize:12,textAlign:'center',padding:'24px 0'}}>Sin reservas registradas aún</div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* ===== SERVICIOS ===== */}
          {nav === "servicios" && (() => {
            // ── helpers ─────────────────────────────────────────────────
            const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
            const DIAS  = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];

            // ── date range ──────────────────────────────────────────────
            const fromDate  = new Date(svcDateFrom);
            const toDate    = new Date(svcDateTo + 'T23:59:59');
            const rangeDays = Math.max(1, Math.ceil((toDate - fromDate) / 86400000));
            const prevFrom  = new Date(fromDate.getTime() - rangeDays * 86400000);

            // ── data source ─────────────────────────────────────────────
            const baseRecs    = historialReservas.filter(h => h.tipo === svcService);
            const allCarreras = [...new Set(baseRecs.map(h => h.carrera).filter(Boolean))].sort();
            const applyFilters = arr => arr
              .filter(h => !svcCarreraFilter || h.carrera === svcCarreraFilter)
              .filter(h => !svcTurnoFilter   || h.turno   === svcTurnoFilter)
              .filter(h => svcDurFilter == null || h.duracion === svcDurFilter);
            const inRange  = baseRecs.filter(h => { const d = new Date(h.fin||h.inicio); return d >= fromDate && d <= toDate; });
            const inPeriod = applyFilters(inRange);
            const inPrev   = applyFilters(baseRecs.filter(h => { const d = new Date(h.fin||h.inicio); return d >= prevFrom && d < fromDate; }));

            // ── KPIs ────────────────────────────────────────────────────
            const total       = inPeriod.length;
            const prevTotal   = inPrev.length;
            const tendPct     = prevTotal > 0 ? Math.round(((total - prevTotal) / prevTotal) * 100) : (total > 0 ? 100 : 0);
            const avgDur      = total > 0 ? (inPeriod.reduce((a, h) => a + (h.duracion || 0), 0) / total).toFixed(1) : '0';
            const withPers    = inPeriod.filter(h => h.personas > 0);
            const avgPers     = withPers.length > 0 ? (withPers.reduce((a, h) => a + h.personas, 0) / withPers.length).toFixed(1) : '—';
            const uniqueCarr  = new Set(inPeriod.map(h => h.carrera).filter(Boolean)).size;
            const uniqueAlmn  = new Set(inPeriod.map(h => h.matricula).filter(Boolean)).size;
            const cubiInUso   = cubiculos.filter(c => c.estado === 'ocupado').length;
            const compuInUso  = computadoras.filter(c => c.estado === 'ocupado').length;
            const tasa        = svcService === 'cubiculos'
              ? (cubiculos.length > 0 ? Math.round((cubiInUso / cubiculos.length) * 100) : 0)
              : (computadoras.length > 0 ? Math.round((compuInUso / computadoras.length) * 100) : 0);

            // ── peak hour ───────────────────────────────────────────────
            const hourCounts = Array.from({length:24}, (_, h) => inPeriod.filter(r => new Date(r.inicio||r.fin).getHours()===h).length);
            const maxHour    = Math.max(...hourCounts, 0);
            const peakLabel  = total > 0 ? `${String(hourCounts.indexOf(maxHour)).padStart(2,'0')}:00` : '—';

            // ── top space ───────────────────────────────────────────────
            const spaceMap = {};
            inPeriod.forEach(h => { const s = h.cubicule || h.pc; if (s) spaceMap[s] = (spaceMap[s]||0)+1; });
            const topSpace = Object.entries(spaceMap).sort((a,b)=>b[1]-a[1])[0];

            // ── trend chart ─────────────────────────────────────────────
            const trendData = (() => {
              if (rangeDays <= 1) {
                return Array.from({length:24}, (_, h) => ({
                  label: h % 4 === 0 ? `${String(h).padStart(2,'0')}h` : '',
                  reservas: inPeriod.filter(r => new Date(r.inicio||r.fin).getHours()===h).length,
                }));
              }
              if (rangeDays <= 60) {
                const skip = Math.ceil((rangeDays + 1) / 12);
                return Array.from({length: rangeDays + 1}, (_, i) => {
                  const d = new Date(fromDate.getTime() + i * 86400000);
                  return {
                    label: i % skip === 0 ? `${d.getDate()}/${d.getMonth()+1}` : '',
                    reservas: inPeriod.filter(r => new Date(r.fin||r.inicio).toDateString()===d.toDateString()).length,
                  };
                });
              }
              const months = [];
              const cur = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
              while (cur <= toDate) {
                const m = cur.getMonth(), y = cur.getFullYear();
                months.push({ label: `${MESES[m]} ${y}`, reservas: inPeriod.filter(r => { const f=new Date(r.fin||r.inicio); return f.getMonth()===m&&f.getFullYear()===y; }).length });
                cur.setMonth(cur.getMonth() + 1);
              }
              return months;
            })();

            // ── by carrera ──────────────────────────────────────────────
            const carreraMap = {};
            inPeriod.forEach(h => { const c = h.carrera||'Otra'; carreraMap[c] = (carreraMap[c]||0)+1; });
            const carreraData = Object.entries(carreraMap)
              .sort((a,b)=>b[1]-a[1]).slice(0,8)
              .map(([carrera, tot]) => ({ carrera: carrera.replace('Ing. ','Ing.'), total: tot }));

            // ── by turno ────────────────────────────────────────────────
            const turnoData = ['Matutino','Vespertino','Nocturno'].map(turno => ({
              turno, reservas: inPeriod.filter(h => h.turno===turno).length,
            }));

            // ── by duracion ─────────────────────────────────────────────
            const durData = [1,2,3].map(d => ({
              dur: `${d}h`, reservas: inPeriod.filter(h => h.duracion===d).length,
            }));

            // ── by dia semana ───────────────────────────────────────────
            const diasData = DIAS.map((d, i) => ({
              dia: d, reservas: inPeriod.filter(h => new Date(h.fin||h.inicio).getDay()===i).length,
            }));

            // ── by piso / zona ──────────────────────────────────────────
            const pisoData = [1,2].map(p => ({
              piso: `Piso ${p}`, reservas: inPeriod.filter(h => h.piso===p).length,
            }));
            const zonaData = ['General','Silencio','Investigación'].map(z => ({
              zona: z, reservas: inPeriod.filter(h => (h.zona||'').includes(z)).length,
            }));

            // ── recent table ────────────────────────────────────────────
            const recentRecs = [...inPeriod]
              .sort((a,b)=>new Date(b.fin||b.inicio)-new Date(a.fin||a.inicio))
              .slice(0,10);

            const tendColor = tendPct >= 0 ? t.green : t.rose;
            const CHART_H   = 200;

            return (
            <div style={{padding:'24px 28px'}}>
              {/* — Unified filter bar — */}
              {(() => {
                const lbl = { fontSize:11, fontWeight:700, color:t.textDim, whiteSpace:'nowrap' };
                const pill = (active) => ({
                  padding:'5px 13px', borderRadius:8, fontSize:11, fontWeight:active?700:400, cursor:'pointer',
                  border:`1px solid ${active?t.teal:t.cardBorder}`,
                  background:active?`${t.teal}18`:'transparent', color:active?t.teal:t.textDim,
                });
                const sep = <div style={{width:1,height:20,background:t.cardBorder,margin:'0 2px'}}/>;
                const dateInput = (val, setter, max) => (
                  <input type="date" value={val} max={max} onChange={e=>setter(e.target.value)}
                    style={{padding:'4px 8px',borderRadius:8,border:`1px solid ${t.cardBorder}`,fontSize:11,
                      background:t.bg,color:t.text,outline:'none',cursor:'pointer'}}/>
                );
                const hasFilters = svcCarreraFilter || svcTurnoFilter || svcDurFilter;
                return (
                  <div style={{background:t.card,borderRadius:12,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,marginBottom:20}}>
                    {/* Fila 1: Servicio + fechas */}
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'10px 16px'}}>
                      <span style={lbl}>Servicio:</span>
                      {[{id:'cubiculos',label:'Cubículos',Ic:Layers},{id:'computadoras',label:'Computadoras',Ic:Monitor}].map(({id,label,Ic})=>(
                        <button key={id} onClick={()=>setSvcService(id)} style={{...pill(svcService===id),display:'flex',alignItems:'center',gap:5}}>
                          <Ic size={12}/>{label}
                        </button>
                      ))}
                      {sep}
                      <span style={lbl}>Desde:</span>
                      {dateInput(svcDateFrom, setSvcDateFrom, svcDateTo)}
                      <span style={lbl}>Hasta:</span>
                      {dateInput(svcDateTo, setSvcDateTo, new Date().toISOString().slice(0,10))}
                    </div>
                    {/* Divider */}
                    <div style={{height:1,background:t.cardBorder}}/>
                    {/* Fila 2: Carrera + Turno + Duración */}
                    <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',padding:'10px 16px'}}>
                      <span style={lbl}>Carrera:</span>
                      <select value={svcCarreraFilter} onChange={e=>setSvcCarreraFilter(e.target.value)}
                        style={{padding:'4px 10px',borderRadius:8,border:`1px solid ${svcCarreraFilter?t.teal:t.cardBorder}`,fontSize:11,
                          background:t.bg,color:svcCarreraFilter?t.teal:t.text,outline:'none',cursor:'pointer',fontWeight:svcCarreraFilter?700:400}}>
                        <option value="">Todas</option>
                        {allCarreras.map(c=><option key={c} value={c}>{c}</option>)}
                      </select>
                      {sep}
                      <span style={lbl}>Turno:</span>
                      {['Matutino','Vespertino','Nocturno'].map(t2=>(
                        <button key={t2} onClick={()=>setSvcTurnoFilter(p=>p===t2?'':t2)} style={pill(svcTurnoFilter===t2)}>{t2}</button>
                      ))}
                      {sep}
                      <span style={lbl}>Duración:</span>
                      {[1,2,3].map(d=>(
                        <button key={d} onClick={()=>setSvcDurFilter(p=>p===d?null:d)} style={pill(svcDurFilter===d)}>{d}h</button>
                      ))}
                      {hasFilters && (
                        <button onClick={()=>{setSvcCarreraFilter('');setSvcTurnoFilter('');setSvcDurFilter(null);}}
                          style={{marginLeft:'auto',padding:'4px 12px',borderRadius:8,border:`1px solid ${t.rose}`,fontSize:10,
                            background:'transparent',color:t.rose,cursor:'pointer',fontWeight:600}}>
                          Limpiar filtros
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* — KPI row 5 cards — */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:12,marginBottom:14}}>
                {[
                  {label:'Total reservas',  value:total,                                  sub:`anterior: ${prevTotal}`, color:t.teal,   Ic:Activity},
                  {label:'Duración prom.',  value:`${avgDur}h`,                           sub: svcService==='cubiculos'?`${avgPers} pers. prom.`:'por sesión', color:t.blue,   Ic:Clock},
                  {label:'Carreras',        value:uniqueCarr,                             sub:'distintas atendidas',   color:t.purple, Ic:GraduationCap},
                  {label:'Tendencia',       value:total===0&&prevTotal===0?'—':`${tendPct>0?'+':''}${tendPct}%`, sub:'vs periodo anterior', color:tendColor, Ic:TrendingUp},
                  {label:'Tasa uso actual', value:`${tasa}%`,                             sub:'ocupación en tiempo real', color:t.amber, Ic:Target},
                ].map(({label,value,sub,color,Ic})=>(
                  <div key={label} style={{background:t.card,borderRadius:14,padding:'14px 16px',border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,borderTop:`3px solid ${color}`}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8}}>
                      <div style={{width:28,height:28,borderRadius:8,background:`${color}22`,display:'flex',alignItems:'center',justifyContent:'center',boxShadow:`0 4px 10px ${color}28`}}>
                        <Ic size={13} color={color}/>
                      </div>
                      <span style={{fontSize:9,color:t.textDim,fontWeight:700,textTransform:'uppercase',letterSpacing:1,lineHeight:1.2}}>{label}</span>
                    </div>
                    <div style={{fontSize:22,fontWeight:800,color:t.text,fontFamily:"'Space Mono',monospace",lineHeight:1}}>{value}</div>
                    <div style={{fontSize:9,color:t.textDim,marginTop:4}}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* — Mini KPI row: hora pico · espacio estrella · alumnos únicos — */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20}}>
                {[
                  {label:'Hora pico',      value:peakLabel, sub:'más reservas en el periodo'},
                  {label:svcService==='cubiculos'?'Cubículo más usado':'PC más usada', value:topSpace?topSpace[0]:'—', sub:topSpace?`${topSpace[1]} reservas`:'sin datos'},
                  {label:'Alumnos únicos', value:uniqueAlmn, sub:'matrículas distintas'},
                ].map(({label,value,sub})=>(
                  <div key={label} style={{background:t.card,borderRadius:12,padding:'12px 16px',border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,display:'flex',alignItems:'center',gap:14}}>
                    <div>
                      <div style={{fontSize:9,color:t.textDim,textTransform:'uppercase',letterSpacing:.8,marginBottom:3}}>{label}</div>
                      <div style={{fontSize:18,fontWeight:800,fontFamily:"'Space Mono',monospace",color:t.text}}>{value}</div>
                      <div style={{fontSize:9,color:t.textDim,marginTop:2}}>{sub}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* — Charts grid — */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>

                {/* Tendencia full width */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow,gridColumn:'1/-1'}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Tendencia de uso</div>
                  <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>
                    {rangeDays <= 1 ? 'Reservas por hora del día' : rangeDays <= 60 ? `Reservas por día · ${svcDateFrom} – ${svcDateTo}` : `Reservas por mes · ${svcDateFrom} – ${svcDateTo}`}
                  </div>
                  <ResponsiveContainer width="100%" height={CHART_H}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="svGT" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.teal} stopOpacity={.28}/>
                          <stop offset="100%" stopColor={t.teal} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                      <XAxis dataKey="label" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip content={<CTooltip t={t}/>}/>
                      <Area type="monotone" dataKey="reservas" name="Reservas" stroke={t.teal} fill="url(#svGT)" strokeWidth={2}
                        activeDot={{r:4,fill:t.teal,stroke:'#fff',strokeWidth:2}}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Por carrera */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por carrera</div>
                  <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Top 8 carreras</div>
                  {carreraData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={CHART_H + 40}>
                      <BarChart data={carreraData} layout="vertical" margin={{left:4,right:20}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} horizontal={false}/>
                        <XAxis type="number" tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis type="category" dataKey="carrera" tick={{fontSize:8,fill:t.textDim}} axisLine={false} tickLine={false} width={65}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="total" name="Reservas" radius={[0,4,4,0]} fill={t.blue}>
                          <LabelList dataKey="total" position="right" style={{fontSize:9,fill:t.textDim}}/>
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{height:CHART_H+40,display:'flex',alignItems:'center',justifyContent:'center',color:t.textMuted,fontSize:12}}>Sin datos en este periodo</div>
                  )}
                </div>

                {/* Por turno */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por turno</div>
                  <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Matutino · Vespertino · Nocturno</div>
                  <ResponsiveContainer width="100%" height={CHART_H + 40}>
                    <BarChart data={turnoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                      <XAxis dataKey="turno" tick={{fontSize:10,fill:t.textDim}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip content={<CTooltip t={t}/>}/>
                      <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                        {turnoData.map((_,i)=><Cell key={i} fill={[t.amber,t.teal,t.purple][i]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Por duración */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por duración</div>
                  <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Sesiones de 1h, 2h y 3h</div>
                  <ResponsiveContainer width="100%" height={CHART_H + 40}>
                    <BarChart data={durData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                      <XAxis dataKey="dur" tick={{fontSize:12,fill:t.textDim}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip content={<CTooltip t={t}/>}/>
                      <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                        {durData.map((_,i)=><Cell key={i} fill={[t.teal,t.blue,t.purple][i]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Por día de semana */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por día de semana</div>
                  <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Distribución de reservas Lun–Dom</div>
                  <ResponsiveContainer width="100%" height={CHART_H + 40}>
                    <BarChart data={diasData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                      <XAxis dataKey="dia" tick={{fontSize:10,fill:t.textDim}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip content={<CTooltip t={t}/>}/>
                      <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]} fill={t.green}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Piso (cubiculos) | Zona (computadoras) */}
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  {svcService === 'cubiculos' ? (<>
                    <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por piso</div>
                    <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Reservas por planta del edificio</div>
                    <ResponsiveContainer width="100%" height={CHART_H + 40}>
                      <BarChart data={pisoData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="piso" tick={{fontSize:11,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                          {pisoData.map((_,i)=><Cell key={i} fill={[t.rose,t.amber][i]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>) : (<>
                    <div style={{fontSize:10,fontWeight:800,color:t.text,textTransform:'uppercase',letterSpacing:1,marginBottom:4}}>Por zona</div>
                    <div style={{fontSize:10,color:t.textDim,marginBottom:12}}>Uso por sala de cómputo</div>
                    <ResponsiveContainer width="100%" height={CHART_H + 40}>
                      <BarChart data={zonaData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`}/>
                        <XAxis dataKey="zona" tick={{fontSize:10,fill:t.textDim}} axisLine={false} tickLine={false}/>
                        <YAxis tick={{fontSize:9,fill:t.textDim}} axisLine={false} tickLine={false} allowDecimals={false}/>
                        <Tooltip content={<CTooltip t={t}/>}/>
                        <Bar dataKey="reservas" name="Reservas" radius={[6,6,0,0]}>
                          {zonaData.map((_,i)=><Cell key={i} fill={[t.teal,t.blue,t.purple][i]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </>)}
                </div>
              </div>

              {/* — Últimas reservas table — */}
              {recentRecs.length > 0 && (
                <div style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,boxShadow:t.shadow}}>
                  <div style={{fontSize:13,fontWeight:700,color:t.text,marginBottom:14}}>Últimas reservas del periodo</div>
                  <div style={{overflowX:'auto'}}>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead>
                        <tr>{['Espacio','Alumno','Matrícula','Carrera','Duración','Turno','Fecha'].map(h=>(
                          <th key={h} style={{padding:'6px 12px',textAlign:'left',fontSize:9,fontWeight:600,color:t.textDim,textTransform:'uppercase',letterSpacing:.8,borderBottom:`1px solid ${t.cardBorder}`}}>{h}</th>
                        ))}</tr>
                      </thead>
                      <tbody>
                        {recentRecs.map((r,i)=>{
                          const f = new Date(r.fin||r.inicio);
                          return (
                            <tr key={i} style={{borderBottom:`1px solid ${t.cardBorder}50`}}>
                              <td style={{padding:'8px 12px',fontWeight:600,color:t.teal,fontFamily:"'Space Mono',monospace",fontSize:10}}>{r.cubicule||r.pc||'—'}</td>
                              <td style={{padding:'8px 12px',color:t.text}}>{r.nombre||'—'}</td>
                              <td style={{padding:'8px 12px',color:t.textDim,fontFamily:"'Space Mono',monospace",fontSize:10}}>{r.matricula||'—'}</td>
                              <td style={{padding:'8px 12px',color:t.textDim,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.carrera||'—'}</td>
                              <td style={{padding:'8px 12px',color:t.text,fontWeight:600}}>{r.duracion}h</td>
                              <td style={{padding:'8px 12px',color:t.textDim}}>{r.turno||'—'}</td>
                              <td style={{padding:'8px 12px',color:t.textDim,fontFamily:"'Space Mono',monospace",fontSize:10}}>{f.toLocaleDateString('es-MX')}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* — Empty state — */}
              {total === 0 && (
                <div style={{textAlign:'center',padding:'48px 20px',color:t.textDim}}>
                  <div style={{fontSize:32,marginBottom:12,opacity:.3}}>{svcService==='cubiculos'?'🗂️':'💻'}</div>
                  <div style={{fontSize:14,fontWeight:600,marginBottom:6}}>Sin registros en este periodo</div>
                  <div style={{fontSize:12}}>Las reservas completadas aparecerán aquí automáticamente</div>
                </div>
              )}
            </div>
            );
          })()}

          {/* ===== PREDICTIVO ===== */}
          {nav === "predictivo" && (
            <div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={Target} label="Precisión del modelo" value={predModel === "rf" ? "94.2%" : predModel === "prophet" ? "91.8%" : "88.5%"} change="+1.3%" changeType="up" color={t.teal} t={t} />
                <StatCard icon={Brain} label="Modelo activo" value={predModel === "rf" ? "Random Forest" : predModel === "prophet" ? "Prophet" : "Regresión"} color={t.blue} t={t} />
                <StatCard icon={Zap} label={`Predicción +${predHorizon} meses`} value={predHorizon <= 2 ? "1,950" : predHorizon <= 4 ? "2,100" : "1,680"} color={t.purple} t={t} />
                <StatCard icon={Activity} label="RMSE (Error)" value={predModel === "rf" ? "48.3" : predModel === "prophet" ? "52.1" : "67.4"} change="-12.7%" changeType="up" color={t.amber} t={t} />
              </div>

              {/* Controls panel */}
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
                  <label style={{ fontSize: 10, color: t.textDim }}>Horizonte de predicción: {predHorizon} meses</label>
                  <input type="range" min={1} max={6} value={predHorizon} onChange={e => setPredHorizon(+e.target.value)}
                    style={{ width: 180, accentColor: t.teal }} />
                </div>
              </div>

              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Pronóstico de Circulación</div>
                <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>
                  Modelo: {predModel === "rf" ? "Random Forest" : predModel === "prophet" ? "Prophet (Meta)" : "Regresión Lineal"} · Horizonte: {predHorizon} meses · Campus: {campus === "todos" ? "Todos" : campus}
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={circulacion}>
                    <defs>
                      <linearGradient id="pG1" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={t.teal} stopOpacity={0.3} />
                        <stop offset="40%" stopColor={t.teal} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={t.teal} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="pG2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={t.amber} stopOpacity={0.25} />
                        <stop offset="40%" stopColor={t.amber} stopOpacity={0.1} />
                        <stop offset="100%" stopColor={t.amber} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtK} />
                    <Tooltip content={<CTooltip />} />
                    <ReferenceLine y={circAvg} stroke={t.textDim} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: `Prom. ${fmtK(circAvg)}`, position: "insideTopRight", fontSize: 9, fill: t.textDim, dy: -6 }} />
                    <Area type="monotone" dataKey="prestamos" name="Real" stroke={t.teal} fill="url(#pG1)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={900} animationEasing="ease-out" />
                    <Area type="monotone" dataKey="prediccion" name="Predicción" stroke={t.amber} fill="url(#pG2)" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 4, fill: t.amber, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={1100} animationEasing="ease-out" />
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

              {/* INPUT NLP */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  <Brain size={16} color={t.purple} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Analizar Comentario (NLP en tiempo real)</span>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && submitComment()}
                    placeholder='Escribe un comentario, ej: "El servicio de préstamo fue excelente y rápido"'
                    style={{ flex: 1, padding: "10px 14px", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.inputBg, fontSize: 12, color: t.text, outline: "none" }} />
                  <button onClick={submitComment} disabled={analyzing || !newComment.trim()}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, border: "none", background: analyzing ? t.textDim : `linear-gradient(135deg, ${t.purple}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: analyzing ? "wait" : "pointer", opacity: !newComment.trim() ? 0.5 : 1 }}>
                    {analyzing ? <><RefreshCw size={14} style={{ animation: "spin 1s linear infinite" }} /> Analizando...</> : <><Send size={14} /> Analizar</>}
                  </button>
                </div>
                <div style={{ fontSize: 10, color: t.textDim, marginTop: 6 }}>
                  El motor NLP clasifica automáticamente el sentimiento como positivo, negativo o neutral con un puntaje de confianza.
                </div>
              </div>

              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                {/* Tendencia */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Tendencia del Sentimiento</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Evolución mensual</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={sentTendencia}>
                      <defs>
                        <linearGradient id="sG1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.green} stopOpacity={0.35} />
                          <stop offset="40%" stopColor={t.green} stopOpacity={0.12} />
                          <stop offset="100%" stopColor={t.green} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="sG2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={t.rose} stopOpacity={0.25} />
                          <stop offset="40%" stopColor={t.rose} stopOpacity={0.08} />
                          <stop offset="100%" stopColor={t.rose} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtPct} />
                      <Tooltip content={<CTooltip />} />
                      <Area type="monotone" dataKey="positivo" name="% Positivo" stroke={t.green} fill="url(#sG1)" strokeWidth={2.5} dot={{ r: 3, fill: t.green, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={900} animationEasing="ease-out" />
                      <Area type="monotone" dataKey="negativo" name="% Negativo" stroke={t.rose} fill="url(#sG2)" strokeWidth={2} dot={{ r: 3, fill: t.rose, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={1000} animationEasing="ease-out" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Radar */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Radar de Percepción</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Por dimensión del servicio</div>
                  <ResponsiveContainer width="100%" height={220}>
                    <RadarChart data={radarBase}>
                      <PolarGrid stroke={`${t.text}12`} />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: t.textDim }} />
                      <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                      <Radar dataKey="A" name="Puntuación" stroke={t.teal} fill={t.teal} fillOpacity={0.22} strokeWidth={2.5} dot={{ r: 3, fill: t.teal, stroke: "#fff", strokeWidth: 1.5 }} animationDuration={900} animationEasing="ease-out" />
                      <Tooltip content={<CTooltip />} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Comments feed */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Feed de Comentarios Analizados</div>
                    <div style={{ fontSize: 10, color: t.textDim }}>{comments.length} comentarios procesados por NLP</div>
                  </div>
                  <button onClick={exportSentCSV}
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: "transparent", fontSize: 10, fontWeight: 600, color: t.text, cursor: "pointer" }}>
                    <Download size={11} /> Exportar CSV
                  </button>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {comments.map(c => (
                    <div key={c.id} style={{ padding: 12, borderRadius: 10, marginBottom: 8, background: `${t.text}04` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Badge tipo={c.sentimiento} t={t} />
                          <span style={{ fontSize: 10, fontWeight: 600, color: t.purple, fontFamily: "'Space Mono', monospace" }}>
                            {(c.score * 100).toFixed(0)}% confianza
                          </span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: t.textDim }}>
                          <span>{c.fuente}</span><span>·</span><span>{timeAgo(c.fecha)}</span>
                        </div>
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
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Uso vs. Promedio Académico</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Correlación por rango de préstamos</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={impactoBase}>
                      <defs>
                        {[t.blue, t.teal, t.tealLight, t.purple, t.amber].map((c, i) => (
                          <linearGradient key={i} id={`bGi_${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={c} stopOpacity={1} />
                            <stop offset="100%" stopColor={c} stopOpacity={0.55} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="rango" tick={{ fontSize: 9, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[6, 10]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <Tooltip content={<CTooltip />} />
                      <ReferenceLine y={7.8} stroke={t.textDim} strokeDasharray="5 4" strokeWidth={1.5} label={{ value: "Prom. gral. 7.8", position: "insideTopRight", fontSize: 9, fill: t.textDim, dy: -6 }} />
                      <Bar dataKey="promedio" name="Promedio" radius={[8, 8, 0, 0]} animationDuration={800} animationEasing="ease-out">
                        {impactoBase.map((_, i) => <Cell key={i} fill={`url(#bGi_${i})`} />)}
                        <LabelList dataKey="promedio" position="top" formatter={v => v.toFixed(1)} style={{ fontSize: 10, fontWeight: 700, fill: t.text }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: `${t.teal}08`, fontSize: 11, color: t.teal }}>
                    <strong>Hallazgo:</strong> +1.9 puntos de promedio entre el rango más bajo y el más alto de uso bibliotecario.
                  </div>
                </div>

                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 4 }}>Retención por Semestre</div>
                  <div style={{ fontSize: 10, color: t.textDim, marginBottom: 16 }}>Usuarios de biblioteca vs. no usuarios</div>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={retencionBase}>
                      <CartesianGrid strokeDasharray="3 3" stroke={`${t.text}08`} />
                      <XAxis dataKey="sem" tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} />
                      <YAxis domain={[30, 100]} tick={{ fontSize: 10, fill: t.textDim }} axisLine={false} tickLine={false} tickFormatter={fmtPct} />
                      <Tooltip content={<CTooltip />} />
                      <ReferenceLine y={80} stroke={t.teal} strokeDasharray="5 4" strokeWidth={1.5} strokeOpacity={0.5} label={{ value: "Meta 80%", position: "insideTopRight", fontSize: 9, fill: t.teal, dy: -6 }} />
                      <Line type="monotone" dataKey="usr" name="Usuarios" stroke={t.teal} strokeWidth={3} dot={{ r: 4, fill: t.teal, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={900} animationEasing="ease-out" />
                      <Line type="monotone" dataKey="noUsr" name="No Usuarios" stroke={t.rose} strokeWidth={3} strokeDasharray="6 4" dot={{ r: 4, fill: t.rose, stroke: "#fff", strokeWidth: 2 }} activeDot={{ r: 7, strokeWidth: 2.5, stroke: "#fff" }} animationDuration={1100} animationEasing="ease-out" />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: `${t.purple}08`, fontSize: 11, color: t.purple }}>
                    <strong>Insight:</strong> Al 8vo semestre, los usuarios muestran +34pp de retención (74% vs 40%).
                  </div>
                </div>
              </div>

              {/* Executive summary */}
              <div style={{ borderRadius: 16, padding: 22, background: `linear-gradient(135deg, ${t.navy}, ${dark ? "#1a2744" : "#1e2d4a"})` }}>
                <div style={{ display: "flex", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 14, background: `${t.teal}25`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Zap size={22} color={t.tealLight} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Resumen Ejecutivo de Impacto</div>
                    <p style={{ fontSize: 11, lineHeight: 1.6, color: "rgba(255,255,255,0.7)", margin: 0 }}>
                      Correlación estadísticamente significativa (<span style={{ color: t.tealLight, fontFamily: "'Space Mono', monospace" }}>r = 0.73, p &lt; 0.001</span>) entre uso de servicios bibliotecarios y rendimiento académico. Los usuarios activos obtienen promedios más altos y su permanencia escolar es considerablemente superior.
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

              {/* Upload area */}
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
                    if (file) {
                      setUploadedFile(file.name);
                      setDataRows(prev => prev + Math.floor(Math.random() * 500 + 100));
                      setNotifications(prev => [{ id: Date.now(), text: `Archivo "${file.name}" procesado exitosamente`, type: "success", time: "Ahora" }, ...prev]);
                    }
                  }}
                  style={{ border: `2px dashed ${t.cardBorder}`, borderRadius: 12, padding: 40, textAlign: "center", transition: "border-color 0.2s", cursor: "pointer" }}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = ".csv,.xlsx,.xls";
                    input.onchange = (e) => {
                      const file = e.target.files[0];
                      if (file) {
                        setUploadedFile(file.name);
                        setDataRows(prev => prev + Math.floor(Math.random() * 500 + 100));
                        setNotifications(prev => [{ id: Date.now(), text: `Archivo "${file.name}" procesado exitosamente`, type: "success", time: "Ahora" }, ...prev]);
                      }
                    };
                    input.click();
                  }}
                >
                  <Upload size={32} color={t.textDim} style={{ marginBottom: 10 }} />
                  <div style={{ fontSize: 12, fontWeight: 600, color: t.text, marginBottom: 4 }}>Arrastra un archivo CSV o Excel aquí</div>
                  <div style={{ fontSize: 10, color: t.textDim }}>o haz clic para seleccionar un archivo</div>
                  {uploadedFile && (
                    <div style={{ marginTop: 12, padding: "8px 14px", borderRadius: 8, background: `${t.green}10`, display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: t.green }}>
                      <CheckCircle size={14} /> {uploadedFile} cargado exitosamente
                    </div>
                  )}
                </div>
              </div>

              {/* Connected sources */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Fuentes de Datos Conectadas</div>
                {[
                  { name: "SIAB (Sistema Bibliotecario)", status: "activo", records: "12,450", lastSync: "Hace 2h", icon: BookOpen, color: t.teal },
                  { name: "Sistema Escolar UACJ", status: "activo", records: "2,110", lastSync: "Hace 24h", icon: GraduationCap, color: t.blue },
                  { name: "Buzón Digital + Encuestas", status: "activo", records: `${comments.length}`, lastSync: "Tiempo real", icon: MessageSquare, color: t.purple },
                ].map((src, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: 14, borderRadius: 12, marginBottom: 8, background: `${t.text}03` }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${src.color}12`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <src.icon size={18} color={src.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{src.name}</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>{src.records} registros · Última sync: {src.lastSync}</div>
                    </div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 600, background: `${t.green}12`, color: t.green }}>
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: t.green, marginRight: 4 }} />
                      Activo
                    </span>
                  </div>
                ))}
              </div>

              {/* Data quality */}
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
                      <div style={{ width: `${q.value}%`, height: "100%", borderRadius: 3, background: q.color, transition: "width 0.8s" }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: q.color, fontFamily: "'Space Mono', monospace", width: 50, textAlign: "right" }}>{q.value}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ===== CONFIGURACIÓN ===== */}
          {nav === "configuracion" && (
            <div>
              {/* Perfil + Apariencia */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

                {/* Perfil de usuario */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.teal}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Users size={18} color={t.teal} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Perfil de Usuario</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Información personal y rol institucional</div>
                    </div>
                  </div>

                  {profileDraft === null ? (
                    <div>
                      <div style={{ display: "flex", gap: 14, marginBottom: 14 }}>
                        <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${t.purple}, ${t.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {userProfile.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: t.text, marginBottom: 2 }}>{userProfile.name}</div>
                          <div style={{ fontSize: 12, color: t.teal, fontWeight: 600, marginBottom: 2 }}>{userProfile.role}</div>
                          <div style={{ fontSize: 11, color: t.textDim }}>{userProfile.institution}</div>
                        </div>
                      </div>
                      <button onClick={() => setProfileDraft({ ...userProfile })}
                        style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 11, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                        Editar perfil
                      </button>
                    </div>
                  ) : (
                    <div>
                      {[
                        { key: "name", label: "Nombre completo" },
                        { key: "role", label: "Cargo" },
                        { key: "institution", label: "Institución" },
                      ].map(field => (
                        <div key={field.key} style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{field.label}</div>
                          <input
                            value={profileDraft[field.key]}
                            onChange={e => setProfileDraft(prev => ({ ...prev, [field.key]: e.target.value }))}
                            style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" }}
                          />
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={() => {
                          setUserProfile(profileDraft);
                          setProfileDraft(null);
                          setNotifications(prev => [{ id: Date.now(), text: "Perfil actualizado correctamente", type: "success", time: "Ahora" }, ...prev]);
                        }}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Guardar
                        </button>
                        <button onClick={() => setProfileDraft(null)}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Apariencia */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.purple}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sliders size={18} color={t.purple} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Apariencia</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Tema, color de acento y visualización</div>
                    </div>
                  </div>

                  {/* Tema */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Tema</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        { id: false, label: "Claro", icon: Sun, preview: "#f6f8fb" },
                        { id: true, label: "Oscuro", icon: Moon, preview: "#0b1120" },
                      ].map(opt => {
                        const Icon = opt.icon;
                        const active = dark === opt.id;
                        return (
                          <button key={String(opt.id)} onClick={() => setDark(opt.id)}
                            style={{ padding: "10px 12px", borderRadius: 10, border: `2px solid ${active ? t.teal : t.cardBorder}`, background: active ? `${t.teal}15` : t.inputBg, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                            <Icon size={14} color={active ? t.teal : t.textDim} />
                            <span style={{ fontSize: 12, fontWeight: active ? 700 : 400, color: active ? t.teal : t.text }}>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color de acento */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 }}>Color de acento</div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {Object.entries(accentPresets).map(([key, val]) => (
                        <button key={key} onClick={() => setAccentPreset(key)} title={val.label}
                          style={{ width: 32, height: 32, borderRadius: "50%", background: val.primary, border: `3px solid ${accentPreset === key ? t.text : "transparent"}`, cursor: "pointer", outline: accentPreset === key ? `2px solid ${val.primary}` : "none", outlineOffset: 2, transition: "all 0.15s" }} />
                      ))}
                    </div>
                    <div style={{ fontSize: 10, color: t.textDim, marginTop: 6 }}>
                      Acento actual: <span style={{ color: accent.primary, fontWeight: 700 }}>{accentPresets[accentPreset].label}</span> — se aplica en toda la interfaz
                    </div>
                  </div>
                </div>
              </div>

              {/* Alertas + Fuentes de datos */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                {/* Alertas y notificaciones */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.amber}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Bell size={18} color={t.amber} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Alertas y Notificaciones</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Umbrales mínimos y tipos de alerta activos</div>
                    </div>
                  </div>

                  {/* Sliders */}
                  <div style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Umbrales de alerta</div>
                    {[
                      { key: "prestamos", label: "Préstamos mínimos / mes", min: 500, max: 2000, step: 50, unit: "" },
                      { key: "satisfaccion", label: "Satisfacción NLP mínima", min: 50, max: 95, step: 1, unit: "%" },
                      { key: "calidad", label: "Calidad de datos mínima", min: 60, max: 100, step: 1, unit: "%" },
                    ].map(s => (
                      <div key={s.key} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: t.text }}>{s.label}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: t.teal }}>{alertThresholds[s.key]}{s.unit}</span>
                        </div>
                        <input type="range" min={s.min} max={s.max} step={s.step}
                          value={alertThresholds[s.key]}
                          onChange={e => setAlertThresholds(prev => ({ ...prev, [s.key]: +e.target.value }))}
                          style={{ width: "100%", accentColor: t.teal, cursor: "pointer" }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: t.textMuted }}>
                          <span>{s.min}{s.unit}</span><span>{s.max}{s.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Toggles */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: t.textDim, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 }}>Tipos de alerta</div>
                    {[
                      { key: "prestamos", label: "Alertas de circulación" },
                      { key: "sentimiento", label: "Alertas de sentimiento NLP" },
                      { key: "calidad", label: "Alertas de calidad de datos" },
                      { key: "uploads", label: "Notificaciones de carga de archivos" },
                    ].map(tog => (
                      <div key={tog.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                        <span style={{ fontSize: 12, color: t.text }}>{tog.label}</span>
                        <button onClick={() => setAlertToggles(prev => ({ ...prev, [tog.key]: !prev[tog.key] }))}
                          style={{ width: 38, height: 20, borderRadius: 10, border: "none", background: alertToggles[tog.key] ? t.teal : `${t.text}20`, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                          <div style={{ position: "absolute", top: 2, left: alertToggles[tog.key] ? 20 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button onClick={() => setNotifications(prev => [{ id: Date.now(), text: "Configuración de alertas guardada", type: "success", time: "Ahora" }, ...prev])}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", marginBottom: 8 }}>
                    Guardar configuración de alertas
                  </button>

                  {/* Botón de prueba push */}
                  <button
                    disabled={testPushState === "sending"}
                    onClick={async () => {
                      setTestPushState("sending"); setTestPushMsg("");
                      try {
                        const sub = await getOwnSubscription();
                        if (!sub) { setTestPushState("error"); setTestPushMsg("No se pudo obtener suscripción. ¿Notificaciones bloqueadas?"); return; }
                        const { sendPush: sp } = await import("./pushNotifications");
                        const result = await sp(sub, "🔔 Prueba de notificación", "Las notificaciones push están funcionando correctamente.");
                        if (result?.ok) { setTestPushState("ok"); setTestPushMsg("Notificación enviada. ¿La recibiste?"); }
                        else { setTestPushState("error"); setTestPushMsg(`Error HTTP ${result?.status ?? "?"}: ${result?.text ?? result?.error ?? "sin detalle"}`); }
                      } catch (e) {
                        setTestPushState("error"); setTestPushMsg(e.message);
                      }
                    }}
                    style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${testPushState === "error" ? "#f87171" : testPushState === "ok" ? "#4ade80" : t.teal}40`, background: "transparent", color: testPushState === "error" ? "#f87171" : testPushState === "ok" ? "#4ade80" : t.teal, fontSize: 12, fontWeight: 600, cursor: testPushState === "sending" ? "wait" : "pointer" }}>
                    {testPushState === "sending" ? "Enviando..." : testPushState === "ok" ? "✓ Enviada" : testPushState === "error" ? "✗ Error" : "🔔 Probar notificación push"}
                  </button>
                  {testPushMsg && (
                    <div style={{ marginTop: 6, fontSize: 10, color: testPushState === "error" ? "#f87171" : "#4ade80", lineHeight: 1.4 }}>{testPushMsg}</div>
                  )}
                </div>

                {/* Fuentes de datos */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.blue}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Globe size={18} color={t.blue} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Fuentes de Datos</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Conexiones a sistemas externos e integraciones</div>
                    </div>
                  </div>

                  {[
                    { id: "siab", label: "SIAB", desc: "Sistema Integral de Automatización de Bibliotecas", url: "https://siab.uacj.mx/api/v2", status: true },
                    { id: "escolar", label: "Sistema Escolar UACJ", desc: "Datos académicos y de matrícula", url: "https://escolares.uacj.mx/api/data", status: true },
                    { id: "buzon", label: "Buzón Digital + Encuestas", desc: "Comentarios y encuestas de satisfacción", url: "https://buzon.uacj.mx/api/feedback", status: false },
                  ].map(src => (
                    <div key={src.id} style={{ marginBottom: 18, paddingBottom: 18, borderBottom: `1px solid ${t.cardBorder}` }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{src.label}</div>
                          <div style={{ fontSize: 10, color: t.textDim }}>{src.desc}</div>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: src.status ? `${t.green}20` : `${t.rose}20`, color: src.status ? t.green : t.rose }}>
                          {src.status ? "Activo" : "Inactivo"}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <input readOnly value={src.url}
                          style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "6px 10px", color: t.textDim, fontSize: 10, outline: "none", fontFamily: "monospace" }} />
                        <button
                          disabled={syncingSource === src.id}
                          onClick={() => {
                            setSyncingSource(src.id);
                            setTimeout(() => {
                              setSyncingSource(null);
                              setNotifications(prev => [{ id: Date.now(), text: `${src.label}: sincronización completada`, type: "info", time: "Ahora" }, ...prev]);
                            }, 1500);
                          }}
                          style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: syncingSource === src.id ? `${t.teal}20` : t.inputBg, color: syncingSource === src.id ? t.teal : t.text, fontSize: 10, fontWeight: 600, cursor: syncingSource === src.id ? "default" : "pointer", display: "flex", alignItems: "center", gap: 4, flexShrink: 0, transition: "all 0.2s" }}>
                          {syncingSource === src.id
                            ? <><RefreshCw size={11} style={{ animation: "spin 1s linear infinite" }} /> Sincronizando…</>
                            : <><RefreshCw size={11} /> Sincronizar</>
                          }
                        </button>
                      </div>
                    </div>
                  ))}

                  <div style={{ padding: "10px 12px", borderRadius: 8, background: `${t.blue}10`, border: `1px solid ${t.blue}30` }}>
                    <div style={{ fontSize: 10, color: t.blue, fontWeight: 600 }}>Fase 2 — Backend</div>
                    <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>Las URLs de conexión serán configurables cuando se integre la API REST con FastAPI + Supabase.</div>
                  </div>
                </div>

              </div>

              {/* Seguridad del kiosco */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.rose}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Shield size={18} color={t.rose} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Seguridad del Panel de Servicios</div>
                    <div style={{ fontSize: 10, color: t.textDim }}>Control de autenticación en terminales de autoservicio</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: 12, background: t.inputBg, border: `1px solid ${pinRequired ? t.teal + "40" : t.cardBorder}` }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 2 }}>Requerir PIN en el Panel de Servicios</div>
                    <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.5 }}>
                      {pinRequired
                        ? "Los alumnos deben ingresar su PIN de 4 dígitos para confirmar su identidad."
                        : "El Panel de Servicios acepta cualquier matrícula registrada sin solicitar PIN."}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const next = !pinRequired;
                      setPinRequired(next);
                      const cfg = { ...loadAppConfig(), pinRequired: next };
                      dbSaveAppConfig(cfg);
                      setNotifications(prev => [{ id: Date.now(), text: `PIN en Panel de Servicios ${next ? "habilitado" : "deshabilitado"}`, type: next ? "success" : "info", time: "Ahora" }, ...prev]);
                    }}
                    style={{ width: 46, height: 24, borderRadius: 12, border: "none", background: pinRequired ? t.teal : `${t.text}20`, cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0, marginLeft: 20 }}>
                    <div style={{ position: "absolute", top: 2, left: pinRequired ? 24 : 2, width: 20, height: 20, borderRadius: "50%", background: "#fff", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
                  </button>
                </div>

                <div style={{ marginTop: 12, padding: "10px 14px", borderRadius: 10, background: pinRequired ? `${t.teal}08` : `${t.rose}08`, border: `1px solid ${pinRequired ? t.teal + "25" : t.rose + "25"}` }}>
                  <div style={{ fontSize: 11, color: pinRequired ? t.teal : t.rose, fontWeight: 600, marginBottom: 2 }}>
                    {pinRequired ? "🔒 PIN activo" : "⚠️ PIN desactivado"}
                  </div>
                  <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.5 }}>
                    {pinRequired
                      ? "Solo el dueño de la matrícula puede reservar. Recomendado para mayor seguridad."
                      : "Cualquier persona que conozca una matrícula puede hacer reservas. Úsalo solo en entornos controlados."}
                  </div>
                </div>
              </div>

              {/* ── Usuarios Registrados ── */}
              {(() => {
                const filtered = alumnos.filter(a =>
                  !userSearch ||
                  a.nombre?.toLowerCase().includes(userSearch.toLowerCase()) ||
                  a.matricula?.toLowerCase().includes(userSearch.toLowerCase()) ||
                  a.carrera?.toLowerCase().includes(userSearch.toLowerCase())
                );
                return (
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, boxShadow: t.shadow, marginTop: 20 }}>

                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, paddingBottom: 14, borderBottom: `1px solid ${t.cardBorder}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: `${t.blue}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Users size={18} color={t.blue} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Usuarios Registrados</div>
                          <div style={{ fontSize: 10, color: t.textDim }}>{alumnos.length} alumno{alumnos.length !== 1 ? "s" : ""} en el sistema</div>
                        </div>
                      </div>
                      {/* Search */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 10, background: t.inputBg, border: `1px solid ${t.cardBorder}`, fontSize: 11 }}>
                        <Search size={12} color={t.textDim} />
                        <input value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Buscar por nombre, matrícula o carrera…"
                          style={{ border: "none", outline: "none", background: "transparent", fontSize: 11, color: t.text, width: 220 }} />
                        {userSearch && <X size={11} color={t.textDim} style={{ cursor: "pointer" }} onClick={() => setUserSearch("")} />}
                      </div>
                    </div>

                    {/* Lista */}
                    {filtered.length === 0 ? (
                      <div style={{ textAlign: "center", padding: "32px 0", color: t.textDim, fontSize: 13 }}>
                        {alumnos.length === 0 ? "No hay usuarios registrados aún." : "Sin resultados para la búsqueda."}
                      </div>
                    ) : (
                      <div>
                        {/* Encabezado de columnas */}
                        <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.2fr auto", gap: 12, padding: "6px 12px", marginBottom: 4 }}>
                          {["Alumno", "Carrera", "Matrícula", "Acciones"].map(h => (
                            <div key={h} style={{ fontSize: 9, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: 1 }}>{h}</div>
                          ))}
                        </div>

                        {filtered.map(a => {
                          const isEditing  = userEditId === a.matricula;
                          const isDeleting = userDeleteId === a.matricula;
                          const initials   = a.nombre?.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "?";
                          const colorIdx   = a.matricula?.charCodeAt(0) % 5;
                          const avatarColor = [t.teal, t.blue, t.purple, t.amber, t.rose][colorIdx];

                          return (
                            <div key={a.matricula} style={{ borderRadius: 12, border: `1px solid ${isEditing ? t.teal + "60" : isDeleting ? t.rose + "50" : t.cardBorder}`, marginBottom: 8, overflow: "hidden", transition: "border-color 0.2s" }}>

                              {/* Fila principal */}
                              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.5fr 1.2fr auto", gap: 12, padding: "10px 14px", alignItems: "center", background: isEditing ? `${t.teal}06` : isDeleting ? `${t.rose}06` : "transparent" }}>
                                {/* Alumno */}
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: `linear-gradient(135deg, ${avatarColor}, ${avatarColor}99)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", flexShrink: 0 }}>{initials}</div>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: t.text }}>{a.nombre || "—"}</div>
                                    <div style={{ fontSize: 10, color: t.textDim }}>{a.email || ""}</div>
                                  </div>
                                </div>
                                {/* Carrera */}
                                <div style={{ fontSize: 11, color: t.textDim, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.carrera || "—"}</div>
                                {/* Matrícula */}
                                <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: t.teal, fontWeight: 700 }}>{a.matricula}</div>
                                {/* Acciones */}
                                <div style={{ display: "flex", gap: 6 }}>
                                  {!isEditing && !isDeleting && (
                                    <>
                                      <button onClick={() => { setUserEditId(a.matricula); setUserEditDraft({ nombre: a.nombre || "", carrera: a.carrera || "" }); setUserDeleteId(null); }}
                                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Edit3 size={11} /> Editar
                                      </button>
                                      <button onClick={() => { setUserDeleteId(a.matricula); setUserEditId(null); }}
                                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${t.rose}40`, background: `${t.rose}10`, color: t.rose, fontSize: 10, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                                        <Trash2 size={11} /> Eliminar
                                      </button>
                                    </>
                                  )}
                                  {isEditing && (
                                    <>
                                      <button onClick={async () => {
                                        const updated = { ...a, nombre: userEditDraft.nombre, carrera: userEditDraft.carrera };
                                        await dbUpdateAlumno(updated);
                                        setAlumnos(prev => prev.map(u => u.matricula === a.matricula ? updated : u));
                                        setUserEditId(null);
                                        setNotifications(prev => [{ id: Date.now(), text: `Alumno ${a.matricula} actualizado`, type: "success", time: "Ahora" }, ...prev]);
                                      }}
                                        style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                        Guardar
                                      </button>
                                      <button onClick={() => setUserEditId(null)}
                                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 10, cursor: "pointer" }}>
                                        Cancelar
                                      </button>
                                    </>
                                  )}
                                  {isDeleting && (
                                    <>
                                      <button onClick={async () => {
                                        await dbDeleteAlumno(a.matricula);
                                        setAlumnos(prev => prev.filter(u => u.matricula !== a.matricula));
                                        setUserDeleteId(null);
                                        setNotifications(prev => [{ id: Date.now(), text: `Alumno ${a.matricula} eliminado`, type: "warn", time: "Ahora" }, ...prev]);
                                      }}
                                        style={{ padding: "5px 12px", borderRadius: 7, border: "none", background: t.rose, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                        Confirmar
                                      </button>
                                      <button onClick={() => setUserDeleteId(null)}
                                        style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 10, cursor: "pointer" }}>
                                        Cancelar
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Panel de edición inline */}
                              {isEditing && (
                                <div style={{ padding: "12px 14px", background: `${t.teal}08`, borderTop: `1px solid ${t.teal}30`, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                                  {[
                                    { key: "nombre", label: "Nombre completo", placeholder: "Nombre del alumno" },
                                    { key: "carrera", label: "Carrera", placeholder: "Ej. Ing. Sistemas" },
                                  ].map(f => (
                                    <div key={f.key}>
                                      <div style={{ fontSize: 9, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: .8, marginBottom: 4 }}>{f.label}</div>
                                      <input value={userEditDraft[f.key]} onChange={e => setUserEditDraft(p => ({ ...p, [f.key]: e.target.value }))}
                                        placeholder={f.placeholder}
                                        style={{ width: "100%", background: t.card, border: `1px solid ${t.teal}50`, borderRadius: 8, padding: "7px 10px", color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Panel de confirmación de eliminación */}
                              {isDeleting && (
                                <div style={{ padding: "10px 14px", background: `${t.rose}08`, borderTop: `1px solid ${t.rose}30`, fontSize: 11, color: t.rose }}>
                                  ⚠ ¿Eliminar a <strong>{a.nombre}</strong> ({a.matricula}) permanentemente? Esta acción no se puede deshacer.
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Pie */}
                        <div style={{ marginTop: 8, fontSize: 10, color: t.textDim, textAlign: "right" }}>
                          Mostrando {filtered.length} de {alumnos.length} usuario{alumnos.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}

            </div>
          )}

          {/* ===== HERRAMIENTAS ===== */}
          {nav === "herramientas" && (
            <div>
              {/* Tool sub-nav */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, alignItems: "center", flexWrap: "wrap" }}>
                {[
                  { id: "cubiculos",    icon: Layers,   label: "Cubículos" },
                  { id: "computadoras", icon: Monitor,  label: "Computadoras" },
                  { id: "qr",           icon: QrCode,   label: "Códigos QR" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setHerrTool(tab.id)}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: `1px solid ${herrTool === tab.id ? t.teal : t.cardBorder}`, background: herrTool === tab.id ? `${t.teal}15` : t.inputBg, color: herrTool === tab.id ? t.teal : t.textDim, fontSize: 12, fontWeight: herrTool === tab.id ? 700 : 400, cursor: "pointer" }}>
                    <tab.icon size={14} /> {tab.label}
                  </button>
                ))}
                <button style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.textDim, fontSize: 12, cursor: "not-allowed", opacity: 0.5 }}>
                  <MessageSquare size={14} /> Encuesta (próximo)
                </button>
                <div style={{ marginLeft: "auto" }}>
                  <button onClick={() => window.open("/kiosco", "_blank")}
                    style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 18px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                    <Eye size={14} /> Abrir Terminal
                  </button>
                </div>
              </div>

              {herrTool === "cubiculos" && (<>

              {/* KPI row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 20 }}>
                <StatCard icon={Layers}       label="Total Cubículos"  value={String(cubiculos.length)} color={t.teal}  t={t} />
                <StatCard icon={CheckCircle}  label="Disponibles"      value={String(cubiLibres)}        color={t.green} t={t} />
                <StatCard icon={Activity}     label="Ocupado"           value={String(cubiOcupados)}      color={t.rose}  t={t} />
                <StatCard icon={Clock}        label="Reservados"       value={String(cubiReservados)}    color={t.amber} t={t} />
                <StatCard icon={Target}       label="Tasa de Uso"      value={`${cubiTasaUso}%`}         color={t.blue}  t={t} />
              </div>

              {/* Grid + Action panel */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>

                {/* Cubicle grid */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Plano de Cubículos</div>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[{ v: 0, l: "Todos" }, { v: 1, l: "Piso 1" }, { v: 2, l: "Piso 2" }].map(p => (
                        <button key={p.v} onClick={() => setCubiPisoFilter(p.v)}
                          style={{ padding: "4px 12px", borderRadius: 8, border: `1px solid ${cubiPisoFilter === p.v ? t.teal : t.cardBorder}`, background: cubiPisoFilter === p.v ? `${t.teal}15` : t.inputBg, color: cubiPisoFilter === p.v ? t.teal : t.textDim, fontSize: 11, fontWeight: cubiPisoFilter === p.v ? 700 : 400, cursor: "pointer" }}>
                          {p.l}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Legend */}
                  <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
                    {[["libre", t.green, "Libre"], ["ocupado", t.rose, "Ocupado"], ["reservado", t.amber, "Reservado"]].map(([k, c, l]) => (
                      <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textDim }}>
                        <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
                      </div>
                    ))}
                  </div>

                  {/* Grid cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
                    {cubiFiltered.map(cubi => {
                      const cfg = { libre: { color: t.green, bg: `${t.green}12` }, ocupado: { color: t.rose, bg: `${t.rose}12` }, reservado: { color: t.amber, bg: `${t.amber}12` } }[cubi.estado];
                      const isSelected = cubiSelectedId === cubi.id;
                      return (
                        <button key={cubi.id} onClick={() => setCubiSelectedId(isSelected ? null : cubi.id)}
                          style={{ padding: "20px 12px", borderRadius: 14, border: `2px solid ${isSelected ? cfg.color : `${t.cardBorder}`}`, background: isSelected ? cfg.bg : `${t.text}03`, cursor: "pointer", textAlign: "center", transition: "all 0.15s", outline: "none" }}>
                          {cubi.estado !== "libre" && cubi.reserva ? (() => {
                            const isPending = cubi.estado === "reservado" && cubi.reserva.pendingCheckin;
                            let total, rem;
                            if (isPending) {
                              total = 5 * 60 * 1000;
                              const ra = cubi.reserva.reservedAt ? new Date(cubi.reserva.reservedAt).getTime() : serverNow();
                              rem = Math.max(0, total - (serverNow() - ra));
                            } else {
                              total = cubi.reserva.duracion * 3_600_000;
                              rem = getCubiRemainingMs(cubi);
                            }
                            const pct = total > 0 ? Math.max(0, rem / total) : 0;
                            const S = 52, R = 20, CIRC = 2 * Math.PI * R;
                            const mins = Math.floor(rem / 60000);
                            const secs = Math.floor((rem % 60000) / 1000);
                            const label = isPending
                              ? (mins > 0 ? `${mins}m` : `${secs}s`)
                              : (mins >= 60 ? (mins % 60 === 0 ? `${Math.floor(mins/60)}h` : `${Math.floor(mins/60)}h${mins%60}m`) : `${mins}m`);
                            return (
                              <div style={{ position: "relative", width: S, height: S, margin: "0 auto 10px" }}>
                                <svg width={S} height={S} style={{ transform: "rotate(-90deg)" }}>
                                  <circle cx={S/2} cy={S/2} r={R} fill="none" stroke={`${cfg.color}20`} strokeWidth={4} />
                                  <circle cx={S/2} cy={S/2} r={R} fill="none" stroke={cfg.color} strokeWidth={4}
                                    strokeDasharray={`${pct * CIRC} ${CIRC}`} strokeLinecap="round"
                                    style={{ transition: "stroke-dasharray 1s linear" }} />
                                </svg>
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: cfg.color, fontFamily: "'Space Mono', monospace" }}>
                                  {label}
                                </div>
                              </div>
                            );
                          })() : (
                            <div style={{ width: 48, height: 48, borderRadius: 12, background: cfg.bg, border: `1.5px solid ${cfg.color}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}>
                              <Layers size={20} color={cfg.color} />
                            </div>
                          )}
                          <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>{cubi.nombre}</div>
                          <div style={{ fontSize: 11, color: t.textDim, margin: "3px 0" }}>Cap. {cubi.capacidad}</div>
                          <div style={{ fontSize: 10, fontWeight: 700, color: cfg.color, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>{cubi.estado === "libre" ? "Libre" : "Ocupado"}</div>
                          {cubi.reserva && (() => {
                            const isPending = cubi.estado === "reservado" && cubi.reserva.pendingCheckin;
                            const mat = cubi.reserva.matricula || "—";
                            const car = cubi.reserva.carrera || "";
                            if (isPending || !cubi.reserva.inicio) {
                              return (
                                <div style={{ borderTop: `1px solid ${cfg.color}20`, paddingTop: 6, marginTop: 2 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Space Mono', monospace" }}>{mat}</div>
                                  <div style={{ fontSize: 9, color: t.textDim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{car}</div>
                                  <div style={{ fontSize: 10, color: cfg.color, marginTop: 2 }}>En camino…</div>
                                </div>
                              );
                            }
                            const fmtT = d => new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                            const fin = new Date(new Date(cubi.reserva.inicio).getTime() + cubi.reserva.duracion * 3_600_000);
                            return (
                              <div style={{ borderTop: `1px solid ${cfg.color}20`, paddingTop: 6, marginTop: 2 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Space Mono', monospace" }}>{mat}</div>
                                <div style={{ fontSize: 9, color: t.textDim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{car}</div>
                                <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{fmtT(cubi.reserva.inicio)}–{fmtT(fin)}</div>
                              </div>
                            );
                          })()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action panel */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  {!cubiSelected && (
                    <div style={{ height: "100%", minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 14, background: `${t.teal}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Layers size={24} color={t.textMuted} />
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: t.textDim }}>Selecciona un cubículo</div>
                      <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center", lineHeight: 1.5 }}>Haz clic en cualquier cubículo del plano para ver sus detalles o crear una reserva</div>
                    </div>
                  )}

                  {cubiSelected && (
                    <div>
                      {/* Header */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                        <div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{cubiSelected.nombre}</div>
                          <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>Piso {cubiSelected.piso} · Capacidad {cubiSelected.capacidad} personas</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ padding: "4px 12px", borderRadius: 20, background: cubiSelected.estado === "libre" ? `${t.green}15` : cubiSelected.estado === "ocupado" ? `${t.rose}15` : `${t.amber}15`, color: cubiSelected.estado === "libre" ? t.green : cubiSelected.estado === "ocupado" ? t.rose : t.amber, fontSize: 11, fontWeight: 700 }}>
                            {cubiSelected.estado === "libre" ? "Libre" : cubiSelected.estado === "ocupado" ? "Ocupado" : "Reservado"}
                          </span>
                          <button
                            onClick={() => { setCubiEditMode(true); setCubiEditDraft({ nombre: cubiSelected.nombre, capacidad: cubiSelected.capacidad, piso: cubiSelected.piso }); }}
                            title="Editar cubículo"
                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.teal}50`, background: `${t.teal}10`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Edit2 size={12} color={t.teal} />
                          </button>
                          <button onClick={() => { setCubiSelectedId(null); setCubiEditMode(false); setCubiEditDraft(null); }}
                            style={{ width: 28, height: 28, borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: t.inputBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <X size={12} color={t.textDim} />
                          </button>
                        </div>
                      </div>

                      {/* MODO EDICIÓN */}
                      {cubiEditMode && cubiEditDraft && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Editar cubículo</div>
                          {/* Nombre */}
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Nombre</div>
                            <input value={cubiEditDraft.nombre}
                              onChange={e => setCubiEditDraft(p => ({ ...p, nombre: e.target.value }))}
                              style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.teal}60`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          {/* Capacidad */}
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Capacidad (personas)</div>
                            <input type="number" min={1} max={30} value={cubiEditDraft.capacidad}
                              onChange={e => setCubiEditDraft(p => ({ ...p, capacidad: parseInt(e.target.value) || 1 }))}
                              style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.teal}60`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                          </div>
                          {/* Piso */}
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Piso</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {[1, 2].map(p => (
                                <button key={p} onClick={() => setCubiEditDraft(prev => ({ ...prev, piso: p }))}
                                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${cubiEditDraft.piso === p ? t.teal : t.cardBorder}`, background: cubiEditDraft.piso === p ? `${t.teal}15` : t.inputBg, color: cubiEditDraft.piso === p ? t.teal : t.textDim, fontSize: 13, fontWeight: cubiEditDraft.piso === p ? 700 : 400, cursor: "pointer" }}>
                                  Piso {p}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setCubiEditMode(false); setCubiEditDraft(null); }}
                              style={{ flex: 1, padding: "10px 0", borderRadius: 9, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.textDim, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                              Cancelar
                            </button>
                            <button onClick={() => {
                              if (!cubiEditDraft.nombre.trim()) return;
                              const updated = { ...cubiSelected, nombre: cubiEditDraft.nombre.trim(), capacidad: cubiEditDraft.capacidad, piso: cubiEditDraft.piso };
                              setCubiculos(prev => prev.map(c => c.id === cubiSelectedId ? updated : c));
                              dbSaveCubiculo(updated);
                              setCubiEditMode(false);
                              setCubiEditDraft(null);
                              setNotifications(prev => [{ id: Date.now(), text: `Cubículo ${updated.nombre} actualizado`, type: "success", time: "Ahora" }, ...prev]);
                            }}
                              style={{ flex: 2, padding: "10px 0", borderRadius: 9, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              Guardar cambios
                            </button>
                          </div>
                        </div>
                      )}

                      {/* LIBRE → form */}
                      {!cubiEditMode && cubiSelected.estado === "libre" && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Nueva Reserva</div>
                          {[{ key: "nombre", label: "Nombre completo", placeholder: "Ej. Juan Pérez" }, { key: "matricula", label: "No. Matrícula", placeholder: "Ej. A201234" }].map(f => (
                            <div key={f.key} style={{ marginBottom: 10 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.label}</div>
                              <input value={cubiReservaForm[f.key]} onChange={e => setCubiReservaForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                placeholder={f.placeholder}
                                style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                            </div>
                          ))}
                          <div style={{ marginBottom: 10 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Carrera</div>
                            <select value={cubiReservaForm.carrera} onChange={e => setCubiReservaForm(prev => ({ ...prev, carrera: e.target.value }))}
                              style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 12, outline: "none" }}>
                              {carreras.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                          </div>
                          <div style={{ marginBottom: 16 }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Duración</div>
                            <div style={{ display: "flex", gap: 6 }}>
                              {[1, 2, 3].map(h => (
                                <button key={h} onClick={() => setCubiReservaForm(prev => ({ ...prev, duracion: h }))}
                                  style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${cubiReservaForm.duracion === h ? t.teal : t.cardBorder}`, background: cubiReservaForm.duracion === h ? `${t.teal}15` : t.inputBg, color: cubiReservaForm.duracion === h ? t.teal : t.textDim, fontSize: 13, fontWeight: cubiReservaForm.duracion === h ? 700 : 400, cursor: "pointer" }}>
                                  {h}h
                                </button>
                              ))}
                            </div>
                          </div>
                          <button onClick={() => {
                            if (!cubiReservaForm.nombre.trim() || !cubiReservaForm.matricula.trim()) return;
                            const nombre = cubiSelected.nombre;
                            const updated = { ...cubiSelected, estado: "ocupado", reserva: { ...cubiReservaForm, inicio: new Date(serverNow()) } };
                            setCubiculos(prev => prev.map(c => c.id === cubiSelectedId ? updated : c));
                            dbSaveCubiculo(updated);
                            setCubiHistorial(prev => [{ id: Date.now(), cubicule: nombre, ...cubiReservaForm, inicio: new Date(serverNow()), estado: "activo" }, ...prev]);
                            setCubiReservaForm({ nombre: "", matricula: "", carrera: "Ing. Software", duracion: 2 });
                            setCubiSelectedId(null);
                            setNotifications(prev => [{ id: Date.now(), text: `Cubículo ${nombre} asignado a ${cubiReservaForm.nombre}`, type: "success", time: "Ahora" }, ...prev]);
                          }}
                            style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            Confirmar Reserva
                          </button>
                        </div>
                      )}

                      {/* OCUPADO / RESERVADO → detail + liberar */}
                      {!cubiEditMode && cubiSelected.estado !== "libre" && cubiSelected.reserva && (
                        <div>
                          <div style={{ background: t.inputBg, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                            {[
                              ["Matrícula",  cubiSelected.reserva.matricula],
                              ["Carrera",     cubiSelected.reserva.carrera],
                              ["Duración",    `${cubiSelected.reserva.duracion}h`],
                              ["Entrada",     cubiSelected.reserva.inicio instanceof Date
                                ? cubiSelected.reserva.inicio.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })
                                : "—"],
                            ].map(([k, v]) => (
                              <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                                <span style={{ fontSize: 11, color: t.textDim }}>{k}</span>
                                <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{v}</span>
                              </div>
                            ))}
                            {cubiSelected.reserva.inicio instanceof Date && (() => {
                              const elapsed  = Math.floor((serverNow() - cubiSelected.reserva.inicio.getTime()) / 60000);
                              const total    = cubiSelected.reserva.duracion * 60;
                              const remaining = Math.max(0, total - elapsed);
                              const pct      = Math.min(100, (elapsed / total) * 100);
                              return (
                                <div style={{ marginTop: 10 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                    <span style={{ fontSize: 10, color: t.textDim }}>Tiempo</span>
                                    <span style={{ fontSize: 10, fontWeight: 700, color: remaining < 15 ? t.rose : t.green }}>
                                      {remaining > 0 ? `${remaining} min restantes` : "Tiempo vencido"}
                                    </span>
                                  </div>
                                  <div style={{ width: "100%", height: 6, borderRadius: 3, background: `${t.text}08` }}>
                                    <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: remaining < 15 ? t.rose : t.teal, transition: "width 0.5s" }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                          <button onClick={() => {
                            const nombre = cubiSelected.nombre;
                            const res = cubiSelected.reserva;
                            const finNow = new Date(serverNow());
                            const completed = { id: Date.now(), cubicule: nombre, ...res, estado: "completado" };
                            const updated = { ...cubiSelected, estado: "libre", reserva: null };
                            setCubiculos(prev => prev.map(c => c.id === cubiSelectedId ? updated : c));
                            dbSaveCubiculo(updated);
                            dbSaveHistorialReserva({
                              cubicule: nombre, tipo: 'cubiculos',
                              nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
                              duracion: res.duracion, personas: res.personas || null, piso: cubiSelected.piso,
                              inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
                              fin: finNow.toISOString(), turno: calcTurno(res.inicio),
                            }).then(() => dbLoadHistorialReservas().then(d => setHistorialReservas(d)));
                            setCubiHistorial(prev => [completed, ...prev]);
                            setCubiSelectedId(null);
                            setNotifications(prev => [{ id: Date.now(), text: `Cubículo ${nombre} liberado`, type: "info", time: "Ahora" }, ...prev]);
                          }}
                            style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px solid ${t.rose}`, background: `${t.rose}10`, color: t.rose, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            Liberar Cubículo
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Reservas activas */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}`, marginBottom: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Reservas Activas ({cubiActivas.length})</div>
                {cubiActivas.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: t.textDim, fontSize: 12 }}>No hay reservas activas en este momento</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          {["Cubículo", "Matrícula", "Carrera", "Duración", "Estado", ""].map(h => (
                            <th key={h} style={{ textAlign: "left", fontSize: 10, fontWeight: 700, color: t.textDim, padding: "6px 14px", textTransform: "uppercase", letterSpacing: 0.8, borderBottom: `1px solid ${t.cardBorder}` }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cubiActivas.map(c => {
                          const eColor = c.estado === "ocupado" ? t.rose : t.amber;
                          const eLabel = c.estado === "ocupado" ? "Ocupado" : "Reservado";
                          return (
                            <tr key={c.id} style={{ borderBottom: `1px solid ${t.cardBorder}` }}>
                              <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: t.teal }}>{c.nombre}</td>
                              <td style={{ padding: "10px 14px", fontSize: 11, color: t.textDim, fontFamily: "'Space Mono', monospace" }}>{c.reserva.matricula}</td>
                              <td style={{ padding: "10px 14px", fontSize: 11, color: t.textDim }}>{c.reserva.carrera}</td>
                              <td style={{ padding: "10px 14px", fontSize: 11, color: t.text, fontWeight: 600 }}>{c.reserva.duracion}h</td>
                              <td style={{ padding: "10px 14px" }}>
                                <span style={{ padding: "3px 10px", borderRadius: 20, background: `${eColor}15`, color: eColor, fontSize: 10, fontWeight: 700 }}>{eLabel}</span>
                              </td>
                              <td style={{ padding: "10px 14px" }}>
                                <button onClick={() => setCubiSelectedId(c.id)}
                                  style={{ padding: "5px 14px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                                  Ver
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Configuración del servicio + Alumnos registrados */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

                {/* Config */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.purple}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Sliders size={17} color={t.purple} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Configuración del Servicio</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Límites de personas por cubículo</div>
                    </div>
                  </div>
                  {cubiConfigDraft === null ? (
                    <div>
                      {[["Mínimo de personas", cubiConfig.minPersonas], ["Máximo de personas", cubiConfig.maxPersonas]].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                          <span style={{ fontSize: 12, color: t.textDim }}>{label}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: t.teal, fontFamily: "'Space Mono', monospace" }}>{val}</span>
                        </div>
                      ))}
                      <button onClick={() => setCubiConfigDraft({ ...cubiConfig })}
                        style={{ marginTop: 14, width: "100%", padding: "9px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                        Editar
                      </button>
                    </div>
                  ) : (
                    <div>
                      {[
                        { key: "minPersonas", label: "Mínimo de personas", min: 1, max: cubiConfigDraft.maxPersonas - 1 },
                        { key: "maxPersonas", label: "Máximo de personas", min: cubiConfigDraft.minPersonas + 1, max: 20 },
                      ].map(f => (
                        <div key={f.key} style={{ marginBottom: 14 }}>
                          <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.label}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <button onClick={() => setCubiConfigDraft(prev => ({ ...prev, [f.key]: Math.max(f.min, prev[f.key] - 1) }))}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                            <span style={{ flex: 1, textAlign: "center", fontSize: 22, fontWeight: 800, color: t.teal, fontFamily: "'Space Mono', monospace" }}>{cubiConfigDraft[f.key]}</span>
                            <button onClick={() => setCubiConfigDraft(prev => ({ ...prev, [f.key]: Math.min(f.max, prev[f.key] + 1) }))}
                              style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                          </div>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                        <button onClick={() => { setCubiConfig(cubiConfigDraft); setCubiConfigDraft(null); setNotifications(prev => [{ id: Date.now(), text: "Configuración de cubículos actualizada", type: "success", time: "Ahora" }, ...prev]); }}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Guardar</button>
                        <button onClick={() => setCubiConfigDraft(null)}
                          style={{ flex: 1, padding: "9px 0", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancelar</button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Gestión de Espacios */}
                <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.teal}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Layers size={17} color={t.teal} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Gestión de Espacios</div>
                      <div style={{ fontSize: 10, color: t.textDim }}>Agregar o quitar cubículos</div>
                    </div>
                  </div>

                  {/* Agregar cubículo */}
                  <div style={{ background: t.inputBg, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Nuevo cubículo</div>

                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Nombre / Código</div>
                      <input
                        value={cubiNuevoForm.nombre}
                        onChange={e => setCubiNuevoForm(p => ({ ...p, nombre: e.target.value }))}
                        placeholder={`C-${String(cubiculos.length + 1).padStart(2,"0")}`}
                        style={{ width: "100%", background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }}
                      />
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Capacidad</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[4, 6, 8].map(n => (
                            <button key={n} onClick={() => setCubiNuevoForm(p => ({ ...p, capacidad: n }))}
                              style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `1px solid ${cubiNuevoForm.capacidad === n ? t.teal : t.cardBorder}`, background: cubiNuevoForm.capacidad === n ? `${t.teal}20` : t.card, color: cubiNuevoForm.capacidad === n ? t.teal : t.textDim, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Piso</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[1, 2].map(n => (
                            <button key={n} onClick={() => setCubiNuevoForm(p => ({ ...p, piso: n }))}
                              style={{ flex: 1, padding: "6px 0", borderRadius: 7, border: `1px solid ${cubiNuevoForm.piso === n ? t.teal : t.cardBorder}`, background: cubiNuevoForm.piso === n ? `${t.teal}20` : t.card, color: cubiNuevoForm.piso === n ? t.teal : t.textDim, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                              Piso {n}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <button onClick={() => {
                      const nombre = cubiNuevoForm.nombre.trim() || `C-${String(cubiculos.length + 1).padStart(2,"0")}`;
                      const newId  = Math.max(...cubiculos.map(c => c.id), 0) + 1;
                      const nuevo  = { id: newId, nombre, capacidad: cubiNuevoForm.capacidad, piso: cubiNuevoForm.piso, estado: "libre", reserva: null };
                      setCubiculos(prev => [...prev, nuevo]);
                      dbSaveCubiculo(nuevo);
                      setCubiNuevoForm({ nombre: "", capacidad: 4, piso: 1 });
                      setNotifications(prev => [{ id: Date.now(), text: `Cubículo ${nombre} agregado (Piso ${cubiNuevoForm.piso}, cap. ${cubiNuevoForm.capacidad})`, type: "success", time: "Ahora" }, ...prev]);
                    }}
                      style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      + Agregar
                    </button>
                  </div>

                  {/* Lista de cubículos con opción de quitar */}
                  <div style={{ fontSize: 10, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                    Cubículos actuales ({cubiculos.length})
                  </div>
                  <div style={{ overflowY: "auto", maxHeight: 200 }}>
                    {cubiculos.map(c => {
                      const isLibre = c.estado === "libre";
                      return (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: isLibre ? t.green : c.estado === "ocupado" ? t.rose : t.amber, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: "'Space Mono', monospace", minWidth: 40 }}>{c.nombre}</span>
                          <span style={{ fontSize: 10, color: t.textDim, flex: 1 }}>P{c.piso} · {c.capacidad} pers.</span>
                          <button
                            disabled={!isLibre}
                            title={isLibre ? "Quitar cubículo" : "Solo se pueden quitar cubículos libres"}
                            onClick={() => {
                              if (!isLibre) return;
                              setCubiculos(prev => prev.filter(x => x.id !== c.id));
                              dbDeleteCubiculo(c.id);
                              if (cubiSelectedId === c.id) setCubiSelectedId(null);
                              setNotifications(prev => [{ id: Date.now(), text: `Cubículo ${c.nombre} eliminado`, type: "info", time: "Ahora" }, ...prev]);
                            }}
                            style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${isLibre ? t.rose : t.cardBorder}`, background: isLibre ? `${t.rose}12` : "transparent", color: isLibre ? t.rose : t.textDim, fontSize: 14, cursor: isLibre ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isLibre ? 1 : 0.4 }}>
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Alumnos registrados */}
                {(() => {
                  return (
                    <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.blue}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Users size={17} color={t.blue} />
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Alumnos Registrados</div>
                          <div style={{ fontSize: 10, color: t.textDim }}>{alumnos.length} cuenta{alumnos.length !== 1 ? "s" : ""} activa{alumnos.length !== 1 ? "s" : ""}</div>
                        </div>
                      </div>
                      {alumnos.length === 0 ? (
                        <div style={{ textAlign: "center", padding: "20px 0", color: t.textDim, fontSize: 12 }}>
                          Ningún alumno registrado aún.<br />
                          <span style={{ fontSize: 11, color: t.textMuted }}>Los alumnos se registran en /registro</span>
                        </div>
                      ) : (
                        <div style={{ overflowY: "auto", maxHeight: 180 }}>
                          {alumnos.map((a, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                              <div style={{ width: 30, height: 30, borderRadius: "50%", background: `linear-gradient(135deg, ${t.purple}, ${t.blue})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                                {a.nombre.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{a.nombre}</div>
                                <div style={{ fontSize: 10, color: t.textDim }}>{a.carrera} · <span style={{ fontFamily: "'Space Mono', monospace" }}>{a.matricula}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Historial */}
              <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Historial Reciente</div>
                {cubiHistorial.length === 0 && (
                  <div style={{ textAlign: "center", padding: "16px 0", color: t.textDim, fontSize: 12 }}>Sin historial aún</div>
                )}
                {cubiHistorial.slice(0, 10).map(h => (
                  <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.teal}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Layers size={15} color={t.teal} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{h.cubicule} — {h.nombre}</div>
                      <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>{h.matricula} · {h.carrera} · {h.duracion}h</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: h.estado === "completado" ? `${t.green}15` : `${t.teal}15`, color: h.estado === "completado" ? t.green : t.teal }}>
                        {h.estado === "completado" ? "Completado" : "Activo"}
                      </span>
                      <div style={{ fontSize: 9, color: t.textMuted, marginTop: 3 }}>
                        {h.inicio instanceof Date ? timeAgo(h.inicio) : "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              </>)}

              {/* ===== COMPUTADORAS ===== */}
              {herrTool === "computadoras" && (<>

                {/* KPI row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginBottom: 20 }}>
                  <StatCard icon={Monitor}     label="Total Equipos"  value={String(computadoras.length)} color={t.teal} t={t} />
                  <StatCard icon={CheckCircle} label="Disponibles"    value={String(computadoras.filter(c => c.estado === "libre").length)} color={t.green} t={t} />
                  <StatCard icon={Activity}    label="Ocupado"         value={String(computadoras.filter(c => c.estado === "ocupado").length)} color={t.rose} t={t} />
                  <StatCard icon={Wrench}      label="Mantenimiento"  value={String(computadoras.filter(c => c.estado === "mantenimiento").length)} color={t.amber} t={t} />
                  <StatCard icon={Target}      label="Tasa de Uso"    value={`${computadoras.length ? Math.round((computadoras.filter(c => c.estado === "ocupado").length / computadoras.length) * 100) : 0}%`} color={t.blue} t={t} />
                </div>

                {/* Grid + Action panel */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 }}>

                  {/* Computer grid */}
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Sala de Cómputo</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {["Todas", ...compuZonas].map(z => (
                          <button key={z} onClick={() => setCompuZonaFilter(z)}
                            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${compuZonaFilter === z ? t.teal : t.cardBorder}`, background: compuZonaFilter === z ? `${t.teal}15` : t.inputBg, color: compuZonaFilter === z ? t.teal : t.textDim, fontSize: 10, fontWeight: compuZonaFilter === z ? 700 : 400, cursor: "pointer" }}>
                            {z}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Legend */}
                    <div style={{ display: "flex", gap: 18, marginBottom: 16 }}>
                      {[["libre", t.green, "Libre"], ["ocupado", t.rose, "Ocupado"], ["mantenimiento", t.amber, "Mantenimiento"]].map(([k, c, l]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: t.textDim }}>
                          <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{l}
                        </div>
                      ))}
                    </div>

                    {/* Grid cards */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                      {(compuZonaFilter === "Todas" ? computadoras : computadoras.filter(c => c.zona === compuZonaFilter)).map(pc => {
                        const cfg = { libre: { color: t.green, bg: `${t.green}12` }, ocupado: { color: t.rose, bg: `${t.rose}12` }, mantenimiento: { color: t.amber, bg: `${t.amber}12` } }[pc.estado] || { color: t.textDim, bg: `${t.text}08` };
                        const isSelected = compuSelectedId === pc.id;
                        return (
                          <button key={pc.id} onClick={() => setCompuSelectedId(isSelected ? null : pc.id)}
                            style={{ padding: "18px 10px", borderRadius: 12, border: `2px solid ${isSelected ? cfg.color : t.cardBorder}`, background: isSelected ? cfg.bg : `${t.text}03`, cursor: "pointer", textAlign: "center", transition: "all 0.15s", outline: "none" }}>
                            {pc.estado === "ocupado" && pc.reserva ? (() => {
                              const total = pc.reserva.duracion * 3_600_000;
                              const inicio = pc.reserva.inicio instanceof Date ? pc.reserva.inicio : new Date(pc.reserva.inicio);
                              const rem = Math.max(0, inicio.getTime() + total - serverNow());
                              const pct = total > 0 ? Math.max(0, rem / total) : 0;
                              const S = 48, R = 18, CIRC = 2 * Math.PI * R;
                              const mins = Math.floor(rem / 60000);
                              const hh2 = Math.floor(mins / 60), mm2 = mins % 60;
                              const label = mins >= 60 ? (mm2 === 0 ? `${hh2}h` : `${hh2}h${mm2}m`) : `${mins}m`;
                              return (
                                <div style={{ position: "relative", width: S, height: S, margin: "0 auto 8px" }}>
                                  <svg width={S} height={S} style={{ transform: "rotate(-90deg)" }}>
                                    <circle cx={S/2} cy={S/2} r={R} fill="none" stroke={`${cfg.color}20`} strokeWidth={4} />
                                    <circle cx={S/2} cy={S/2} r={R} fill="none" stroke={cfg.color} strokeWidth={4}
                                      strokeDasharray={`${pct * CIRC} ${CIRC}`} strokeLinecap="round"
                                      style={{ transition: "stroke-dasharray 1s linear" }} />
                                  </svg>
                                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: cfg.color, fontFamily: "'Space Mono', monospace" }}>
                                    {label}
                                  </div>
                                </div>
                              );
                            })() : (
                              <div style={{ width: 42, height: 42, borderRadius: 11, background: cfg.bg, border: `1.5px solid ${cfg.color}50`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 8px" }}>
                                {pc.estado === "mantenimiento" ? <Wrench size={18} color={cfg.color} /> : <Monitor size={18} color={cfg.color} />}
                              </div>
                            )}
                            <div style={{ fontSize: 13, fontWeight: 700, color: t.text, lineHeight: 1.2 }}>{pc.nombre}</div>
                            <div style={{ fontSize: 11, color: cfg.color, fontWeight: 700, textTransform: "uppercase", marginTop: 3, letterSpacing: 0.3, marginBottom: 4 }}>
                              {pc.estado === "mantenimiento" ? "Mant." : pc.estado === "ocupado" ? "Ocupado" : "Libre"}
                            </div>
                            {pc.estado === "ocupado" && pc.reserva && (() => {
                              const fmtT = d => new Date(d).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                              const fin = new Date(new Date(pc.reserva.inicio).getTime() + pc.reserva.duracion * 3_600_000);
                              return (
                                <div style={{ borderTop: `1px solid ${cfg.color}20`, paddingTop: 5 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: "'Space Mono', monospace" }}>{pc.reserva.matricula || "—"}</div>
                                  <div style={{ fontSize: 9, color: t.textDim, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{pc.reserva.carrera || ""}</div>
                                  <div style={{ fontSize: 10, color: t.textDim, fontFamily: "'Space Mono', monospace", marginTop: 2 }}>{fmtT(pc.reserva.inicio)}–{fmtT(fin)}</div>
                                </div>
                              );
                            })()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Action panel */}
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    {!computadoras.find(c => c.id === compuSelectedId) && (
                      <div style={{ height: "100%", minHeight: 320, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                        <div style={{ width: 52, height: 52, borderRadius: 14, background: `${t.teal}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Monitor size={24} color={t.textMuted} />
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: t.textDim }}>Selecciona un equipo</div>
                        <div style={{ fontSize: 11, color: t.textMuted, textAlign: "center", lineHeight: 1.5 }}>Haz clic en cualquier computadora para ver detalles o asignar un usuario</div>
                      </div>
                    )}
                    {computadoras.find(c => c.id === compuSelectedId) && (() => {
                      const compuSel = computadoras.find(c => c.id === compuSelectedId);
                      return (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
                            <div>
                              <div style={{ fontSize: 22, fontWeight: 800, color: t.text }}>{compuSel.nombre}</div>
                              <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{compuSel.zona} · {compuSel.sistema}</div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                              <span style={{ padding: "4px 12px", borderRadius: 20,
                                background: compuSel.estado === "libre" ? `${t.green}15` : compuSel.estado === "ocupado" ? `${t.rose}15` : `${t.amber}15`,
                                color: compuSel.estado === "libre" ? t.green : compuSel.estado === "ocupado" ? t.rose : t.amber,
                                fontSize: 11, fontWeight: 700 }}>
                                {compuSel.estado === "libre" ? "Libre" : compuSel.estado === "ocupado" ? "Ocupado" : "Mantenimiento"}
                              </span>
                              <button onClick={() => setCompuSelectedId(null)}
                                style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${t.cardBorder}`, background: t.inputBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                <X size={12} color={t.textDim} />
                              </button>
                            </div>
                          </div>

                          {compuSel.estado === "libre" && (
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: t.text, marginBottom: 12 }}>Asignar Usuario</div>
                              {[{ key: "nombre", label: "Nombre completo", placeholder: "Ej. Juan Pérez" }, { key: "matricula", label: "No. Matrícula", placeholder: "Ej. A201234" }].map(f => (
                                <div key={f.key} style={{ marginBottom: 10 }}>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>{f.label}</div>
                                  <input value={compuAsignForm[f.key]} onChange={e => setCompuAsignForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                                    placeholder={f.placeholder}
                                    style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 12, outline: "none", boxSizing: "border-box" }} />
                                </div>
                              ))}
                              <div style={{ marginBottom: 10 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Carrera</div>
                                <select value={compuAsignForm.carrera} onChange={e => setCompuAsignForm(prev => ({ ...prev, carrera: e.target.value }))}
                                  style={{ width: "100%", background: t.inputBg, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 12, outline: "none" }}>
                                  {cubiCarreras.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                              </div>
                              <div style={{ marginBottom: 14 }}>
                                <div style={{ fontSize: 10, fontWeight: 600, color: t.textDim, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 }}>Duración</div>
                                <div style={{ display: "flex", gap: 6 }}>
                                  {[1, 2].map(h => (
                                    <button key={h} onClick={() => setCompuAsignForm(prev => ({ ...prev, duracion: h }))}
                                      style={{ flex: 1, padding: "8px 0", borderRadius: 8, border: `1px solid ${compuAsignForm.duracion === h ? t.teal : t.cardBorder}`, background: compuAsignForm.duracion === h ? `${t.teal}15` : t.inputBg, color: compuAsignForm.duracion === h ? t.teal : t.textDim, fontSize: 13, fontWeight: compuAsignForm.duracion === h ? 700 : 400, cursor: "pointer" }}>
                                      {h}h
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => {
                                  if (!compuAsignForm.nombre.trim() || !compuAsignForm.matricula.trim()) return;
                                  const nombre = compuSel.nombre;
                                  const updated = { ...compuSel, estado: "ocupado", reserva: { ...compuAsignForm, inicio: new Date(serverNow()) } };
                                  setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? updated : c));
                                  dbSaveComputadora(updated);
                                  setCompuHistorial(prev => [{ id: Date.now(), pc: nombre, ...compuAsignForm, inicio: new Date(serverNow()), estado: "activo" }, ...prev]);
                                  setCompuAsignForm({ nombre: "", matricula: "", carrera: cubiCarreras[0], duracion: 1 });
                                  setCompuSelectedId(null);
                                  setNotifications(prev => [{ id: Date.now(), text: `${nombre} asignada a ${compuAsignForm.nombre}`, type: "success", time: "Ahora" }, ...prev]);
                                }}
                                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                  Asignar
                                </button>
                                <button onClick={() => {
                                  const nombre = compuSel.nombre;
                                  const updated = { ...compuSel, estado: "mantenimiento", reserva: null };
                                  setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? updated : c));
                                  dbSaveComputadora(updated);
                                  setCompuSelectedId(null);
                                  setNotifications(prev => [{ id: Date.now(), text: `${nombre} puesta en mantenimiento`, type: "info", time: "Ahora" }, ...prev]);
                                }}
                                  style={{ padding: "11px 14px", borderRadius: 10, border: `1.5px solid ${t.amber}`, background: `${t.amber}10`, color: t.amber, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                                  Mant.
                                </button>
                              </div>
                            </div>
                          )}

                          {compuSel.estado === "ocupado" && compuSel.reserva && (
                            <div>
                              <div style={{ background: t.inputBg, borderRadius: 12, padding: 14, marginBottom: 14 }}>
                                {[
                                  ["Matrícula", compuSel.reserva.matricula],
                                  ["Carrera", compuSel.reserva.carrera],
                                  ["Duración", `${compuSel.reserva.duracion}h`],
                                  ["Sistema", compuSel.sistema],
                                  ["Entrada", (() => {
                                    const d = compuSel.reserva.inicio instanceof Date ? compuSel.reserva.inicio : new Date(compuSel.reserva.inicio);
                                    return d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                                  })()],
                                ].map(([k, v]) => (
                                  <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                                    <span style={{ fontSize: 11, color: t.textDim }}>{k}</span>
                                    <span style={{ fontSize: 11, fontWeight: 600, color: t.text }}>{v}</span>
                                  </div>
                                ))}
                                {(() => {
                                  const inicio = compuSel.reserva.inicio instanceof Date ? compuSel.reserva.inicio : new Date(compuSel.reserva.inicio);
                                  const elapsed = Math.floor((serverNow() - inicio.getTime()) / 60000);
                                  const total = compuSel.reserva.duracion * 60;
                                  const remaining = Math.max(0, total - elapsed);
                                  const pct = Math.min(100, (elapsed / total) * 100);
                                  return (
                                    <div style={{ marginTop: 10 }}>
                                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                        <span style={{ fontSize: 10, color: t.textDim }}>Tiempo</span>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: remaining < 15 ? t.rose : t.green }}>
                                          {remaining > 0 ? `${remaining} min restantes` : "Tiempo vencido"}
                                        </span>
                                      </div>
                                      <div style={{ width: "100%", height: 6, borderRadius: 3, background: `${t.text}08` }}>
                                        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: remaining < 15 ? t.rose : t.teal, transition: "width 0.5s" }} />
                                      </div>
                                    </div>
                                  );
                                })()}
                              </div>
                              <button onClick={() => {
                                const nombre = compuSel.nombre;
                                const res = compuSel.reserva;
                                const finNow = new Date(serverNow());
                                const completed = { id: Date.now(), pc: nombre, ...res, estado: "completado" };
                                const updated = { ...compuSel, estado: "libre", reserva: null };
                                setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? updated : c));
                                dbSaveComputadora(updated);
                                dbSaveHistorialReserva({
                                  cubicule: nombre, tipo: 'computadoras',
                                  nombre: res.nombre, matricula: res.matricula, carrera: res.carrera,
                                  duracion: res.duracion, personas: null, piso: null,
                                  inicio: res.inicio instanceof Date ? res.inicio.toISOString() : res.inicio,
                                  fin: finNow.toISOString(), turno: calcTurno(res.inicio),
                                }).then(() => dbLoadHistorialReservas().then(d => setHistorialReservas(d)));
                                setCompuHistorial(prev => [completed, ...prev]);
                                setCompuSelectedId(null);
                                setNotifications(prev => [{ id: Date.now(), text: `${nombre} liberada`, type: "info", time: "Ahora" }, ...prev]);
                              }}
                                style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: `1.5px solid ${t.rose}`, background: `${t.rose}10`, color: t.rose, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Liberar Equipo
                              </button>
                            </div>
                          )}

                          {compuSel.estado === "mantenimiento" && (
                            <div>
                              <div style={{ background: `${t.amber}10`, borderRadius: 12, padding: 16, marginBottom: 16, border: `1px solid ${t.amber}30` }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                  <Wrench size={18} color={t.amber} />
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: t.amber }}>En mantenimiento</div>
                                    <div style={{ fontSize: 11, color: t.textDim, marginTop: 2 }}>{compuSel.nombre} no disponible para uso</div>
                                  </div>
                                </div>
                              </div>
                              <button onClick={() => {
                                const nombre = compuSel.nombre;
                                const updated = { ...compuSel, estado: "libre", reserva: null };
                                setComputadoras(prev => prev.map(c => c.id === compuSelectedId ? updated : c));
                                dbSaveComputadora(updated);
                                setCompuSelectedId(null);
                                setNotifications(prev => [{ id: Date.now(), text: `${nombre} marcada como disponible`, type: "success", time: "Ahora" }, ...prev]);
                              }}
                                style={{ width: "100%", padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${t.green}, ${t.teal})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                                Marcar como Disponible
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Gestión de equipos + Historial */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

                  {/* Agregar/Quitar equipos */}
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.teal}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Monitor size={17} color={t.teal} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: t.text }}>Gestión de Equipos</div>
                        <div style={{ fontSize: 10, color: t.textDim }}>Agregar o quitar computadoras</div>
                      </div>
                    </div>

                    <div style={{ background: t.inputBg, borderRadius: 12, padding: 14, marginBottom: 16 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 }}>Nueva computadora</div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Nombre / Código</div>
                        <input value={compuNuevoForm.nombre} onChange={e => setCompuNuevoForm(p => ({ ...p, nombre: e.target.value }))}
                          placeholder={`PC-${String(computadoras.length + 1).padStart(2, "0")}`}
                          style={{ width: "100%", background: t.card, border: `1px solid ${t.cardBorder}`, borderRadius: 8, padding: "8px 12px", color: t.text, fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "'Space Mono', monospace" }} />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Zona</div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {compuZonas.map(z => (
                            <button key={z} onClick={() => setCompuNuevoForm(p => ({ ...p, zona: z }))}
                              style={{ padding: "5px 10px", borderRadius: 7, border: `1px solid ${compuNuevoForm.zona === z ? t.teal : t.cardBorder}`, background: compuNuevoForm.zona === z ? `${t.teal}20` : t.card, color: compuNuevoForm.zona === z ? t.teal : t.textDim, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                              {z}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <div style={{ fontSize: 10, color: t.textDim, marginBottom: 4 }}>Sistema Operativo</div>
                        <div style={{ display: "flex", gap: 4 }}>
                          {compuSistemas.map(s => (
                            <button key={s} onClick={() => setCompuNuevoForm(p => ({ ...p, sistema: s }))}
                              style={{ flex: 1, padding: "5px 0", borderRadius: 7, border: `1px solid ${compuNuevoForm.sistema === s ? t.purple : t.cardBorder}`, background: compuNuevoForm.sistema === s ? `${t.purple}20` : t.card, color: compuNuevoForm.sistema === s ? t.purple : t.textDim, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => {
                        const nombre = compuNuevoForm.nombre.trim() || `PC-${String(computadoras.length + 1).padStart(2, "0")}`;
                        const newId = Math.max(...computadoras.map(c => c.id), 0) + 1;
                        const nueva = { id: newId, nombre, zona: compuNuevoForm.zona, sistema: compuNuevoForm.sistema, estado: "libre", reserva: null };
                        setComputadoras(prev => [...prev, nueva]);
                        dbSaveComputadora(nueva);
                        setCompuNuevoForm({ nombre: "", zona: "Sala General", sistema: "Windows 11" });
                        setNotifications(prev => [{ id: Date.now(), text: `${nombre} agregada a ${compuNuevoForm.zona}`, type: "success", time: "Ahora" }, ...prev]);
                      }}
                        style={{ width: "100%", padding: "9px 0", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        + Agregar
                      </button>
                    </div>

                    <div style={{ fontSize: 10, fontWeight: 700, color: t.textDim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                      Equipos actuales ({computadoras.length})
                    </div>
                    <div style={{ overflowY: "auto", maxHeight: 200 }}>
                      {computadoras.map(pc => {
                        const isLibre = pc.estado === "libre";
                        const dotColor = { libre: t.green, ocupado: t.rose, mantenimiento: t.amber }[pc.estado] || t.textDim;
                        return (
                          <div key={pc.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                            <span style={{ fontSize: 12, fontWeight: 700, color: t.text, fontFamily: "'Space Mono', monospace", minWidth: 50 }}>{pc.nombre}</span>
                            <span style={{ fontSize: 10, color: t.textDim, flex: 1 }}>{pc.zona}</span>
                            <button disabled={!isLibre}
                              title={isLibre ? "Quitar equipo" : "Solo se pueden quitar equipos libres"}
                              onClick={() => {
                                if (!isLibre) return;
                                setComputadoras(prev => prev.filter(x => x.id !== pc.id));
                                dbDeleteComputadora(pc.id);
                                if (compuSelectedId === pc.id) setCompuSelectedId(null);
                                setNotifications(prev => [{ id: Date.now(), text: `${pc.nombre} eliminada`, type: "info", time: "Ahora" }, ...prev]);
                              }}
                              style={{ width: 26, height: 26, borderRadius: 7, border: `1px solid ${isLibre ? t.rose : t.cardBorder}`, background: isLibre ? `${t.rose}12` : "transparent", color: isLibre ? t.rose : t.textDim, fontSize: 14, cursor: isLibre ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: isLibre ? 1 : 0.4 }}>
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Historial computadoras */}
                  <div style={{ background: t.card, borderRadius: 16, padding: 22, border: `1px solid ${t.cardBorder}` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: t.text, marginBottom: 14 }}>Historial Reciente</div>
                    {compuHistorial.length === 0 && (
                      <div style={{ textAlign: "center", padding: "16px 0", color: t.textDim, fontSize: 12 }}>Sin historial aún</div>
                    )}
                    {compuHistorial.slice(0, 10).map(h => (
                      <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: `1px solid ${t.cardBorder}` }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.teal}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Monitor size={15} color={t.teal} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{h.pc} — {h.nombre}</div>
                          <div style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>{h.matricula} · {h.carrera} · {h.duracion}h</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: h.estado === "completado" ? `${t.green}15` : `${t.teal}15`, color: h.estado === "completado" ? t.green : t.teal }}>
                            {h.estado === "completado" ? "Completado" : "Activo"}
                          </span>
                          <div style={{ fontSize: 9, color: t.textMuted, marginTop: 3 }}>
                            {timeAgo(h.inicio instanceof Date ? h.inicio : new Date(h.inicio))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                </div>

              </>)}

              {/* ===== QR CODES ===== */}
              {herrTool === "qr" && (() => {
                const baseUrl = window.location.origin;
                const qrUrl = (c) => `${baseUrl}/cubiculo/${encodeURIComponent(c.nombre)}`;
                const stColor = e => e==='libre'?t.green:e==='ocupado'?t.rose:t.amber;
                const stLabel = e => e==='libre'?'Libre':e==='ocupado'?'Ocupado':'Reservado';
                return (
                  <div>
                    {/* Header + acciones */}
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
                      <div>
                        <div style={{fontSize:15,fontWeight:700,color:t.text}}>Códigos QR — Cubículos</div>
                        <div style={{fontSize:11,color:t.textDim,marginTop:2}}>Imprime y pega cada QR en el cubículo correspondiente. Al escanearlo el alumno hace Check-In / Check-Out.</div>
                      </div>
                      <div style={{display:'flex',gap:10}}>
                        <button onClick={()=>window.open(`${window.location.origin}/cubiculo`,'_blank')}
                          style={{display:'flex',alignItems:'center',gap:7,padding:'9px 16px',borderRadius:10,border:`1px solid ${t.teal}`,background:'transparent',color:t.teal,fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          <Eye size={14}/> Página de reservas
                        </button>
                        <button onClick={()=>window.print()}
                          style={{display:'flex',alignItems:'center',gap:7,padding:'9px 18px',borderRadius:10,border:'none',background:`linear-gradient(135deg,${t.teal},${t.blue})`,color:'#fff',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                          <Printer size={14}/> Imprimir todos
                        </button>
                      </div>
                    </div>

                    {/* Grid de QRs */}
                    <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:16}} className="qr-grid">
                      {cubiculos.map(c => {
                        const url = qrUrl(c);
                        const col = stColor(c.estado);
                        return (
                          <div key={c.id} style={{background:t.card,borderRadius:16,padding:20,border:`1px solid ${t.cardBorder}`,display:'flex',flexDirection:'column',alignItems:'center',gap:12,textAlign:'center'}}>
                            {/* Status badge */}
                            <div style={{display:'flex',alignItems:'center',gap:5,fontSize:10,fontWeight:700,color:col,background:`${col}15`,padding:'3px 10px',borderRadius:20,border:`1px solid ${col}35`}}>
                              <div style={{width:6,height:6,borderRadius:'50%',background:col}}/>{stLabel(c.estado)}
                            </div>
                            {/* QR */}
                            <div style={{padding:10,background:'#fff',borderRadius:12,lineHeight:0}}>
                              <QRCodeSVG value={url} size={130} level="M"
                                imageSettings={{src:'',height:0,width:0,excavate:false}}/>
                            </div>
                            {/* Info */}
                            <div>
                              <div style={{fontSize:15,fontWeight:800,color:t.text}}>{c.nombre}</div>
                              <div style={{fontSize:10,color:t.textDim,marginTop:2}}>Piso {c.piso || 1}</div>
                            </div>
                            {/* URL */}
                            <div style={{fontSize:8,color:t.textMuted,wordBreak:'break-all',maxWidth:160,lineHeight:1.4}}>{url}</div>
                            {/* Botón abrir */}
                            <button onClick={()=>window.open(url,'_blank')}
                              style={{width:'100%',padding:'8px',borderRadius:10,border:`1px solid ${t.cardBorder}`,background:'transparent',color:t.teal,fontSize:11,fontWeight:600,cursor:'pointer'}}>
                              Abrir vista QR
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Print styles */}
                    <style>{`
                      @media print {
                        body > * { display: none !important; }
                        .qr-grid { display: grid !important; grid-template-columns: repeat(3,1fr) !important; gap: 20px !important; }
                        .qr-grid > * { page-break-inside: avoid; border: 1px solid #ddd !important; border-radius: 12px !important; padding: 16px !important; }
                      }
                    `}</style>
                  </div>
                );
              })()}

            </div>
          )}

        </div>
      </main>

      {/* ===== EXPORT MODAL ===== */}
      {showExport && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowExport(false); }}>
          <div style={{ background: t.card, borderRadius: 20, padding: 28, width: 520, maxHeight: "88vh", overflowY: "auto", border: `1px solid ${t.cardBorder}`, boxShadow: "0 24px 64px rgba(0,0,0,0.35)" }}>

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: `${t.teal}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Download size={17} color={t.teal} />
                </div>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.text }}>Exportar Reporte</div>
                  <div style={{ fontSize: 10, color: t.textDim }}>Configura filtros y formato de salida</div>
                </div>
              </div>
              <button onClick={() => setShowExport(false)} style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <X size={14} color={t.textDim} />
              </button>
            </div>

            {/* ── Filtros ── */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 14 }}>Filtros</div>

              {/* Periodo */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>Periodo(s)</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ v: "2024-1", l: "Ene – Jul 2024" }, { v: "2024-2", l: "Ago 2024 – Ene 2025" }, { v: "2025-1", l: "Feb – Jul 2025" }].map(p => {
                    const on = exportPeriodos.includes(p.v);
                    return (
                      <button key={p.v} onClick={() => setExportPeriodos(prev => on && prev.length === 1 ? prev : on ? prev.filter(x => x !== p.v) : [...prev, p.v])}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? t.teal : t.cardBorder}`, background: on ? `${t.teal}15` : t.inputBg, color: on ? t.teal : t.textDim, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>
                        {p.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campus */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>Campus</div>
                <select value={exportCampus} onChange={e => setExportCampus(e.target.value)}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 12, outline: "none" }}>
                  <option value="todos">Todos los Campus</option>
                  <option value="central">Campus Central</option>
                  <option value="norte">Campus Norte</option>
                  <option value="sur">Campus Sur</option>
                </select>
              </div>

              {/* Servicios */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>Servicios</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ v: "prestamos", l: "Préstamos" }, { v: "computo", l: "Cómputo" }, { v: "formacion", l: "Formación" }, { v: "espacios", l: "Espacios" }].map(s => {
                    const on = exportServicios.includes(s.v);
                    return (
                      <button key={s.v} onClick={() => setExportServicios(prev => on && prev.length === 1 ? prev : on ? prev.filter(x => x !== s.v) : [...prev, s.v])}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? t.blue : t.cardBorder}`, background: on ? `${t.blue}15` : t.inputBg, color: on ? t.blue : t.textDim, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>
                        {s.l}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Secciones */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: t.text, marginBottom: 8 }}>Módulos del reporte</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[{ v: "overview", l: "Vista General" }, { v: "servicios", l: "Servicios" }, { v: "predictivo", l: "Predictivo" }, { v: "sentimiento", l: "Sentimiento" }, { v: "impacto", l: "Impacto" }].map(s => {
                    const on = exportSecciones.includes(s.v);
                    return (
                      <button key={s.v} onClick={() => setExportSecciones(prev => on && prev.length === 1 ? prev : on ? prev.filter(x => x !== s.v) : [...prev, s.v])}
                        style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? t.purple : t.cardBorder}`, background: on ? `${t.purple}15` : t.inputBg, color: on ? t.purple : t.textDim, fontSize: 11, fontWeight: on ? 700 : 400, cursor: "pointer" }}>
                        {s.l}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Formato ── */}
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: t.teal, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Formato de Salida</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[
                  { v: "pdf", label: "PDF", badge: "Con gráficas + narrativa", icon: FileText, color: t.rose },
                  { v: "excel", label: "Excel", badge: "Datos en hojas separadas", icon: BarChart3, color: t.green },
                ].map(fmt => {
                  const Icon = fmt.icon;
                  const on = exportFormat === fmt.v;
                  return (
                    <button key={fmt.v} onClick={() => setExportFormat(fmt.v)}
                      style={{ padding: "14px 12px", borderRadius: 12, border: `2px solid ${on ? fmt.color : t.cardBorder}`, background: on ? `${fmt.color}10` : t.inputBg, cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <Icon size={16} color={on ? fmt.color : t.textDim} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: on ? fmt.color : t.text }}>{fmt.label}</span>
                      </div>
                      <div style={{ fontSize: 10, color: t.textDim }}>{fmt.badge}</div>
                    </button>
                  );
                })}
              </div>
              {exportFormat === "pdf" && (
                <div style={{ marginTop: 10, padding: "8px 12px", borderRadius: 8, background: `${t.amber}10`, border: `1px solid ${t.amber}30`, fontSize: 10, color: t.amber }}>
                  El PDF incluye: portada, resumen ejecutivo, gráficas capturadas, análisis narrativo y tablas de datos.
                </div>
              )}
            </div>

            {/* ── Footer botones ── */}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowExport(false)} style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${t.cardBorder}`, background: t.inputBg, color: t.text, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleExport}
                disabled={exportLoading || exportPeriodos.length === 0 || exportServicios.length === 0 || exportSecciones.length === 0}
                style={{ flex: 2, padding: "10px 0", borderRadius: 10, border: "none", background: exportLoading ? t.textDim : `linear-gradient(135deg, ${t.teal}, ${t.blue})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: exportLoading ? "wait" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: (exportPeriodos.length === 0 || exportServicios.length === 0) ? 0.5 : 1, transition: "all 0.2s" }}>
                {exportLoading
                  ? <><RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> Generando…</>
                  : <><Download size={13} /> Exportar {exportFormat === "pdf" ? "PDF" : "Excel"}</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== HIDDEN EXPORT CHART RENDERER ===== */}
      {isExportRendering && (
        <div style={{ position: "fixed", top: "-9999px", left: 0, width: 900, zIndex: 9999, pointerEvents: "none" }}>
          {exportSecciones.includes("overview") && (
            <div ref={exportChartRefs.overview} style={{ width: 860, padding: "16px 20px", background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Circulación de Colecciones</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={circulacion}>
                  <defs>
                    <linearGradient id="eG1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity={0.3}/><stop offset="100%" stopColor="#0d9488" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="prestamos" name="Préstamos" stroke="#0d9488" fill="url(#eG1)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="devoluciones" name="Devoluciones" stroke="#2563eb" fill="none" strokeWidth={2} dot={{ r: 2 }} />
                  <Area type="monotone" dataKey="prediccion" name="Predicción ML" stroke="#d97706" fill="none" strokeWidth={2} strokeDasharray="8 4" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {exportSecciones.includes("servicios") && (
            <div ref={exportChartRefs.servicios} style={{ width: 860, padding: "16px 20px", background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Servicios por Tipo — Temporal</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={svcMes}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                  <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Bar dataKey="domicilio" name="Domicilio" fill="#0d9488" radius={[4,4,0,0]} />
                  <Bar dataKey="computadoras" name="Cómputo" fill="#2563eb" radius={[4,4,0,0]} />
                  <Bar dataKey="talleres" name="Formación" fill="#7c3aed" radius={[4,4,0,0]} />
                  <Bar dataKey="cubiculos" name="Espacios" fill="#d97706" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {exportSecciones.includes("predictivo") && (
            <div ref={exportChartRefs.predictivo} style={{ width: 860, padding: "16px 20px", background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Pronóstico de Circulación</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={circulacion}>
                  <defs>
                    <linearGradient id="eG2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0d9488" stopOpacity={0.3}/><stop offset="100%" stopColor="#0d9488" stopOpacity={0}/></linearGradient>
                    <linearGradient id="eG3" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d97706" stopOpacity={0.25}/><stop offset="100%" stopColor="#d97706" stopOpacity={0}/></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                  <XAxis dataKey="mes" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} />
                  <Area type="monotone" dataKey="prestamos" name="Real" stroke="#0d9488" fill="url(#eG2)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="prediccion" name="Predicción" stroke="#d97706" fill="url(#eG3)" strokeWidth={2.5} strokeDasharray="8 4" dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
          {exportSecciones.includes("sentimiento") && (
            <div ref={exportChartRefs.sentimiento} style={{ width: 860, padding: "16px 20px", background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Tendencia de Sentimiento NLP</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={sentTendencia}>
                    <defs>
                      <linearGradient id="eG4" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#059669" stopOpacity={0.3}/><stop offset="100%" stopColor="#059669" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                    <XAxis dataKey="mes" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Area type="monotone" dataKey="positivo" name="% Positivo" stroke="#059669" fill="url(#eG4)" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Area type="monotone" dataKey="negativo" name="% Negativo" stroke="#e11d48" fill="none" strokeWidth={2} dot={{ r: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={radarBase}>
                    <PolarGrid stroke="#e2e8f020" />
                    <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: "#64748b" }} />
                    <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                    <Radar dataKey="A" stroke="#0d9488" fill="#0d9488" fillOpacity={0.2} strokeWidth={2} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {exportSecciones.includes("impacto") && (
            <div ref={exportChartRefs.impacto} style={{ width: 860, padding: "16px 20px", background: "#ffffff" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 4 }}>Impacto Académico</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={impactoBase}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                    <XAxis dataKey="rango" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[6, 10]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Bar dataKey="promedio" name="Promedio" radius={[6,6,0,0]}>
                      {impactoBase.map((_, i) => <Cell key={i} fill={["#2563eb","#0d9488","#14b8a6","#7c3aed","#d97706"][i]} />)}
                      <LabelList dataKey="promedio" position="top" formatter={v => v.toFixed(1)} style={{ fontSize: 9, fontWeight: 700 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={retencionBase}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f010" />
                    <XAxis dataKey="sem" tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <YAxis domain={[30, 100]} tick={{ fontSize: 9, fill: "#64748b" }} axisLine={false} tickLine={false} />
                    <Line type="monotone" dataKey="usr" name="Usuarios" stroke="#0d9488" strokeWidth={2.5} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="noUsr" name="No Usuarios" stroke="#e11d48" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
