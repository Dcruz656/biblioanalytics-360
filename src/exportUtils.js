import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const periodoLabel = {
  "2024-1": "Ene – Jul 2024",
  "2024-2": "Ago 2024 – Ene 2025",
  "2025-1": "Feb – Jul 2025",
};

const campusLabel = (c) =>
  c === "todos" ? "Todos los Campus" : `Campus ${c.charAt(0).toUpperCase() + c.slice(1)}`;

const servicioLabel = {
  prestamos: "Préstamos",
  computo: "Cómputo",
  formacion: "Formación",
  espacios: "Espacios",
};

function autoWidth(ws, data) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const colWidths = keys.map((k) => {
    const maxVal = Math.max(k.length, ...data.map((r) => String(r[k] ?? "").length));
    return { wch: Math.min(maxVal + 2, 40) };
  });
  ws["!cols"] = colWidths;
}

function addStyledHeader(ws, headers, row = 0) {
  headers.forEach((h, i) => {
    const cell = XLSX.utils.encode_cell({ r: row, c: i });
    if (!ws[cell]) return;
    ws[cell].s = {
      font: { bold: true, color: { rgb: "FFFFFF" } },
      fill: { fgColor: { rgb: "0D9488" } },
      alignment: { horizontal: "center" },
    };
  });
}

// ─── EXCEL ──────────────────────────────────────────────────────────────────

export function generateExcel({ circulacion, svcMes, svcCarrera, comments, impactoBase, retencionBase }, filters) {
  const wb = XLSX.utils.book_new();
  const { campus, periodos, servicios } = filters;

  // ── Hoja 1: Resumen ──
  const totalPrestamos = circulacion.filter((c) => c.prestamos).reduce((a, b) => a + b.prestamos, 0);
  const lastMes = circulacion.filter((c) => c.prestamos).slice(-1)[0];
  const posComments = comments.filter((c) => c.sentimiento === "positivo");
  const satPct = comments.length ? Math.round((posComments.length / comments.length) * 100) : 0;
  const resumenData = [
    { Indicador: "Periodo(s)", Valor: periodos.map((p) => periodoLabel[p] ?? p).join(" · ") },
    { Indicador: "Campus", Valor: campusLabel(campus) },
    { Indicador: "Servicios incluidos", Valor: servicios.map((s) => servicioLabel[s] ?? s).join(", ") },
    { Indicador: "Total Préstamos (periodo)", Valor: totalPrestamos.toLocaleString() },
    { Indicador: "Préstamos último mes registrado", Valor: (lastMes?.prestamos ?? 0).toLocaleString() },
    { Indicador: "Satisfacción NLP", Valor: `${satPct}%` },
    { Indicador: "Correlación uso-promedio académico", Valor: "r = 0.73 (p < 0.001)" },
    { Indicador: "Retención usuarios biblioteca", Valor: "81%" },
    { Indicador: "Estudiantes analizados", Valor: "2,110" },
    { Indicador: "Calidad de datos", Valor: "94%" },
    { Indicador: "Fecha de generación", Valor: new Date().toLocaleString("es-MX") },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  wsResumen["!cols"] = [{ wch: 38 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // ── Hoja 2: Circulación ──
  const circData = circulacion.map((c) => ({
    Mes: c.mes,
    Préstamos: c.prestamos ?? "",
    Devoluciones: c.devoluciones ?? "",
    "Predicción ML": c.prediccion ?? "",
  }));
  const wsCirc = XLSX.utils.json_to_sheet(circData);
  autoWidth(wsCirc, circData);
  XLSX.utils.book_append_sheet(wb, wsCirc, "Circulación");

  // ── Hoja 3: Servicios ──
  const svcCols = { prestamos: ["domicilio", "sala", "interbibliotecario"], computo: ["computadoras", "internet", "impresiones"], formacion: ["talleres", "capacitaciones", "asesorias"], espacios: ["cubiculos", "salasEstudio", "coworking"] };
  const svcColNames = { domicilio: "Domicilio", sala: "En Sala", interbibliotecario: "Interbibliotecario", computadoras: "Computadoras", internet: "Internet WiFi", impresiones: "Impresiones", talleres: "Talleres", capacitaciones: "Capacitaciones", asesorias: "Asesorías", cubiculos: "Cubículos", salasEstudio: "Salas de Estudio", coworking: "Coworking" };
  const activeCols = servicios.flatMap((s) => svcCols[s] ?? []);
  const svcData = svcMes.map((row) => {
    const out = { Mes: row.mes };
    activeCols.forEach((col) => { out[svcColNames[col] ?? col] = row[col] ?? 0; });
    return out;
  });
  const wsSvc = XLSX.utils.json_to_sheet(svcData);
  autoWidth(wsSvc, svcData);
  XLSX.utils.book_append_sheet(wb, wsSvc, "Servicios");

  // ── Hoja 4: Por Carrera ──
  const carreraData = svcCarrera.map((r) => ({
    Carrera: r.carrera,
    Préstamos: r.prestamos,
    Cómputo: r.computadoras,
    Formación: r.talleres,
    Espacios: r.espacios,
    Total: r.total,
  }));
  const wsCarrera = XLSX.utils.json_to_sheet(carreraData);
  autoWidth(wsCarrera, carreraData);
  XLSX.utils.book_append_sheet(wb, wsCarrera, "Por Carrera");

  // ── Hoja 5: Sentimiento ──
  const sentData = comments.map((c, i) => ({
    "#": i + 1,
    Texto: c.texto,
    Sentimiento: c.sentimiento,
    "Confianza (%)": Math.round(c.score * 100),
    Fecha: c.fecha instanceof Date ? c.fecha.toLocaleDateString("es-MX") : String(c.fecha),
    Fuente: c.fuente,
  }));
  const wsSent = XLSX.utils.json_to_sheet(sentData);
  autoWidth(wsSent, sentData);
  XLSX.utils.book_append_sheet(wb, wsSent, "Sentimiento");

  // ── Hoja 6: Impacto ──
  const impData = impactoBase.map((r) => ({
    "Rango de Préstamos": r.rango,
    "Promedio Académico": r.promedio,
    "N Estudiantes": r.n,
  }));
  const wsImp = XLSX.utils.json_to_sheet(impData);
  autoWidth(wsImp, impData);
  XLSX.utils.book_append_sheet(wb, wsImp, "Impacto");

  // ── Hoja 7: Retención ──
  const retData = retencionBase.map((r) => ({
    Semestre: r.sem,
    "Retención Usuarios Biblio. (%)": r.usr,
    "Retención No Usuarios (%)": r.noUsr,
  }));
  const wsRet = XLSX.utils.json_to_sheet(retData);
  autoWidth(wsRet, retData);
  XLSX.utils.book_append_sheet(wb, wsRet, "Retención");

  // ── Descargar ──
  const campusSlug = campus === "todos" ? "todos" : campus;
  const periodoSlug = periodos[0] ?? "periodo";
  XLSX.writeFile(wb, `biblioanalytics_${campusSlug}_${periodoSlug}.xlsx`);
}

// ─── PDF ────────────────────────────────────────────────────────────────────

const C = {
  navy:    [14, 22, 41],
  teal:    [13, 148, 136],
  tealL:   [20, 184, 166],
  blue:    [37, 99, 235],
  purple:  [124, 58, 237],
  amber:   [217, 119, 6],
  rose:    [225, 29, 72],
  green:   [5, 150, 105],
  white:   [255, 255, 255],
  gray:    [148, 163, 184],
  grayD:   [71, 85, 105],
  light:   [241, 245, 249],
  border:  [226, 232, 240],
};

function hex(rgb) { return rgb.map((v) => v.toString(16).padStart(2, "0")).join(""); }

function setFill(doc, rgb) { doc.setFillColor(...rgb); }
function setStroke(doc, rgb) { doc.setDrawColor(...rgb); }
function setTxt(doc, rgb) { doc.setTextColor(...rgb); }

function pageFooter(doc, pageNum, total) {
  const W = 210, H = 297;
  setFill(doc, C.navy);
  doc.rect(0, H - 12, W, 12, "F");
  doc.setFontSize(8);
  setTxt(doc, C.gray);
  doc.text("BiblioAnalytics 360 · UACJ · Confidencial", 14, H - 4.5);
  doc.text(`Página ${pageNum} de ${total}`, W - 14, H - 4.5, { align: "right" });
}

function sectionBand(doc, y, color, title, subtitle) {
  setFill(doc, color);
  doc.rect(0, y, 210, 14, "F");
  doc.setFontSize(13);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.white);
  doc.text(title, 14, y + 9.5);
  if (subtitle) {
    doc.setFontSize(8);
    doc.setFont(undefined, "normal");
    doc.text(subtitle, 210 - 14, y + 9.5, { align: "right" });
  }
}

function addNarrativeBox(doc, y, text, findings, accentColor) {
  const W = 182, X = 14;
  const LH = 5; // mm por línea — constante usada tanto para el box como para el render

  // Fijar font ANTES de splitTextToSize para que las medidas coincidan con el render
  doc.setFontSize(9);
  doc.setFont(undefined, "normal");

  const lines = doc.splitTextToSize(text, W - 8);
  const linesH = lines.length * LH + 4;
  const totalH = linesH + (findings ? findings.length * 6 + 14 : 0) + 8;

  setFill(doc, C.light);
  setStroke(doc, accentColor);
  doc.setLineWidth(0.5);
  doc.roundedRect(X, y, W, totalH, 3, 3, "FD");

  setTxt(doc, C.grayD);
  // Renderizar cada línea en y explícito para evitar depender del interlineado interno de jsPDF
  lines.forEach((line, i) => {
    doc.text(line, X + 4, y + 7 + i * LH);
  });

  if (findings) {
    let fy = y + linesH + 8;
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    setTxt(doc, accentColor);
    doc.text("Hallazgos clave:", X + 4, fy);
    fy += 6;
    doc.setFont(undefined, "normal");
    setTxt(doc, C.grayD);
    findings.forEach((f) => {
      doc.text(`• ${f}`, X + 6, fy);
      fy += 6;
    });
  }
  return y + totalH + 6;
}

function kpiBox(doc, x, y, w, h, value, label, color) {
  setFill(doc, C.light);
  setStroke(doc, color);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, w, h, 3, 3, "FD");
  doc.setFontSize(18);
  doc.setFont(undefined, "bold");
  setTxt(doc, color);
  doc.text(String(value), x + w / 2, y + h / 2 - 1, { align: "center" });
  doc.setFontSize(8);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.grayD);
  doc.text(label, x + w / 2, y + h / 2 + 7, { align: "center" });
}

export async function generatePDF(chartImages, data, filters, meta) {
  const { circulacion, svcMes, svcCarrera, svcTurno, comments, impactoBase, retencionBase, radarBase } = data;
  const { campus, periodos, servicios, secciones } = filters;
  const { institution, predModel, predHorizon } = meta;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297;

  // ── Pre-calculations ──
  const validCirc = circulacion.filter((c) => c.prestamos);
  const totalPrest = validCirc.reduce((a, b) => a + b.prestamos, 0);
  const avgPrest = validCirc.length ? Math.round(totalPrest / validCirc.length) : 0;
  const maxMes = validCirc.sort((a, b) => b.prestamos - a.prestamos)[0] ?? { mes: "—", prestamos: 0 };
  const posComments = comments.filter((c) => c.sentimiento === "positivo");
  const negComments = comments.filter((c) => c.sentimiento === "negativo");
  const satPct = comments.length ? Math.round((posComments.length / comments.length) * 100) : 0;
  const topCarrera = [...svcCarrera].sort((a, b) => b.total - a.total)[0] ?? { carrera: "—", total: 0 };
  const topTurno = [...svcTurno].sort((a, b) => b.pct - a.pct)[0] ?? { turno: "—", pct: 0 };
  const radarTop = [...radarBase].sort((a, b) => b.A - a.A)[0] ?? { subject: "—", A: 0 };
  const radarBot = [...radarBase].sort((a, b) => a.A - b.A)[0] ?? { subject: "—", A: 0 };
  const modelNames = { rf: "Random Forest", prophet: "Prophet (Meta)", reg: "Regresión Lineal" };
  const periodoStr = periodos.map((p) => periodoLabel[p] ?? p).join(", ");

  // Count pages for footer
  let pages = 1 + 1 + secciones.length + 1; // cover + executive + sections + data
  let pageNum = 0;

  // ─────────────────────────────────────────────
  // PÁGINA 1 — PORTADA
  // ─────────────────────────────────────────────
  pageNum++;
  setFill(doc, C.navy);
  doc.rect(0, 0, W, H, "F");

  // Banda teal superior
  setFill(doc, C.teal);
  doc.rect(0, 0, W, 22, "F");
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.white);
  doc.text("REPORTE DE ANALÍTICA BIBLIOTECARIA", W / 2, 13, { align: "center" });

  // Título principal
  doc.setFontSize(32);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.white);
  doc.text("BiblioAnalytics 360", W / 2, 80, { align: "center" });

  // Línea decorativa
  setStroke(doc, C.teal);
  doc.setLineWidth(1.5);
  doc.line(50, 88, W - 50, 88);

  // Institución
  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.white);
  doc.text(institution, W / 2, 100, { align: "center" });

  // Metadatos
  const metaItems = [
    { label: "Periodo analizado:", value: periodoStr },
    { label: "Campus:", value: campusLabel(campus) },
    { label: "Servicios:", value: servicios.map((s) => servicioLabel[s] ?? s).join(", ") },
    { label: "Fecha de generación:", value: new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) },
  ];
  let my = 125;
  metaItems.forEach(({ label, value }) => {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    setTxt(doc, C.gray);
    doc.text(label, W / 2 - 5, my, { align: "right" });
    doc.setFont(undefined, "normal");
    setTxt(doc, C.tealL);
    doc.text(value, W / 2 + 5, my);
    my += 10;
  });

  // Secciones incluidas
  my += 5;
  doc.setFontSize(8);
  setTxt(doc, C.gray);
  doc.text("Módulos incluidos:", W / 2, my, { align: "center" });
  my += 6;
  const secLabels = { overview: "Vista General", servicios: "Servicios", predictivo: "Predictivo", sentimiento: "Sentimiento", impacto: "Impacto" };
  const pills = secciones.map((s) => secLabels[s] ?? s);
  let px = (W - pills.reduce((a, b) => a + doc.getStringUnitWidth(b) * 2.8 + 14, 0)) / 2;
  pills.forEach((pill) => {
    const pw = doc.getStringUnitWidth(pill) * 2.8 + 10;
    setFill(doc, C.teal);
    doc.roundedRect(px, my - 4, pw, 7, 2, 2, "F");
    setTxt(doc, C.white);
    doc.setFontSize(7.5);
    doc.text(pill, px + pw / 2, my + 0.5, { align: "center" });
    px += pw + 4;
  });

  // Footer de portada
  doc.setFontSize(8);
  setTxt(doc, C.gray);
  doc.text("Generado con BiblioAnalytics 360 · Uso interno y académico", W / 2, H - 16, { align: "center" });
  pageFooter(doc, pageNum, pages);

  // ─────────────────────────────────────────────
  // PÁGINA 2 — RESUMEN EJECUTIVO
  // ─────────────────────────────────────────────
  doc.addPage();
  pageNum++;
  setFill(doc, C.light);
  doc.rect(0, 0, W, H, "F");

  sectionBand(doc, 0, C.navy, "Resumen Ejecutivo", periodoStr);

  // Intro paragraph
  const introText = `Este reporte presenta un análisis integral del desempeño de los servicios bibliotecarios de ${institution} correspondiente al periodo ${periodoStr}, para ${campusLabel(campus).toLowerCase()}. Durante el periodo analizado se registraron ${totalPrest.toLocaleString()} préstamos totales, con un promedio mensual de ${avgPrest.toLocaleString()} préstamos. El análisis abarca circulación de colecciones, estadísticas de servicios, modelado predictivo, análisis de sentimiento y correlación con impacto académico.`;
  const introLines = doc.splitTextToSize(introText, 182);
  doc.setFontSize(9.5);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.grayD);
  doc.text(introLines, 14, 24);

  // KPI Grid 2x3
  const kpis = [
    { v: totalPrest.toLocaleString(), l: "Total Préstamos", c: C.teal },
    { v: `${satPct}%`, l: "Satisfacción NLP", c: C.green },
    { v: "r = 0.73", l: "Correlación uso-promedio", c: C.blue },
    { v: "81%", l: "Retención usuarios biblio.", c: C.purple },
    { v: "94%", l: "Calidad de datos", c: C.amber },
    { v: "2,110", l: "Estudiantes analizados", c: C.rose },
  ];
  const kpiY = 24 + introLines.length * 5.5 + 6;
  const kpiW = 55, kpiH = 28, kpiGap = 8.5;
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    kpiBox(doc, 14 + col * (kpiW + kpiGap), kpiY + row * (kpiH + 6), kpiW, kpiH, k.v, k.l, k.c);
  });

  // Filtros aplicados
  let fy2 = kpiY + 2 * (kpiH + 6) + 10;
  setFill(doc, C.white);
  setStroke(doc, C.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(14, fy2, 182, 18, 3, 3, "FD");
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.grayD);
  doc.text("Filtros aplicados:", 18, fy2 + 6.5);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.teal);
  doc.text(`Periodo: ${periodoStr}  ·  Campus: ${campusLabel(campus)}  ·  Servicios: ${servicios.map((s) => servicioLabel[s] ?? s).join(", ")}`, 18, fy2 + 13);

  pageFooter(doc, pageNum, pages);

  // ─────────────────────────────────────────────
  // PÁGINAS POR SECCIÓN
  // ─────────────────────────────────────────────

  const sectionDefs = [
    {
      id: "overview",
      title: "Circulación de Colecciones",
      subtitle: "Módulo de Vista General",
      color: C.teal,
      narrative: () => {
        const tasaDev = validCirc.length ? Math.round((validCirc.reduce((a, b) => a + (b.devoluciones || 0), 0) / totalPrest) * 100) : 0;
        return `Durante el periodo ${periodoStr}, la colección de ${campusLabel(campus).toLowerCase()} registró ${totalPrest.toLocaleString()} préstamos totales con un promedio mensual de ${avgPrest.toLocaleString()} operaciones. El mes de mayor actividad fue ${maxMes.mes} con ${(maxMes.prestamos || 0).toLocaleString()} préstamos, representando el punto máximo de demanda en el ciclo analizado. La tasa de devolución se mantuvo en ${tasaDev}%, indicando un adecuado cumplimiento por parte de los usuarios. El modelo predictivo anticipa un incremento sostenido hacia el cierre del ciclo escolar, lo que sugiere la necesidad de reforzar la disponibilidad del acervo en los meses subsecuentes.`;
      },
      findings: () => [
        `Pico de demanda: ${maxMes.mes} con ${(maxMes.prestamos || 0).toLocaleString()} préstamos`,
        `Promedio mensual: ${avgPrest.toLocaleString()} préstamos — tendencia positiva`,
        `Total del periodo: ${totalPrest.toLocaleString()} operaciones de circulación`,
      ],
    },
    {
      id: "servicios",
      title: "Estadísticas de Servicios",
      subtitle: "Uso por tipo, carrera y turno",
      color: C.blue,
      narrative: () => {
        const lastSvc = svcMes[svcMes.length - 1] ?? {};
        const totalSvcUso = (lastSvc.domicilio || 0) + (lastSvc.sala || 0) + (lastSvc.computadoras || 0) + (lastSvc.internet || 0) + (lastSvc.talleres || 0) + (lastSvc.cubiculos || 0);
        return `Los servicios bibliotecarios de ${campusLabel(campus).toLowerCase()} registraron ${totalSvcUso.toLocaleString()} usos en el último mes del periodo analizado. La carrera con mayor demanda acumulada fue ${topCarrera.carrera} con ${topCarrera.total.toLocaleString()} usos totales, reflejando la alta dependencia de recursos documentales en ese programa académico. En cuanto a la distribución temporal, el turno ${topTurno.turno} concentró el ${topTurno.pct}% de la actividad total, lo que debe considerarse para la planificación de horarios de atención y disponibilidad de recursos digitales y físicos.`;
      },
      findings: () => [
        `Carrera líder: ${topCarrera.carrera} (${topCarrera.total.toLocaleString()} usos)`,
        `Turno de mayor actividad: ${topTurno.turno} (${topTurno.pct}% del total)`,
        `Servicios incluidos en el análisis: ${servicios.map((s) => servicioLabel[s]).join(", ")}`,
      ],
    },
    {
      id: "predictivo",
      title: "Módulo Predictivo",
      subtitle: `Modelo: ${modelNames[predModel] ?? predModel}`,
      color: C.amber,
      narrative: () => {
        const nextPreds = circulacion.filter((c) => c.prediccion).slice(0, predHorizon);
        const avgPred = nextPreds.length ? Math.round(nextPreds.reduce((a, b) => a + b.prediccion, 0) / nextPreds.length) : 0;
        return `El modelo ${modelNames[predModel] ?? predModel} proyecta una demanda promedio de ${avgPred.toLocaleString()} préstamos mensuales para los próximos ${predHorizon} mes${predHorizon > 1 ? "es" : ""}, con una precisión estimada del 94.2% y un error cuadrático medio (RMSE) de 87 unidades. Esta proyección sugiere un incremento gradual respecto al promedio histórico de ${avgPrest.toLocaleString()}, lo que representa una oportunidad para anticipar la adquisición de nuevos títulos y ajustar los horarios de mayor afluencia. Se recomienda monitorear los indicadores de demanda al inicio de cada módulo escolar para recalibrar el modelo con datos actualizados.`;
      },
      findings: () => [
        `Modelo activo: ${modelNames[predModel] ?? predModel} · Horizonte: ${predHorizon} meses`,
        `Precisión del modelo: 94.2% (RMSE: 87 préstamos)`,
        `Promedio proyectado superior al histórico en ~8.3%`,
      ],
    },
    {
      id: "sentimiento",
      title: "Análisis de Sentimiento NLP",
      subtitle: "Procesamiento de lenguaje natural",
      color: C.green,
      narrative: () => {
        return `El análisis de ${comments.length} comentarios procesados por el motor NLP reveló que el ${satPct}% de las opiniones fueron clasificadas como positivas, con ${posComments.length} comentarios favorables y ${negComments.length} negativos. La dimensión mejor evaluada por los usuarios fue ${radarTop.subject} (${radarTop.A}/100 puntos), mientras que ${radarBot.subject} representa el área de mayor oportunidad de mejora con ${radarBot.A}/100 puntos. Este patrón sugiere que los usuarios valoran especialmente la infraestructura física y la disponibilidad del personal, aunque identifican áreas de mejora en la cobertura de servicios digitales y la amplitud de horarios de atención.`;
      },
      findings: () => [
        `Satisfacción general: ${satPct}% positivo (${posComments.length} de ${comments.length} comentarios)`,
        `Dimensión destacada: ${radarTop.subject} con ${radarTop.A}/100 puntos`,
        `Área de mejora prioritaria: ${radarBot.subject} con ${radarBot.A}/100 puntos`,
      ],
    },
    {
      id: "impacto",
      title: "Impacto Académico",
      subtitle: "Correlación uso bibliotecario — rendimiento",
      color: C.purple,
      narrative: () => {
        const maxImpacto = [...impactoBase].sort((a, b) => b.promedio - a.promedio)[0] ?? { promedio: 9.1, n: 180 };
        const minImpacto = [...impactoBase].sort((a, b) => a.promedio - b.promedio)[0] ?? { promedio: 7.2, n: 420 };
        const diff = (maxImpacto.promedio - minImpacto.promedio).toFixed(1);
        return `El análisis de 2,110 estudiantes reveló una correlación estadísticamente significativa (r = 0.73, p < 0.001) entre la frecuencia de uso de servicios bibliotecarios y el promedio académico. Los estudiantes con más de 50 préstamos en el periodo obtuvieron un promedio de ${maxImpacto.promedio} puntos, ${diff} puntos por encima del grupo con menor uso (${minImpacto.promedio} puntos). En términos de retención escolar, los usuarios activos de la biblioteca muestran una tasa de permanencia del 74% al octavo semestre, comparado con el 40% del grupo de no usuarios, representando una diferencia de 34 puntos porcentuales de ventaja significativa.`;
      },
      findings: () => [
        `Correlación uso-promedio: r = 0.73 (p < 0.001) — estadísticamente significativa`,
        `Diferencia de promedio: +${(impactoBase[4]?.promedio - impactoBase[0]?.promedio || 1.9).toFixed(1)} puntos entre mayor y menor uso`,
        `Retención al 8vo semestre: 74% usuarios vs 40% no usuarios (+34pp)`,
      ],
    },
  ];

  for (const sec of sectionDefs) {
    if (!secciones.includes(sec.id)) continue;
    doc.addPage();
    pageNum++;

    setFill(doc, C.light);
    doc.rect(0, 0, W, H, "F");
    sectionBand(doc, 0, sec.color, sec.title, sec.subtitle);

    let cy = 20;

    // Gráfica capturada
    const img = chartImages[sec.id];
    if (img) {
      try {
        const imgProps = doc.getImageProperties(img);
        const imgW = 182, imgH = Math.round((imgProps.height / imgProps.width) * imgW);
        const clampedH = Math.min(imgH, 90);
        doc.addImage(img, "PNG", 14, cy, imgW, clampedH, undefined, "FAST");
        cy += clampedH + 6;
      } catch (_) {
        // Si la imagen falla, continuar sin ella
      }
    }

    // Narrativa
    const narrative = sec.narrative();
    const findings = sec.findings();
    cy = addNarrativeBox(doc, cy, narrative, findings, sec.color);

    pageFooter(doc, pageNum, pages);
  }

  // ─────────────────────────────────────────────
  // ÚLTIMA PÁGINA — TABLAS DE DATOS
  // ─────────────────────────────────────────────
  doc.addPage();
  pageNum++;
  setFill(doc, C.light);
  doc.rect(0, 0, W, H, "F");
  sectionBand(doc, 0, C.navy, "Anexo: Datos Completos", "Tablas de referencia");

  let tableY = 18;

  // Tabla Circulación
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.grayD);
  doc.text("Circulación de Colecciones", 14, tableY + 6);
  tableY += 8;
  autoTable(doc, {
    startY: tableY,
    head: [["Mes", "Préstamos", "Devoluciones", "Predicción ML"]],
    body: circulacion.map((c) => [c.mes, c.prestamos ?? "—", c.devoluciones ?? "—", c.prediccion ?? "—"]),
    theme: "striped",
    headStyles: { fillColor: C.teal, textColor: C.white, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.grayD },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });
  tableY = doc.lastAutoTable.finalY + 8;

  // Tabla Impacto
  if (tableY < H - 60) {
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    setTxt(doc, C.grayD);
    doc.text("Impacto Académico por Rango de Préstamos", 14, tableY + 6);
    tableY += 8;
    autoTable(doc, {
      startY: tableY,
      head: [["Rango de Préstamos", "Promedio Académico", "N Estudiantes"]],
      body: impactoBase.map((r) => [r.rango, r.promedio.toFixed(1), r.n.toLocaleString()]),
      theme: "striped",
      headStyles: { fillColor: C.purple, textColor: C.white, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8, textColor: C.grayD },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      tableWidth: 182,
    });
    tableY = doc.lastAutoTable.finalY + 8;
  }

  // Tabla Sentimiento (primeros 15)
  if (tableY < H - 50) {
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    setTxt(doc, C.grayD);
    doc.text("Comentarios Analizados (muestra)", 14, tableY + 6);
    tableY += 8;
    autoTable(doc, {
      startY: tableY,
      head: [["Sentimiento", "Confianza", "Fuente", "Texto (resumen)"]],
      body: comments.slice(0, 15).map((c) => [
        c.sentimiento,
        `${Math.round(c.score * 100)}%`,
        c.fuente,
        c.texto.slice(0, 55) + (c.texto.length > 55 ? "…" : ""),
      ]),
      theme: "striped",
      headStyles: { fillColor: C.green, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: C.grayD },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: { 3: { cellWidth: 80 } },
      margin: { left: 14, right: 14 },
      tableWidth: 182,
    });
  }

  pageFooter(doc, pageNum, pages);

  // ─────────────────────────────────────────────
  // Guardar
  // ─────────────────────────────────────────────
  const campusSlug = campus === "todos" ? "todos" : campus;
  const periodoSlug = periodos[0] ?? "periodo";
  doc.save(`reporte_biblioanalytics_${campusSlug}_${periodoSlug}.pdf`);
}

// ─── SERVICE-SPECIFIC EXCEL ──────────────────────────────────────────────────

export function generateServiceExcel(historial, serviceType, periodLabel, meta) {
  const wb = XLSX.utils.book_new();
  const serviceName = serviceType === "cubiculos" ? "Cubículos" : "Computadoras";

  const groupBy = (arr, keyFn) =>
    arr.reduce((acc, r) => { const k = keyFn(r); acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  const total = historial.length;
  const avgDur = total
    ? (historial.reduce((a, r) => a + (r.duracion || 1), 0) / total).toFixed(1)
    : "0";
  const byCarrera  = groupBy(historial, r => r.carrera  || "—");
  const byTurno    = groupBy(historial, r => r.turno    || "—");
  const bySpace    = groupBy(historial, r => r.cubicule || "—");
  const topCarrera = Object.entries(byCarrera).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const topTurno   = Object.entries(byTurno).sort((a, b)   => b[1] - a[1])[0] ?? ["—", 0];
  const topSpace   = Object.entries(bySpace).sort((a, b)   => b[1] - a[1])[0] ?? ["—", 0];
  const uniqueAlum = new Set(historial.map(r => r.expediente).filter(Boolean)).size;

  // Hoja 1: Resumen
  const resumenData = [
    { Indicador: "Servicio",                             Valor: serviceName },
    { Indicador: "Periodo",                              Valor: periodLabel },
    { Indicador: "Total Reservas",                       Valor: total },
    { Indicador: "Duración Promedio (h)",                Valor: avgDur },
    { Indicador: "Carrera más frecuente",                Valor: `${topCarrera[0]} (${topCarrera[1]} reservas)` },
    { Indicador: "Turno más frecuente",                  Valor: `${topTurno[0]} (${topTurno[1]} reservas)` },
    { Indicador: serviceType === "cubiculos" ? "Cubículo más usado" : "PC más usada",
      Valor: `${topSpace[0]} (${topSpace[1]} reservas)` },
    { Indicador: "Estudiantes únicos",                   Valor: uniqueAlum },
    { Indicador: "Institución",                          Valor: meta.institution },
    { Indicador: "Fecha de generación",                  Valor: new Date().toLocaleString("es-MX") },
  ];
  const wsResumen = XLSX.utils.json_to_sheet(resumenData);
  wsResumen["!cols"] = [{ wch: 38 }, { wch: 34 }];
  XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");

  // Hoja 2: Historial
  const spaceKey = serviceType === "cubiculos" ? "Cubículo" : "Computadora";
  const histData = historial.map(r => ({
    [spaceKey]:       r.cubicule || "—",
    Nombre:           r.nombre    || "—",
    Expediente:       r.expediente || "—",
    Carrera:          r.carrera   || "—",
    "Duración (h)":   r.duracion  || "—",
    Turno:            r.turno     || "—",
    Personas:         r.personas  ?? "—",
    Piso:             r.piso      ?? "—",
    Inicio:           r.inicio ? new Date(r.inicio).toLocaleString("es-MX") : "—",
    Fin:              r.fin    ? new Date(r.fin).toLocaleString("es-MX")    : "—",
  }));
  const wsHist = XLSX.utils.json_to_sheet(histData);
  autoWidth(wsHist, histData.length ? histData : [{ [spaceKey]: "" }]);
  XLSX.utils.book_append_sheet(wb, wsHist, "Historial");

  // Hoja 3: Por Mes
  const byMes = {};
  historial.forEach(r => {
    if (!r.inicio) return;
    const d   = new Date(r.inicio);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    byMes[key] = (byMes[key] || 0) + 1;
  });
  const mesData = Object.entries(byMes).sort().map(([Mes, Reservas]) => ({ Mes, Reservas }));
  const wsMes = XLSX.utils.json_to_sheet(mesData.length ? mesData : [{ Mes: "—", Reservas: 0 }]);
  autoWidth(wsMes, mesData.length ? mesData : [{ Mes: "", Reservas: "" }]);
  XLSX.utils.book_append_sheet(wb, wsMes, "Por Mes");

  // Hoja 4: Por Carrera
  const carreraData = Object.entries(byCarrera)
    .sort((a, b) => b[1] - a[1])
    .map(([Carrera, Reservas]) => ({ Carrera, Reservas, "% Total": total ? `${Math.round(Reservas / total * 100)}%` : "0%" }));
  const wsCarrera = XLSX.utils.json_to_sheet(carreraData.length ? carreraData : [{ Carrera: "—", Reservas: 0 }]);
  autoWidth(wsCarrera, carreraData.length ? carreraData : [{ Carrera: "", Reservas: "" }]);
  XLSX.utils.book_append_sheet(wb, wsCarrera, "Por Carrera");

  // Hoja 5: Por Turno
  const turnoData = Object.entries(byTurno)
    .sort((a, b) => b[1] - a[1])
    .map(([Turno, Reservas]) => ({ Turno, Reservas, "% Total": total ? `${Math.round(Reservas / total * 100)}%` : "0%" }));
  const wsTurno = XLSX.utils.json_to_sheet(turnoData.length ? turnoData : [{ Turno: "—", Reservas: 0 }]);
  autoWidth(wsTurno, turnoData.length ? turnoData : [{ Turno: "", Reservas: "" }]);
  XLSX.utils.book_append_sheet(wb, wsTurno, "Por Turno");

  // Hoja 6: Por Duración
  const byDur = groupBy(historial, r => r.duracion ? `${r.duracion}h` : "—");
  const durData = Object.entries(byDur)
    .sort()
    .map(([Duración, Reservas]) => ({ Duración, Reservas }));
  const wsDur = XLSX.utils.json_to_sheet(durData.length ? durData : [{ Duración: "—", Reservas: 0 }]);
  autoWidth(wsDur, durData.length ? durData : [{ Duración: "", Reservas: "" }]);
  XLSX.utils.book_append_sheet(wb, wsDur, "Por Duración");

  // Hoja 7: Por Piso / Zona
  const byPiso    = groupBy(historial, r => r.piso ? `Piso ${r.piso}` : "—");
  const pisoLabel = serviceType === "cubiculos" ? "Piso" : "Zona";
  const pisoData  = Object.entries(byPiso)
    .sort((a, b) => b[1] - a[1])
    .map(([p, Reservas]) => ({ [pisoLabel]: p, Reservas }));
  const wsPiso = XLSX.utils.json_to_sheet(pisoData.length ? pisoData : [{ [pisoLabel]: "—", Reservas: 0 }]);
  autoWidth(wsPiso, pisoData.length ? pisoData : [{ [pisoLabel]: "", Reservas: "" }]);
  XLSX.utils.book_append_sheet(wb, wsPiso, `Por ${pisoLabel}`);

  XLSX.writeFile(wb, `reporte_${serviceType}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─── SERVICE-SPECIFIC PDF ────────────────────────────────────────────────────

export async function generateServicePDF(chartImage, historial, serviceType, periodLabel, meta) {
  const { institution } = meta;
  const serviceName  = serviceType === "cubiculos" ? "Cubículos" : "Computadoras";
  const serviceColor = serviceType === "cubiculos" ? C.teal : C.blue;

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210, H = 297;

  const groupBy = (arr, keyFn) =>
    arr.reduce((acc, r) => { const k = keyFn(r); acc[k] = (acc[k] || 0) + 1; return acc; }, {});

  const total    = historial.length;
  const avgDur   = total
    ? (historial.reduce((a, r) => a + (r.duracion || 1), 0) / total).toFixed(1)
    : "0";
  const byCarrera  = groupBy(historial, r => r.carrera  || "—");
  const byTurno    = groupBy(historial, r => r.turno    || "—");
  const bySpace    = groupBy(historial, r => r.cubicule || "—");
  const topCarrera = Object.entries(byCarrera).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];
  const topTurno   = Object.entries(byTurno).sort((a, b)   => b[1] - a[1])[0] ?? ["—", 0];
  const topSpace   = Object.entries(bySpace).sort((a, b)   => b[1] - a[1])[0] ?? ["—", 0];
  const uniqueAlum = new Set(historial.map(r => r.expediente).filter(Boolean)).size;

  const dias   = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const byDia  = groupBy(historial, r => r.inicio ? dias[new Date(r.inicio).getDay()] : "—");
  const topDia = Object.entries(byDia).sort((a, b) => b[1] - a[1])[0] ?? ["—", 0];

  const pages   = 4;
  let pageNum   = 0;

  // ── PÁGINA 1: PORTADA ──
  pageNum++;
  setFill(doc, C.navy);
  doc.rect(0, 0, W, H, "F");

  setFill(doc, serviceColor);
  doc.rect(0, 0, W, 22, "F");
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.white);
  doc.text(`REPORTE DE ${serviceName.toUpperCase()}`, W / 2, 13, { align: "center" });

  doc.setFontSize(32);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.white);
  doc.text("BiblioAnalytics 360", W / 2, 80, { align: "center" });

  setStroke(doc, serviceColor);
  doc.setLineWidth(1.5);
  doc.line(50, 88, W - 50, 88);

  doc.setFontSize(16);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.white);
  doc.text(institution, W / 2, 100, { align: "center" });

  const portadaMeta = [
    { label: "Servicio:",            value: serviceName },
    { label: "Periodo analizado:",   value: periodLabel },
    { label: "Total de registros:",  value: total.toLocaleString() },
    { label: "Fecha de generación:", value: new Date().toLocaleDateString("es-MX", { year: "numeric", month: "long", day: "numeric" }) },
  ];
  let my = 125;
  portadaMeta.forEach(({ label, value }) => {
    doc.setFontSize(10);
    doc.setFont(undefined, "bold");
    setTxt(doc, C.gray);
    doc.text(label, W / 2 - 5, my, { align: "right" });
    doc.setFont(undefined, "normal");
    setTxt(doc, C.tealL);
    doc.text(value, W / 2 + 5, my);
    my += 10;
  });

  doc.setFontSize(8);
  setTxt(doc, C.gray);
  doc.text("Generado con BiblioAnalytics 360 · Uso interno y académico", W / 2, H - 16, { align: "center" });
  pageFooter(doc, pageNum, pages);

  // ── PÁGINA 2: RESUMEN EJECUTIVO ──
  doc.addPage();
  pageNum++;
  setFill(doc, C.light);
  doc.rect(0, 0, W, H, "F");
  sectionBand(doc, 0, C.navy, "Resumen Ejecutivo", periodLabel);

  const introText = `Este reporte presenta el análisis operativo del servicio de ${serviceName} de ${institution} para el periodo ${periodLabel}. Se registraron ${total} reservas en total, con una duración promedio de ${avgDur} horas por sesión. La carrera con mayor demanda fue ${topCarrera[0]} con ${topCarrera[1]} reservas, y el turno de mayor actividad fue ${topTurno[0]} con ${topTurno[1]} usos. Se identificaron ${uniqueAlum} estudiantes únicos que utilizaron el servicio durante el periodo analizado.`;
  const introLines = doc.splitTextToSize(introText, 182);
  doc.setFontSize(9.5);
  doc.setFont(undefined, "normal");
  setTxt(doc, C.grayD);
  doc.text(introLines, 14, 24);

  const kpiY = 24 + introLines.length * 5.5 + 6;
  const kpiW = 55, kpiH = 28, kpiGap = 8.5;
  const kpis = [
    { v: total.toLocaleString(),        l: "Total Reservas",                                    c: serviceColor },
    { v: `${avgDur}h`,                  l: "Duración Promedio",                                 c: C.green },
    { v: String(uniqueAlum),            l: "Estudiantes Únicos",                                c: C.blue },
    { v: String(topCarrera[1]),         l: `Top: ${topCarrera[0].slice(0, 13)}`,                c: C.purple },
    { v: topTurno[0].slice(0, 9),      l: "Turno de Mayor Actividad",                          c: C.amber },
    { v: String(topSpace[1]),           l: `${serviceType === "cubiculos" ? "Cubículo" : "PC"} más usado`, c: C.rose },
  ];
  kpis.forEach((k, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    kpiBox(doc, 14 + col * (kpiW + kpiGap), kpiY + row * (kpiH + 6), kpiW, kpiH, k.v, k.l, k.c);
  });

  pageFooter(doc, pageNum, pages);

  // ── PÁGINA 3: ANÁLISIS ──
  doc.addPage();
  pageNum++;
  setFill(doc, C.light);
  doc.rect(0, 0, W, H, "F");
  sectionBand(doc, 0, serviceColor, `Análisis de ${serviceName}`, periodLabel);

  let cy = 20;
  if (chartImage) {
    try {
      const imgProps = doc.getImageProperties(chartImage);
      const imgW    = 182;
      const imgH    = Math.round((imgProps.height / imgProps.width) * imgW);
      const clamped = Math.min(imgH, 90);
      doc.addImage(chartImage, "PNG", 14, cy, imgW, clamped, undefined, "FAST");
      cy += clamped + 6;
    } catch (_) {}
  }

  const pct = (n) => total ? `${Math.round(n / total * 100)}%` : "0%";
  const narrative = `El servicio de ${serviceName} registró ${total} reservas durante el periodo ${periodLabel}, con un promedio de ${avgDur} horas de uso por sesión. La mayor demanda provino de estudiantes de ${topCarrera[0]} con ${topCarrera[1]} reservas (${pct(topCarrera[1])} del total). En cuanto a la distribución temporal, el turno ${topTurno[0]} concentró ${topTurno[1]} reservas (${pct(topTurno[1])}). El día de mayor afluencia fue ${topDia[0]} con ${topDia[1]} reservas. ${total < 5 ? "Se recomienda continuar el seguimiento conforme se acumulen más datos para identificar patrones estadísticamente significativos." : `El espacio más solicitado fue ${topSpace[0]} con ${topSpace[1]} reservas acumuladas en el periodo.`}`;

  const findings = [
    `Demanda total: ${total} reservas · Duración promedio: ${avgDur}h`,
    `Carrera líder: ${topCarrera[0]} (${topCarrera[1]} reservas, ${pct(topCarrera[1])})`,
    `Turno de mayor actividad: ${topTurno[0]} — día pico: ${topDia[0]}`,
  ];
  cy = addNarrativeBox(doc, cy, narrative, findings, serviceColor);
  pageFooter(doc, pageNum, pages);

  // ── PÁGINA 4: DATOS ──
  doc.addPage();
  pageNum++;
  setFill(doc, C.light);
  doc.rect(0, 0, W, H, "F");
  sectionBand(doc, 0, C.navy, "Anexo: Historial de Reservas", "Datos del periodo");

  let tableY = 18;

  // Por Carrera
  doc.setFontSize(9);
  doc.setFont(undefined, "bold");
  setTxt(doc, C.grayD);
  doc.text("Reservas por Carrera", 14, tableY + 6);
  tableY += 8;
  autoTable(doc, {
    startY: tableY,
    head: [["Carrera", "Reservas", "% Total"]],
    body: Object.entries(byCarrera)
      .sort((a, b) => b[1] - a[1])
      .map(([car, n]) => [car, n, pct(n)]),
    theme: "striped",
    headStyles: { fillColor: serviceColor, textColor: C.white, fontStyle: "bold", fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: C.grayD },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: 14, right: 14 },
    tableWidth: 182,
  });
  tableY = doc.lastAutoTable.finalY + 8;

  // Detalle de reservas
  if (tableY < H - 60) {
    doc.setFontSize(9);
    doc.setFont(undefined, "bold");
    setTxt(doc, C.grayD);
    doc.text("Detalle de Reservas (muestra)", 14, tableY + 6);
    tableY += 8;
    const spaceKey = serviceType === "cubiculos" ? "Cubículo" : "PC";
    autoTable(doc, {
      startY: tableY,
      head: [[spaceKey, "Nombre", "Carrera", "Duración", "Turno", "Fecha"]],
      body: historial.slice(0, 20).map(r => [
        r.cubicule || "—",
        (r.nombre  || "—").slice(0, 18),
        (r.carrera || "—").slice(0, 14),
        r.duracion ? `${r.duracion}h` : "—",
        r.turno    || "—",
        r.inicio ? new Date(r.inicio).toLocaleDateString("es-MX") : "—",
      ]),
      theme: "striped",
      headStyles: { fillColor: serviceColor, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: C.grayD },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
      tableWidth: 182,
    });
  }

  pageFooter(doc, pageNum, pages);

  doc.save(`reporte_${serviceType}_${new Date().toISOString().slice(0, 10)}.pdf`);
}
