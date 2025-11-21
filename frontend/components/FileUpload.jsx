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

const FileUpload = ({ onDataReceived }) => {
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
    if (!token) return alert("⚠️ No se encontró token. Inicia sesión nuevamente.");

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
    if (!token) return alert("⚠️ No se encontró token. Inicia sesión nuevamente.");

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

  const tabs = [
    { id: "resumen", label: "📄 Resumen" },
    { id: "graficos", label: "📊 Visualizaciones" },
    { id: "insights", label: "🤖 Insights IA" },
    { id: "reporte", label: "📑 Reporte ejecutivo" },
  ];

  const suggestedActions = buildSuggestedActions();

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
          Elige un contexto (ventas, stock, producto o reportes) para priorizar
          los KPIs y visualizaciones más relevantes. "Todo" mantiene el
          comportamiento actual.
        </p>
        <div className="relative w-full sm:w-80">
          <select
            id="category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full appearance-none bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-lg px-4 py-3 pr-10 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:text-slate-100"
          >
            <option value="todos">🔎 Todo / sin filtro</option>
            <option value="ventas">🛒 Venta</option>
            <option value="stock">📦 Stock</option>
            <option value="producto">📌 Producto</option>
            <option value="reportes">📈 Reportes de análisis</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 dark:text-slate-500">
            ▼
          </span>
        </div>
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
        <div className="mt-10 w-full bg-white dark:bg-slate-900 rounded-2xl p-8 shadow-xl border border-gray-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-slate-100">
              Vista: {categoryFilter === "todos" ? "Todo" : `Enfoque en ${categoryFilter}`}
            </h3>
            {categoryFilter !== "todos" && (
              <p className="text-xs text-gray-500 dark:text-slate-400 italic">
                Si no hay coincidencias, verás los datos completos para mantener el contexto.
              </p>
            )}
          </div>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 border-b border-gray-200 dark:border-slate-800 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === tab.id
                    ? "text-blue-700 bg-blue-50 dark:text-blue-200 dark:bg-slate-800 border border-blue-200 dark:border-slate-700 shadow-sm"
                    : "text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Contenido dinámico */}
          <div className="p-4">
            {/* 📄 RESUMEN */}
            {activeTab === "resumen" && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800 dark:text-slate-100">
                  📄 Resumen del dataset
                </h3>
                <pre className="bg-gray-50 dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700 text-sm overflow-x-auto">
                  {JSON.stringify(filterSummaryByCategory(analysis.summary), null, 2)}
                </pre>
              </div>
            )}

            {/* 📊 GRÁFICOS */}
            {activeTab === "graficos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filterGraphsByCategory(analysis.graphs)?.length > 0 ? (
                  filterGraphsByCategory(analysis.graphs).map((chart, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-white to-gray-50 dark:from-slate-900 dark:to-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4"
                    >
                      <h4 className="text-gray-800 dark:text-slate-100 font-semibold mb-2 text-center">
                        {chart.column || `Gráfico ${i + 1}`}
                      </h4>
                      <img
                        src={chart.image}
                        alt={chart.column}
                        className="rounded-lg shadow-sm border border-gray-100 mx-auto"
                        style={{ maxHeight: "320px", objectFit: "contain" }}
                      />
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
                  <div className="bg-blue-50 dark:bg-slate-800 p-6 rounded-xl border-l-4 border-blue-500 dark:border-blue-400 shadow-sm">
                    <h4 className="font-semibold text-blue-700 dark:text-blue-200 mb-2">💬 Análisis de IA</h4>
                    <p className="text-blue-800 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
                      {filterInsights(analysis.ai_summary) || "No se recibieron insights de IA."}
                    </p>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                          ⚡ Acciones sugeridas
                        </p>
                        <p className="text-xs text-gray-500 dark:text-slate-400">
                          Generadas dinámicamente según tus insights y el enfoque seleccionado.
                        </p>
                      </div>
                      <span className="text-lg" role="img" aria-hidden="true">
                        ✅
                      </span>
                    </div>
                    {suggestedActions.length > 0 ? (
                      <ul className="space-y-3">
                        {suggestedActions.map((action, index) => (
                          <li
                            key={`${action}-${index}`}
                            className="flex items-start gap-3 bg-emerald-50 dark:bg-slate-800/60 rounded-lg p-3 border border-emerald-100 dark:border-slate-700"
                          >
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-600 text-white text-sm font-bold">
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
                        className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow p-4"
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
                                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                                <Legend />
                                <Bar dataKey={chart.yKey} name={chart.yKey} fill="#3b82f6" radius={[8, 8, 0, 0]} />
                              </BarChart>
                            ) : (
                              <LineChart data={chart.data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} />
                                <YAxis tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value) => Number(value).toLocaleString()} />
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
              <div className="flex flex-col items-center text-center space-y-4">
                <p className="text-gray-700 dark:text-slate-200 max-w-2xl">
                  Genera un reporte ejecutivo en PDF con los principales insights,
                  estadísticas y visualizaciones detectadas automáticamente en tu
                  dataset.
                </p>
                <button
                  onClick={handleDownloadReport}
                  disabled={downloading}
                  className={`group relative inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full font-semibold tracking-wide transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-200 ${
                    downloading
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-white hover:scale-[1.02] hover:shadow-xl"
                  }`}
                >
                  <span className="text-xl">📥</span>
                  <span className="text-sm sm:text-base font-semibold">
                    {downloading ? "Generando reporte..." : "Descargar reporte"}
                  </span>
                  {!downloading && (
                    <span className="pointer-events-none absolute inset-0 rounded-full border border-white/30 blur-sm opacity-0 group-hover:opacity-100 transition" />
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
