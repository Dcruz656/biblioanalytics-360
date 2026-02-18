# BiblioAnalytics 360

**Plataforma de analítica avanzada para bibliotecas universitarias**

Herramienta integral que integra Machine Learning y NLP para transformar datos bibliotecarios en conocimiento estratégico.

## 🚀 Deploy Rápido (5 minutos)

### Prerrequisitos

- [Node.js](https://nodejs.org/) v18+ instalado
- Cuenta de [GitHub](https://github.com/)
- Cuenta de [Vercel](https://vercel.com/) (gratis, login con GitHub)

### Paso 1: Instalar dependencias

```bash
npm install
```

### Paso 2: Correr en local

```bash
npm run dev
```

Abre http://localhost:5173 para ver el dashboard.

### Paso 3: Subir a GitHub

```bash
git init
git add .
git commit -m "feat: BiblioAnalytics 360 - prototipo inicial"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/biblioanalytics-360.git
git push -u origin main
```

### Paso 4: Desplegar en Vercel

1. Ve a [vercel.com/new](https://vercel.com/new)
2. Haz clic en **"Import Git Repository"**
3. Selecciona `biblioanalytics-360`
4. Vercel detecta Vite automáticamente — haz clic en **Deploy**
5. En ~60 segundos tendrás tu URL: `biblioanalytics-360.vercel.app`

¡Listo! Cada `git push` actualiza la plataforma automáticamente.

---

## 📁 Estructura del Proyecto

```
biblioanalytics-360/
├── public/
│   └── favicon.svg
├── src/
│   ├── BiblioAnalytics360.jsx   ← Dashboard principal
│   ├── App.jsx                   ← Wrapper
│   ├── main.jsx                  ← Entry point
│   └── index.css                 ← Estilos globales
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## 🛠️ Stack Tecnológico

| Capa | Tecnología | Status |
|------|-----------|--------|
| Frontend | React + Vite + Tailwind CSS | ✅ Listo |
| Gráficos | Recharts | ✅ Listo |
| Iconos | Lucide React | ✅ Listo |
| Hosting | Vercel | ✅ Configurado |
| Backend API | FastAPI (Python) | 🔜 Siguiente fase |
| Base de Datos | Supabase (PostgreSQL) | 🔜 Siguiente fase |
| NLP | Hugging Face BETO | 🔜 Siguiente fase |
| Auth | Supabase Auth | 🔜 Siguiente fase |

## 📋 Funcionalidades del Prototipo

- ✅ Dashboard con 5 módulos navegables
- ✅ Filtros interactivos (Campus, Periodo) que modifican datos
- ✅ Motor NLP simulado para análisis de sentimiento
- ✅ Controles del modelo predictivo (algoritmo, horizonte)
- ✅ Upload de archivos CSV/Excel
- ✅ Exportación de datos a CSV
- ✅ Sistema de notificaciones
- ✅ Modo oscuro/claro
- ✅ Diseño responsivo

## 🗺️ Roadmap

### Fase 1 — Frontend (actual)
- [x] Dashboard interactivo con datos simulados
- [x] Módulo predictivo con controles
- [x] Módulo de sentimiento con entrada NLP
- [x] Módulo de impacto académico
- [x] Upload y gestión de datos

### Fase 2 — Backend + Base de Datos
- [ ] Configurar Supabase (PostgreSQL)
- [ ] Crear esquema de tablas (prestamos, visitas, comentarios, estudiantes)
- [ ] API REST con FastAPI
- [ ] Conectar frontend a datos reales

### Fase 3 — ML / NLP
- [ ] Entrenar modelo Random Forest con datos UACJ
- [ ] Configurar Prophet para series de tiempo
- [ ] Integrar BETO para sentimiento en español
- [ ] Pipeline de predicción automatizado

### Fase 4 — Producción
- [ ] Autenticación con roles (Supabase Auth)
- [ ] Dominio personalizado
- [ ] Documentación técnica completa

---

**Autor:** Daniel C. Bautista  
**Proyecto:** Maestría en Bibliotecología / Ciencias de la Información  
**Institución:** UACJ
