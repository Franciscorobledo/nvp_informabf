import React, { useState } from "react";
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
  const [driveFileUrl, setDriveFileUrl] = useState("");
  const [driveFileName, setDriveFileName] = useState("archivo-drive.xlsx");
  const [driveAccessToken, setDriveAccessToken] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);

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

  const extractDriveFileId = (input = "") => {
    const trimmed = input.trim();
    if (!trimmed) return "";

    try {
      const url = new URL(trimmed);
      const pathMatch = url.pathname.match(/\/d\/([^/]+)/);
      if (pathMatch?.[1]) return pathMatch[1];
      const queryId = url.searchParams.get("id");
      if (queryId) return queryId;
      return trimmed;
    } catch (error) {
      return trimmed;
    }
  };

  const handleImportFromDrive = async () => {
    const fileId = extractDriveFileId(driveFileUrl);
    if (!fileId)
      return alert("Ingresa el ID o enlace del archivo en Google Drive.");
    const token = driveAccessToken.trim();

    try {
      setDriveLoading(true);
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if (!res.ok) {
        const message = await res.text();
        throw new Error(
          message ||
            "No se pudo descargar el archivo. Verifica el ID, permisos o token."
        );
      }

      const blob = await res.blob();
      const filename = driveFileName?.trim() || `drive-file-${fileId}.xlsx`;
      const driveFile = new File([blob], filename, { type: blob.type });
      setFiles([driveFile]);
      setUploadMode("local");
      alert(
        `Archivo importado desde Drive y listo para analizar: ${driveFile.name}`
      );
    } catch (error) {
      console.error("Error al importar desde Drive:", error);
      alert(error.message);
    } finally {
      setDriveLoading(false);
    }
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
            <input
              type="text"
              placeholder="Enlace o ID del archivo en Google Drive"
              value={driveFileUrl}
              onChange={(e) => setDriveFileUrl(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-800 text-sm"
            />
            <input
              type="text"
              placeholder="Nombre para el archivo (ej: datos.xlsx)"
              value={driveFileName}
              onChange={(e) => setDriveFileName(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-800 text-sm"
            />
            <input
              type="password"
              placeholder="Token de acceso (si el archivo no es público)"
              value={driveAccessToken}
              onChange={(e) => setDriveAccessToken(e.target.value)}
              className="w-full border border-gray-300 dark:border-slate-700 p-2 rounded-lg bg-white dark:bg-slate-800 text-sm"
            />
            <button
              onClick={handleImportFromDrive}
              disabled={driveLoading}
              className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                driveLoading
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow"
              }`}
            >
              {driveLoading ? "Importando..." : "Traer archivo de Drive"}
            </button>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              El archivo se descargará desde Drive y se enviará al backend con tu token actual.
            </p>
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
                <div className="bg-blue-50 dark:bg-slate-800 p-6 rounded-xl border-l-4 border-blue-500 dark:border-blue-400 shadow-sm">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-200 mb-2">💬 Análisis de IA</h4>
                  <p className="text-blue-800 dark:text-blue-100 whitespace-pre-wrap leading-relaxed">
                    {filterInsights(analysis.ai_summary) || "No se recibieron insights de IA."}
                  </p>
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
