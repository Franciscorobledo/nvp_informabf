import React, { useState } from "react";

const FileUpload = ({ onDataReceived }) => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");

  const handleFileChange = (e) => setFile(e.target.files[0]);

  const handleUpload = async () => {
    if (!file) return alert("Selecciona un archivo .csv o .xlsx primero.");
    const token = localStorage.getItem("token");
    if (!token) return alert("⚠️ No se encontró token. Inicia sesión nuevamente.");

    const formData = new FormData();
    formData.append("file", file);
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

  const tabs = [
    { id: "resumen", label: "📄 Resumen" },
    { id: "graficos", label: "📊 Visualizaciones" },
    { id: "insights", label: "🤖 Insights IA" },
    { id: "correlacion", label: "🔗 Correlaciones" },
  ];

  return (
    <div className="flex flex-col items-center space-y-6 w-full">
      {/* Subida de archivo */}
      <div className="flex flex-col items-center">
        <input
          type="file"
          onChange={handleFileChange}
          accept=".csv, .xlsx"
          className="mb-4 border border-gray-300 p-2 rounded-lg shadow-sm focus:ring focus:ring-blue-300"
        />
        <button
          onClick={handleUpload}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white shadow"
          }`}
        >
          {loading ? "Analizando..." : "Analizar archivo"}
        </button>
      </div>

      {/* Resultados del análisis */}
      {analysis && (
        <div className="mt-10 w-full bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {/* Tabs */}
          <div className="flex justify-center mb-6 border-b border-gray-200">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 mx-2 text-sm font-semibold rounded-t-lg transition-all duration-300 ${
                  activeTab === tab.id
                    ? "text-blue-700 border-b-4 border-blue-600"
                    : "text-gray-500 hover:text-blue-600"
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {analysis.graphs?.length > 0 ? (
                  analysis.graphs.map((chart, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4"
                    >
                      <h4 className="text-gray-800 font-semibold mb-2 text-center">
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
                  <p className="text-gray-500 italic text-center">
                    No hay gráficos disponibles.
                  </p>
                )}
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

            {/* 🔗 CORRELACIONES */}
            {activeTab === "correlacion" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {analysis.graphs?.filter((g) =>
                  g.column?.toLowerCase().includes("correlación")
                ).length > 0 ? (
                  analysis.graphs
                    .filter((g) =>
                      g.column?.toLowerCase().includes("correlación")
                    )
                    .map((chart, i) => (
                      <div
                        key={i}
                        className="bg-gray-50 border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4"
                      >
                        <h4 className="text-gray-800 font-semibold mb-2 text-center">
                          {chart.column}
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
                  <p className="text-gray-500 italic text-center">
                    No hay correlaciones disponibles.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
