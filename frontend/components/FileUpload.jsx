import React, { useState } from "react";
import ChartView from "./ChartView";

const FileUpload = ({ onDataReceived }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [downloading, setDownloading] = useState(false);

  const handleFileChange = (e) => setFiles(Array.from(e.target.files || []));

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
    <div className="flex flex-col items-center space-y-6 w-full max-w-5xl mx-auto">
      {/* Subida de archivo */}
      <div className="flex flex-col items-stretch sm:items-center gap-3 w-full px-2">
        <label
          htmlFor="fileInput"
          className="w-full sm:w-auto text-sm font-medium text-gray-700 text-center"
        >
          Selecciona uno o varios archivos (.csv, .xlsx o .zip)
        </label>
        <input
          id="fileInput"
          type="file"
          onChange={handleFileChange}
          accept=".csv, .xlsx, .zip"
          multiple
          className="w-full sm:w-auto border border-gray-300 p-3 rounded-lg shadow-sm focus:ring focus:ring-blue-300 bg-white"
        />
        {files.length > 0 && (
          <p className="text-xs text-gray-500 text-center sm:text-left">
            {files.length === 1
              ? `Archivo seleccionado: ${files[0].name}`
              : `${files.length} archivos seleccionados`}
          </p>
        )}
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`w-full sm:w-auto px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            loading
              ? "bg-gray-400 text-white cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow"
          }`}
        >
          {loading ? "Analizando..." : "Analizar archivo(s)"}
        </button>
      </div>

      {/* Resultados del análisis */}
      {analysis && (
        <div className="mt-10 w-full bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 border-b border-gray-200 pb-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-300 ${
                  activeTab === tab.id
                    ? "text-blue-700 bg-blue-50 border border-blue-200 shadow-sm"
                    : "text-gray-600 hover:text-blue-600"
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
                <h3 className="text-lg font-semibold mb-2 text-gray-800">
                  📄 Resumen del dataset
                </h3>
                <pre className="bg-gray-50 p-4 rounded-lg border text-sm overflow-x-auto">
                  {JSON.stringify(analysis.summary, null, 2)}
                </pre>
              </div>
            )}

            {/* 📊 GRÁFICOS */}
            {activeTab === "graficos" && (
              <div className="space-y-4">
                <ChartView charts={analysis.charts || analysis.graphs || []} />
              </div>
            )}

            {/* 🤖 INSIGHTS */}
            {activeTab === "insights" && (
              <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                <h4 className="font-semibold text-blue-700 mb-2">💬 Análisis de IA</h4>
                <p className="text-blue-800 whitespace-pre-wrap leading-relaxed">
                  {analysis.ai_summary || "No se recibieron insights de IA."}
                </p>
              </div>
            )}

            {/* 📑 REPORTE EJECUTIVO */}
            {activeTab === "reporte" && (
              <div className="flex flex-col items-center text-center space-y-4">
                <p className="text-gray-700 max-w-2xl">
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
