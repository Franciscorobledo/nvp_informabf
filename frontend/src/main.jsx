import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import FileUpload from "../components/FileUpload.jsx";
import Login from "./Login.jsx";
import "./index.css";

// ---------------------------
// DASHBOARD
// ---------------------------
const Dashboard = ({ user, onLogout }) => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col font-sans">
      <header className="bg-white/90 backdrop-blur-lg shadow-md py-4 px-8 flex justify-between items-center border-b border-gray-200 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="w-10 drop-shadow" />
          <div>
            <h1 className="text-2xl font-bold text-blue-600">InformeBF</h1>
            <span className="text-gray-500 text-sm">AI Data Visualizer</span>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 shadow-md"
        >
          Cerrar sesión
        </button>
      </header>

      <main className="flex-1 py-10 px-6 max-w-6xl mx-auto w-full">
        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-200">
          <h2 className="text-2xl font-semibold mb-6 text-gray-800">
            📊 Carga y análisis de datos
          </h2>

          <FileUpload
            onDataReceived={(data) => {
              console.log("📈 Resultado del análisis:", data);
            }}
          />

          <div className="mt-10 text-gray-600 text-sm text-center italic">
            Carga tus archivos .CSV o .XLSX y deja que la IA genere insights
            automáticos con visualizaciones inteligentes.
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-gray-400 text-sm border-t border-gray-200 bg-white/90 backdrop-blur-md">
        © {new Date().getFullYear()} InformeBF — Desarrollado con ❤️ y IA.
      </footer>
    </div>
  );
};

// ---------------------------
// APP PRINCIPAL
// ---------------------------
const App = () => {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      setUser(savedUser);
    }
  }, []);

  const handleLogin = (u) => {
    setUser(u.username);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} />
  ) : (
    <Login onLogin={handleLogin} />
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
