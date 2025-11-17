import React, { useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer
} from "recharts";

const COLORS = ["#1E3A8A", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];

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
      const res = await fetch("http://localhost:8000/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        alert(`Error del servidor: ${msg}`);
        return;
      }

      const data = await res.json();
      console.log("📊 Datos del backend:", data);
      setAnalysis(data);
      onDataReceived?.(data);
    } catch (err) {
      console.error("Error al subir archivo:", err);
      alert("Error al conectar con el backend.");
    } finally {
      setLoading(false);
    }
  };

  // --- Detección del tipo de variable ---
  const detectChartType = (data, key) => {
    const values = data.map((row) => row[key]);
    if (values.every((v) => !isNaN(parseFloat(v)))) return "numeric";
    if (values.every((v) => /\d{4}-\d{2}-\d{2}/.test(v))) return "date";
    return "categorical";
  };

  // --- Renderizado automático de gráficos ---
  const renderChart = (data, key) => {
    const type = detectChartType(data, key);
    const formattedData = data.map((row) => ({
      name: row[key],
      value: parseFloat(row[key]) || 1,
    }));

    switch (type) {
      case "numeric":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        );

      case "categorical":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={formattedData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {formattedData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "date":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={formattedData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="value" stroke="#2563EB" />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return <p className="text-gray-500 italic text-center">Tipo no reconocido</p>;
    }
  };

  // --- Tabs principales ---
  const tabs = [
    { id: "resumen", label: "🧾 Resumen" },
    { id: "graficos", label: "📊 Visualizaciones" },
    { id: "insights", label: "🤖 Insights IA" },
    { id: "correlacion", label: "🔗 Correlaciones" },
  ];

  return (
    <div className="flex flex-col items-center space-y-6 w-full">
      {/* Subida */}
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

      {/* Panel de resultados */}
      {analysis && (
        <div className="mt-10 w-full bg-white rounded-2xl p-8 shadow-xl border border-gray-200">
          {/* Navegación por pestañas */}
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

          {/* CONTENIDO SEGÚN TAB */}
          <div className="p-4">
            {activeTab === "resumen" && (
              <div>
                <h3 className="text-lg font-semibold mb-2 text-gray-800">📄 Resumen del dataset</h3>
                <pre className="bg-gray-50 p-4 rounded-lg border text-sm overflow-x-auto">
                  {JSON.stringify(analysis.summary, null, 2)}
                </pre>
              </div>
            )}

            {activeTab === "graficos" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {analysis.sample &&
                  Object.keys(analysis.sample[0]).map((key, i) => (
                    <div
                      key={i}
                      className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4"
                    >
                      <h4 className="text-gray-800 font-semibold mb-2 text-center">{key}</h4>
                      {renderChart(analysis.sample, key)}
                    </div>
                  ))}
              </div>
            )}

            {activeTab === "insights" && (
              <div className="bg-blue-50 p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                <h4 className="font-semibold text-blue-700 mb-2">💬 Análisis de IA</h4>
                <p className="text-blue-800 whitespace-pre-wrap leading-relaxed">
                  {analysis.ai_summary || "No se recibieron insights de IA."}
                </p>
              </div>
            )}

            {activeTab === "correlacion" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {analysis.graphs && analysis.graphs.length > 0 ? (
                  analysis.graphs.map((chart, i) => (
                    <div
                      key={i}
                      className="bg-gray-50 border border-gray-200 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4"
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
