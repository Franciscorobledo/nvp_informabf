import React, { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DatasetSummaryPanel from "./DatasetSummaryPanel";
import DataMoviePlayer from "./DataMoviePlayer";

const FileUpload = ({ onDataReceived, onUnauthorized }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [downloading, setDownloading] = useState(false);
  const [aiCharts, setAiCharts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [uploadMode, setUploadMode] = useState("local");
  const [drivePickerReady, setDrivePickerReady] = useState(false);
  const [selectedDriveFileName, setSelectedDriveFileName] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");
  const filterSelectRef = useRef(null);

  const tokenClientRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", resolve);
        existingScript.addEventListener("error", reject);
        if (
          existingScript.dataset.loaded ||
          existingScript.readyState === "complete"
        )
          return resolve();
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });

  useEffect(() => {
    let cancelled = false;

    const initGoogleApis = async () => {
      try {
        await loadScript("https://accounts.google.com/gsi/client");
        await loadScript("https://apis.google.com/js/api.js");

        await new Promise((resolve, reject) => {
          window?.gapi?.load("client:picker", {
            callback: resolve,
            onerror: () => reject(new Error("No se pudo cargar Google API")),
          });
        });

        if (!cancelled) setDrivePickerReady(true);
      } catch (error) {
        console.error("Error al inicializar Google Drive Picker:", error);
      }
    };

    initGoogleApis();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!drivePickerReady || !googleClientId || !window.google?.accounts?.oauth2)
      return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: () => {},
    });
  }, [drivePickerReady, googleClientId]);

  const categoryKeywords = {
    ventas: [
      "venta",
      "ventas",
      "sale",
      "sales",
      "ingreso",
      "ingresos",
      "revenue",
      "facturacion",
    ],
    stock: ["stock", "inventario", "existencia", "bodega", "almacen"],
    producto: ["producto", "sku", "item", "referencia", "catalogo"],
    reportes: ["reporte", "report", "analisis", "analysis"],
    auditoria: [
      "auditoria",
      "control",
      "riesgo",
      "compliance",
      "fraude",
      "hallazgo",
      "segregacion",
      "acceso",
      "log",
      "trazabilidad",
    ],
  };

  const matchesCategory = (text, category) => {
    if (category === "todos") return true;
    const normalized = String(text || "").toLowerCase();
    const keywords = categoryKeywords[category] || [];
    return keywords.some((keyword) => normalized.includes(keyword));
  };

  const filterGraphsByCategory = (graphs = []) => {
    if (categoryFilter === "todos") return graphs;
    const filtered = graphs.filter((chart) =>
      matchesCategory(chart?.column || chart?.title || chart?.type, categoryFilter)
    );
    return filtered.length ? filtered : graphs;
  };

  const filterSummaryByCategory = (summary) => {
    if (categoryFilter === "todos" || !summary) return summary;

    if (typeof summary === "string") {
      return matchesCategory(summary, categoryFilter) ? summary : summary;
    }

    if (Array.isArray(summary)) {
      const filtered = summary.filter((item) =>
        matchesCategory(JSON.stringify(item), categoryFilter)
      );
      return filtered.length ? filtered : summary;
    }

    if (typeof summary === "object") {
      const filteredEntries = Object.entries(summary).filter(([key, value]) =>
        matchesCategory(`${key} ${value}`, categoryFilter)
      );
      return filteredEntries.length ? Object.fromEntries(filteredEntries) : summary;
    }

    return summary;
  };

  const filterInsights = (text) => {
    if (categoryFilter === "todos" || !text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const filtered = sentences.filter((sentence) =>
      matchesCategory(sentence, categoryFilter)
    );
    return filtered.length ? filtered.join(" ") : text;
  };

  const renderHealthPanel = () => {
    const kpi = analysis?.data_health;
    if (!kpi) return null;

    const statusConfig = {
      healthy: {
        label: "Saludable",
        badgeBg: "bg-emerald-100 dark:bg-emerald-900/60",
        badgeText: "text-emerald-800 dark:text-emerald-100",
        border: "border-emerald-200 dark:border-emerald-800",
        bar: "bg-emerald-500",
      },
      watch: {
        label: "Revisar",
        badgeBg: "bg-amber-100 dark:bg-amber-900/60",
        badgeText: "text-amber-800 dark:text-amber-100",
        border: "border-amber-200 dark:border-amber-800",
        bar: "bg-amber-400",
      },
      critical: {
        label: "Crítico",
        badgeBg: "bg-rose-100 dark:bg-rose-900/60",
        badgeText: "text-rose-800 dark:text-rose-100",
        border: "border-rose-200 dark:border-rose-800",
        bar: "bg-rose-500",
      },
    };

    const config = statusConfig[kpi.health_status] || statusConfig.watch;
    const scoreValue = Math.max(0, Math.min(100, kpi.health_score ?? 0));

    return (
      <div
        className={`mb-6 p-6 rounded-2xl bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 border shadow-sm ${config.border}`}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-gray-600 dark:text-slate-300">
              🩺 KPI Health Score
            </p>
            <div className="flex items-end gap-3">
              <span className="text-4xl font-extrabold text-gray-900 dark:text-white">
                {kpi.health_score ?? "--"}
              </span>
              <span
                className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold ${config.badgeBg} ${config.badgeText}`}
              >
                <span className="text-lg" role="img" aria-hidden="true">
                  {kpi.health_status === "healthy" ? "✅" : kpi.health_status === "watch" ? "⚠️" : "🚨"}
                </span>
                {config.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              0 = crítico, 100 = excelente. Calculado según nulos, formatos, fechas, duplicados, stock y outliers.
            </p>
          </div>

          <div className="flex-1 space-y-3">
            <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full ${config.bar}`}
                style={{ width: `${scoreValue}%` }}
                role="presentation"
              />
            </div>

            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-slate-200 mb-2">
                Principales drivers
              </p>
              {kpi.drivers?.length ? (
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-slate-200">
                  {kpi.drivers.map((driver, idx) => (
                    <li key={`${driver}-${idx}`}>{driver}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-500 dark:text-slate-400">
                  Sin riesgos significativos detectados.
                </p>
              )}
            </div>

            {kpi.recommendations?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {kpi.recommendations.slice(0, 4).map((rec, idx) => (
                  <span
                    key={`${rec}-${idx}`}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-200 text-xs"
                  >
                    <span aria-hidden="true">💡</span>
                    {rec}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const buildSuggestedActions = () => {
    if (!analysis) return [];

    const pushUnique = (list, value) => {
      if (value && !list.includes(value)) list.push(value);
    };

    const focusKey = categoryFilter === "todos" ? "general" : categoryFilter;

    const focusActions = {
      ventas: [
        "Planifica una campaña específica para los segmentos con mayor crecimiento y mide el uplift semanal.",
        "Revisa precios y disponibilidad de los productos top para evitar quiebres durante promociones.",
        "Activa alertas cuando las ventas caigan frente a la semana anterior y define un responsable por línea.",
      ],
      stock: [
        "Prioriza reposiciones para los SKU con mayor rotación y define stock de seguridad por tienda o canal.",
        "Identifica excesos de inventario y prepara un plan de liquidación o bundles para liberar bodegas.",
        "Automatiza alertas de stock mínimo en los productos críticos y confirma con logística su cumplimiento.",
      ],
      producto: [
        "Revisa la conversión y satisfacción de las referencias con peor desempeño y define mejoras rápidas.",
        "Impulsa bundles o cross-selling usando los productos que aparecen con mayor frecuencia en las ventas.",
        "Valida consistencia de atributos (precio, categoría, código) antes del siguiente corte de datos.",
      ],
      reportes: [
        "Prepara un resumen ejecutivo con los hallazgos clave y compártelo con los stakeholders esta semana.",
        "Crea un tablero recurrente con los KPIs destacados y agenda revisión quincenal con los responsables.",
        "Documenta supuestos y limitaciones del dataset para que el equipo los tenga presentes en decisiones.",
      ],
      auditoria: [
        "Monitorea la ejecución de controles críticos (plan vs. ejecutado) y documenta las excepciones con evidencias.",
        "Revisa accesos y segregación de funciones en procesos sensibles y genera alertas por accesos no revisados.",
        "Da seguimiento a hallazgos abiertos: aging, reincidencias y tiempos de remediación por responsable.",
      ],
      general: [
        "Comparte los hallazgos principales con el equipo y acuerda responsables y fechas de seguimiento.",
        "Crea un tablero semanal con los KPIs críticos y revisa variaciones frente al período anterior.",
        "Define un ciclo de retroalimentación: mide impacto de las acciones y ajusta en la siguiente iteración.",
      ],
    };

    const actions = [];

    const filteredCharts = filterGraphsByCategory(analysis.graphs || []);
    const [firstChart, secondChart] = filteredCharts;

    if (firstChart?.column || firstChart?.title) {
      pushUnique(
        actions,
        `Monitorea el indicador "${firstChart.column || firstChart.title}" en un tablero semanal y asigna un responsable.`,
      );
    }

    if (secondChart?.column || secondChart?.title) {
      pushUnique(
        actions,
        `Profundiza en el gráfico "${secondChart.column || secondChart.title}" para explicar variaciones y documenta el plan de acción.`,
      );
    }

    const insightSentences = (filterInsights(analysis.ai_summary) || "")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/^[-•\d\s]+/, "").trim())
      .filter(Boolean);

    insightSentences.slice(0, 2).forEach((sentence) => {
      pushUnique(actions, `Convierte este hallazgo en tarea concreta: ${sentence}`);
    });

    (focusActions[focusKey] || focusActions.general).forEach((action) =>
      pushUnique(actions, action)
    );

    return actions.slice(0, 4);
  };

  const generateAiCharts = (sample = []) => {
    if (!Array.isArray(sample) || sample.length === 0) return [];

    const rows = sample.slice(0, 50);
    const keys = Object.keys(rows[0] || {});
    const numericKeys = keys.filter((key) =>
      rows.some((row) => typeof row?.[key] === "number" && Number.isFinite(row[key]))
    );
    const stringKeys = keys.filter((key) => rows.some((row) => typeof row?.[key] === "string"));

    const charts = [];

    if (numericKeys.length && stringKeys.length) {
      const [categoryKey] = stringKeys;
      const [metricKey] = numericKeys;

      const grouped = rows.reduce((acc, row) => {
        const category = row?.[categoryKey] ?? "Sin dato";
        const value = Number(row?.[metricKey]) || 0;
        acc[category] = (acc[category] || 0) + value;
        return acc;
      }, {});

      const data = Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      charts.push({
        type: "bar",
        title: `Distribución de ${metricKey} por ${categoryKey}`,
        data,
        xKey: "name",
        yKey: "value",
      });
    }

    if (charts.length < 2 && numericKeys.length) {
      const metricKey = numericKeys[0];
      const data = rows.slice(0, 20).map((row, index) => ({
        index: index + 1,
        value: Number(row?.[metricKey]) || 0,
      }));

      charts.push({
        type: "line",
        title: `Tendencia inicial de ${metricKey}`,
        data,
        xKey: "index",
        yKey: "value",
      });
    }

    return charts.slice(0, 2);
  };

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

  const downloadDriveFile = async (fileId, accessToken, suggestedName) => {
    try {
      setDriveLoading(true);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message || "No se pudo descargar el archivo desde Google Drive."
        );
      }

      const blob = await response.blob();
      const extension = blob.type?.split("/")?.[1] || "dat";
      const filename =
        suggestedName?.trim() || `drive-file-${fileId}.${extension}`;
      const driveFile = new File([blob], filename, { type: blob.type });
      setFiles([driveFile]);
      setUploadMode("local");
      setSelectedDriveFileName(driveFile.name);
      alert(
        `Archivo importado desde Google Drive y listo para analizar: ${driveFile.name}`
      );
    } catch (error) {
      console.error("Error al descargar archivo de Drive:", error);
      alert(error.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const openDrivePicker = () => {
    if (!googleApiKey || !googleClientId)
      return alert(
        "Faltan las claves de Google (VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY)."
      );

    if (!drivePickerReady || !tokenClientRef.current)
      return alert("Google Drive Picker aún no está listo. Intenta de nuevo en unos segundos.");

    setDriveLoading(true);

    tokenClientRef.current.callback = (response) => {
      if (response.error) {
        console.error("Error de autenticación con Google:", response);
        setDriveLoading(false);
        return;
      }

      const accessToken = response.access_token;

      const view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_DISABLED)
        .setDeveloperKey(googleApiKey)
        .setOAuthToken(accessToken)
        .setLocale("es")
        .addView(view)
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs?.[0];
            if (file?.id) {
              downloadDriveFile(file.id, accessToken, file.name);
            }
          }

          if (data.action === window.google.picker.Action.CANCEL) {
            setDriveLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
    };

    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  };

  const handleUpload = async () => {
    if (!files.length)
      return alert("Selecciona al menos un archivo .csv, .xlsx o .zip primero.");
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    const formData = new FormData();
    files.forEach((fileItem) => formData.append("files", fileItem));
    setLoading(true);

    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";
      console.log("🌐 Subiendo archivo a:", `${API_URL}/upload`);

      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();

        if ([401, 403].includes(res.status)) {
          onUnauthorized?.("Tu sesión expiró. Por favor, vuelve a iniciar sesión.");
          return;
        }

        console.error("❌ Error del servidor:", msg);
        alert(`Error del servidor: ${msg}`);
        return;
      }

      const data = await res.json();
      console.log("📊 Datos del backend:", data);
      setAnalysis(data);
      setAiCharts(generateAiCharts(data.sample));
      onDataReceived?.(data);
    } catch (err) {
      console.error("💥 Error al conectar con el backend:", err);
      alert("Error de conexión. Verifica que el backend esté corriendo en el puerto 1000.");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!analysis) return;
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    try {
      setDownloading(true);
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";
      const res = await fetch(`${API_URL}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ analysis }),
      });

      if (!res.ok) {
        if ([401, 403].includes(res.status)) {
          onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión para descargar el reporte.");
          return;
        }

        const message = await res.text();
        throw new Error(message || "No se pudo generar el reporte.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Reporte_InformeBF.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al generar el reporte:", error);
      alert(`No se pudo generar el reporte: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendReportEmail = async () => {
    if (!analysis) return;
    if (!reportEmail.trim()) {
      setEmailFeedback("Ingresa un correo válido para enviar el reporte.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    try {
      setSendingReport(true);
      setEmailFeedback("");
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";
      const res = await fetch(`${API_URL}/report/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ analysis, email: reportEmail.trim() }),
      });

      if (!res.ok) {
        if ([401, 403].includes(res.status)) {
          onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión para enviar el reporte.");
          return;
        }

        const message = await res.text();
        throw new Error(message || "No se pudo enviar el reporte por correo.");
      }

      setEmailFeedback("📨 Reporte enviado correctamente al correo indicado.");
    } catch (error) {
      console.error("Error al enviar el reporte:", error);
      setEmailFeedback(`⚠️ ${error.message}`);
    } finally {
      setSendingReport(false);
    }
  };

  const tabs = [
    { id: "resumen", label: "📄 Resumen" },
    { id: "graficos", label: "📊 Visualizaciones" },
    { id: "insights", label: "🤖 Insights IA" },
    { id: "reporte", label: "📑 Reporte ejecutivo" },
  ];

  const suggestedActions = buildSuggestedActions();

  const getFocusIndicators = () => {
    if (categoryFilter !== "auditoria") return [];

    return [
      {
        title: "Controles y cumplimiento",
        description:
          "% de controles críticos ejecutados vs. planificados y tasa de excepciones documentadas.",
      },
      {
        title: "Accesos y segregación",
        description:
          "% de accesos críticos revisados, violaciones de segregación de funciones y usuarios con privilegios temporales.",
      },
      {
        title: "Hallazgos y remediación",
        description:
          "Número de hallazgos abiertos, días promedio de cierre, reincidencias y SLA de remediación por responsable.",
      },
      {
        title: "Trazabilidad operacional",
        description:
          "Transacciones sin evidencia o fuera de horario, cambios en datos maestros y anomalías detectadas en logs.",
      },
    ];
  };

  const focusInsightsPanel = () => setActiveTab("insights");

  const focusFilter = () => {
    setActiveTab("resumen");
    filterSelectRef.current?.focus();
  };

  return (
    <div className="flex flex-col items-center space-y-6 w-full max-w-5xl mx-auto text-gray-800 dark:text-slate-100">
      <div className="w-full px-2">
        <label
          htmlFor="category-filter"
          className="block text-sm font-semibold text-gray-700 dark:text-slate-100"
        >
          🎯 Foco del informe
        </label>
        <p className="text-xs text-gray-600 dark:text-slate-300 mb-2">
          Elige un contexto (ventas, stock, producto, auditoría o reportes)
          para priorizar los KPIs y visualizaciones más relevantes. "Todo"
          mantiene el comportamiento actual.
        </p>
        <div className="relative w-full sm:w-80">
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            ref={filterSelectRef}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 pr-10 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-100"
          >
            <option value="todos">🔎 Todo / sin filtro</option>
            <option value="ventas">🛒 Venta</option>
            <option value="stock">📦 Stock</option>
            <option value="producto">📌 Producto</option>
            <option value="auditoria">🕵️ Auditoría</option>
            <option value="reportes">📈 Reportes de análisis</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500">
            ▼
          </span>
        </div>
        {getFocusIndicators().length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {getFocusIndicators().map((indicator) => (
              <div
                key={indicator.title}
                className="flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/30 p-3"
              >
                <span className="mt-0.5 text-lg" aria-hidden="true">
                  📌
                </span>
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {indicator.title}
                  </p>
                  <p className="text-xs text-amber-800/90 dark:text-amber-100/80 leading-relaxed">
                    {indicator.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subida de archivo */}
      <div className="flex flex-col items-stretch sm:items-center gap-3 w-full px-2">
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setUploadMode("local")}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
              uploadMode === "local"
                ? "bg-blue-50 dark:bg-slate-800 border-blue-300 text-blue-700 dark:text-blue-200"
                : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200"
            }`}
          >
            📁 Subir desde tu equipo
          </button>
          {/**
           * Botón deshabilitado temporalmente hasta completar el proceso de
           * verificación de Google Drive. Se mantiene comentado para
           * reactivarlo en el futuro sin perder la configuración original.
           */}
          {false && (
            <button
              onClick={() => setUploadMode("drive")}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition ${
                uploadMode === "drive"
                  ? "bg-blue-50 dark:bg-slate-800 border-blue-300 text-blue-700 dark:text-blue-200"
                  : "bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200"
              }`}
            >
              ☁️ Importar desde Google Drive
            </button>
          )}
        </div>

        {uploadMode === "local" ? (
          <>
            <label
              htmlFor="fileInput"
              className="w-full sm:w-auto text-sm font-medium text-gray-700 dark:text-slate-200 text-center"
            >
              Selecciona uno o varios archivos (.csv, .xlsx o .zip)
            </label>
            <input
              id="fileInput"
              type="file"
              onChange={handleFileChange}
              accept=".csv, .xlsx, .zip"
              multiple
              className="w-full sm:w-auto border border-gray-300 dark:border-slate-700 p-3 rounded-lg shadow-sm focus:ring focus:ring-blue-300 bg-white dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-400"
            />
          </>
        ) : (
          <div className="w-full space-y-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <p className="text-sm text-gray-700 dark:text-slate-200 font-medium">
              Importa un archivo de Google Drive
            </p>
            <button
              onClick={openDrivePicker}
              disabled={driveLoading || !drivePickerReady}
              className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                driveLoading || !drivePickerReady
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow"
              }`}
            >
              {driveLoading
                ? "Conectando con Google..."
                : "Elegir archivo en Google Drive"}
            </button>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              Se abrirá una ventana de Google para autorizar y elegir el archivo sin escribir tokens.
            </p>
            {selectedDriveFileName && (
              <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                Archivo seleccionado: {selectedDriveFileName}
              </p>
            )}
          </div>
        )}

        {files.length > 0 && (
          <p className="text-xs text-gray-500 dark:text-slate-400 text-center sm:text-left">
            {files.length === 1
              ? `Archivo listo: ${files[0].name}`
              : `${files.length} archivos listos para analizar`}
          </p>
        )}

        <button
          onClick={handleUpload}
          disabled={loading || files.length === 0}
          className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            loading || files.length === 0
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow"
          }`}
        >
          {loading ? "Analizando..." : "Analizar archivo(s)"}
        </button>
      </div>

      {/* Resultados del análisis */}
      {analysis && (
        <div className="mt-10 w-full space-y-4">
          <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-slate-800 bg-gradient-to-r from-white via-gray-50 to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-2xl p-6">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-blue-500 via-indigo-400 to-sky-300" aria-hidden="true" />
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Panel de resultados</p>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Vista {categoryFilter === "todos" ? "general" : `enfoque en ${categoryFilter}`}
                </h3>
                <p className="text-sm text-gray-600 dark:text-slate-300 max-w-2xl">
                  Una experiencia tipo workspace para revisar resumen, visualizaciones, insights de IA y el reporte ejecutivo en tarjetas limpias.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 justify-end">
                <button
                  onClick={focusFilter}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800 text-gray-800 dark:text-slate-100 shadow-sm hover:shadow-md transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 6h16" />
                    <path d="M6 12h12" />
                    <path d="M10 18h4" />
                  </svg>
                  Filtrar
                </button>
                <button
                  onClick={focusInsightsPanel}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-blue-200 text-blue-700 bg-blue-50 dark:bg-slate-800/70 dark:border-slate-700 dark:text-blue-200 shadow-sm hover:shadow-md transition"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 5v14" />
                    <path d="M5 12h14" />
                  </svg>
                  Resaltar insights
                </button>
                <button
                  onClick={handleDownloadReport}
                  disabled={downloading || !analysis}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
                    downloading || !analysis
                      ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                      : "bg-emerald-500 text-white hover:bg-emerald-600"
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 3v12" />
                    <path d="M7 12l5 5 5-5" />
                    <path d="M5 21h14" />
                  </svg>
                  {downloading ? "Exportando..." : "Exportar"}
                </button>
              </div>
            </div>
            {categoryFilter !== "todos" && (
              <p className="mt-3 text-xs text-gray-500 dark:text-slate-400 italic">
                Si no hay coincidencias, verás los datos completos para mantener el contexto.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/70">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "text-blue-700 bg-white shadow-sm border border-blue-200 dark:text-blue-200 dark:bg-slate-800 dark:border-slate-700"
                      : "text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* 📄 RESUMEN */}
              {activeTab === "resumen" && (
                <div className="space-y-6">
                  <div className="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 shadow-inner bg-gradient-to-r from-white via-slate-50 to-white dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6">
                    <div className="absolute left-0 top-0 h-full w-1 bg-blue-500/70 rounded-full" aria-hidden="true" />
                    <div className="pl-4 space-y-2">
                      <p className="text-xs font-semibold tracking-wide text-blue-600 dark:text-blue-300">Salud del dataset</p>
                      <p className="text-sm text-gray-600 dark:text-slate-300">Score de calidad, nulos, outliers y recomendaciones accionables.</p>
                    </div>
                    <div className="mt-4">{renderHealthPanel()}</div>
                  </div>

                  <div className="bg-gray-50/80 dark:bg-slate-900/50 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 p-5">
                    <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Resumen estructurado</p>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Dataset en tarjetas</h3>
                        <p className="text-sm text-gray-600 dark:text-slate-300">KPIs claros (min, max, count) y top 3 categorías en una cuadrícula legible.</p>
                      </div>
                      <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white dark:bg-slate-800 text-xs text-gray-600 dark:text-slate-200 border border-gray-200 dark:border-slate-700">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        Datos listos para compartir
                      </span>
                    </div>
                    <DatasetSummaryPanel summary={filterSummaryByCategory(analysis.summary)} />
                  </div>
                </div>
              )}

              {/* 📊 GRÁFICOS */}
              {activeTab === "graficos" && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {filterGraphsByCategory(analysis.graphs)?.length > 0 ? (
                    filterGraphsByCategory(analysis.graphs).map((chart, i) => (
                      <div
                        key={i}
                        className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg"
                      >
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-200">
                              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 3v18h18" />
                                <path d="M7 16l3-3 4 4 5-5" />
                              </svg>
                            </span>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Visualización</p>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white">{chart.column || `Gráfico ${i + 1}`}</h4>
                            </div>
                          </div>
                          <div className="relative">
                            <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-full px-3 py-1">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              Hover para detalles
                            </div>
                            <div className="pointer-events-none absolute right-0 mt-2 w-48 rounded-xl bg-white/95 dark:bg-slate-900/95 shadow-lg border border-gray-200 dark:border-slate-800 p-3 text-xs text-gray-600 dark:text-slate-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition duration-200">
                              Gráficos enmarcados con sombra sutil y tipografía reforzada para un look tipo Notion/Linear.
                            </div>
                          </div>
                        </div>
                        <div className="p-5">
                          <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800 shadow-inner bg-white dark:bg-slate-900">
                            <img
                              src={chart.image}
                              alt={chart.column}
                              className="rounded-lg mx-auto"
                              style={{ maxHeight: "320px", objectFit: "contain" }}
                            />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 dark:text-slate-400 italic text-center">
                      No hay gráficos disponibles.
                    </p>
                  )}
                </div>
              )}

              {/* 🤖 INSIGHTS */}
              {activeTab === "insights" && (
                <div className="space-y-6">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="relative rounded-2xl border border-blue-200 dark:border-slate-800 bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 p-6 shadow-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 3v4" />
                            <path d="M6.6 7l-2.1 3.6" />
                            <path d="M17.4 7l2.1 3.6" />
                            <path d="M3 13h4" />
                            <path d="M17 13h4" />
                            <path d="M6.6 19l-2.1-3.6" />
                            <path d="M17.4 19l2.1-3.6" />
                            <path d="M12 17v4" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-blue-700 dark:text-blue-200">Panel inteligente</p>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Insights generados por IA</h4>
                        </div>
                      </div>
                      <div className="mt-3 max-h-64 overflow-y-auto pr-2">
                        <p className="text-sm text-blue-900 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
                          {filterInsights(analysis.ai_summary) || "No se recibieron insights de IA."}
                        </p>
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-300">Acciones sugeridas</p>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Checklist priorizado</h4>
                          <p className="text-xs text-gray-500 dark:text-slate-400">Generadas según tus insights y el enfoque seleccionado.</p>
                        </div>
                        <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white" aria-hidden="true">
                          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      </div>
                      {suggestedActions.length > 0 ? (
                        <ul className="space-y-3 max-h-60 overflow-y-auto pr-2">
                          {suggestedActions.map((action, index) => (
                            <li
                              key={`${action}-${index}`}
                              className="flex items-start gap-3 bg-emerald-50 dark:bg-slate-800/60 rounded-lg p-3 border border-emerald-100 dark:border-slate-700"
                            >
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-600 text-white text-sm font-bold">
                                {index + 1}
                              </span>
                              <p className="text-sm text-gray-800 dark:text-slate-100 leading-relaxed">{action}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-500 dark:text-slate-400">
                          Carga un archivo y obtén recomendaciones listas para ejecutar.
                        </p>
                      )}
                    </div>
                  </div>

                  {filterGraphsByCategory(aiCharts).length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filterGraphsByCategory(aiCharts).map((chart, index) => (
                        <div
                          key={`${chart.title}-${index}`}
                          className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-lg p-4"
                        >
                          <h5 className="text-sm font-semibold text-gray-800 dark:text-slate-100 mb-3 text-center">
                            {chart.title}
                          </h5>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              {chart.type === "bar" ? (
                                <BarChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                  <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value) => Number(value).toLocaleString()}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid #e5e7eb",
                                      boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                                    }}
                                  />
                                  <Legend />
                                  <Bar dataKey={chart.yKey} name={chart.yKey} fill="#3b82f6" radius={[8, 8, 0, 0]} />
                                </BarChart>
                              ) : (
                                <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                  <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip
                                    formatter={(value) => Number(value).toLocaleString()}
                                    contentStyle={{
                                      borderRadius: "12px",
                                      border: "1px solid #e5e7eb",
                                      boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                                    }}
                                  />
                                  <Legend />
                                  <Line type="monotone" dataKey={chart.yKey} name={chart.yKey} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                                </LineChart>
                              )}
                            </ResponsiveContainer>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 📑 REPORTE EJECUTIVO */}
              {activeTab === "reporte" && (
                <div className="flex flex-col gap-6 w-full">
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-r from-white to-gray-50 dark:from-slate-900 dark:to-slate-950 shadow-lg p-6">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white" aria-hidden="true">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16v14H5.5L4 19.5V4z" />
                        </svg>
                      </span>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-300">Reporte ejecutivo</p>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">PDF listo para comité</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-300">
                          Exporta y comparte insights, estadísticas y visualizaciones detectadas automáticamente en tu dataset.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-100">Enviar por correo electrónico</label>
                    <p className="text-xs text-gray-600 dark:text-slate-300">
                      Ingresa un correo para enviar el PDF generado directamente a tu bandeja de entrada.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input
                        type="email"
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="flex-1 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <button
                        onClick={handleSendReportEmail}
                        disabled={sendingReport || downloading || !analysis}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-200 ${
                          sendingReport || downloading || !analysis
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                        }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 4l8 6 8-6" />
                          <path d="M4 20h16V6" />
                        </svg>
                        <span className="text-sm sm:text-base font-semibold">
                          {sendingReport ? "Enviando..." : "Enviar PDF"}
                        </span>
                      </button>
                    </div>
                    {emailFeedback && (
                      <p
                        className={`text-sm text-left ${
                          emailFeedback.startsWith("⚠️")
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {emailFeedback}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleDownloadReport}
                    disabled={downloading || !analysis}
                    className={`group relative inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full font-semibold tracking-wide transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-200 ${
                      downloading || !analysis
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-white hover:scale-[1.02] hover:shadow-xl"
                    }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="M7 12l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    <span className="text-sm sm:text-base font-semibold">
                      {downloading ? "Generando reporte..." : "Descargar reporte"}
                    </span>
                    {!downloading && analysis && (
                      <span className="pointer-events-none absolute inset-0 rounded-full border border-white/30 blur-sm opacity-0 group-hover:opacity-100 transition" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-10 space-y-3">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <span role="img" aria-hidden="true">🎬</span>
                Película de datos
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-300">
                Recorre los momentos clave del análisis en formato de video interactivo.
              </p>
            </div>
            <DataMoviePlayer dataMovie={analysis?.data_movie ?? null} />
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
