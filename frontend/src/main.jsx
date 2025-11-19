import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import FileUpload from "../components/FileUpload.jsx";
import Login from "./Login.jsx";
import "./index.css";

// ---------------------------
// DARK MODE SWITCH
// ---------------------------
const ThemeToggle = ({ theme, onToggle }) => {
  const isDark = theme === "dark";

  return (
    <button
      onClick={onToggle}
      aria-label={`Cambiar a modo ${isDark ? "claro" : "oscuro"}`}
      className={`relative inline-flex items-center w-20 h-10 px-1 rounded-full transition-all duration-300 shadow-inner border ${
        isDark
          ? "bg-slate-800 border-slate-700"
          : "bg-slate-200 border-slate-300"
      }`}
    >
      <span
        className={`absolute text-[0.65rem] font-semibold tracking-wide transition-all duration-300 ${
          isDark ? "right-3 text-slate-200" : "left-3 text-slate-600"
        }`}
      >
        {isDark ? "DARK" : "LIGHT"}
      </span>
      <span
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 shadow-md ${
          isDark
            ? "translate-x-9 bg-blue-500 text-white"
            : "translate-x-0 bg-white text-amber-500"
        }`}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
};

// ---------------------------
// DASHBOARD
// ---------------------------
const Dashboard = ({ user, onLogout, theme, onToggleTheme }) => {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 dark:bg-slate-950 dark:text-slate-100 flex flex-col font-sans">
      <header className="bg-white/90 dark:bg-slate-900/70 backdrop-blur-lg shadow-md py-4 px-6 sm:px-8 flex justify-between items-center border-b border-gray-200 dark:border-slate-800 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="logo" className="w-10 drop-shadow" />
          <div>
            <h1 className="text-2xl font-bold text-blue-600">InformeBF</h1>
            <span className="text-gray-500 dark:text-slate-300 text-sm">AI Data Visualizer</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <button
            onClick={onLogout}
            className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-all duration-300 shadow-md"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="flex-1 py-10 px-4 sm:px-6 max-w-6xl mx-auto w-full">
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-lg p-6 sm:p-8 border border-gray-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-slate-100">
              📊 Carga y análisis de datos
            </h2>
            <span className="text-sm text-gray-500 dark:text-slate-400">Modo {theme === "dark" ? "oscuro" : "claro"}</span>
          </div>

          <FileUpload
            onDataReceived={(data) => {
              console.log("📈 Resultado del análisis:", data);
            }}
          />

          <div className="mt-10 text-gray-600 dark:text-slate-400 text-sm text-center italic">
            Carga tus archivos .CSV o .XLSX y deja que la IA genere insights
            automáticos con visualizaciones inteligentes.
          </div>
        </div>
      </main>

      <footer className="text-center py-4 text-gray-400 dark:text-slate-500 text-sm border-t border-gray-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 backdrop-blur-md">
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
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      setUser(savedUser);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  const handleLogin = (u) => {
    setUser(u.username);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const toggleTheme = () => setTheme((prev) => (prev === "dark" ? "light" : "dark"));

  return user ? (
    <Dashboard user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
  ) : (
    <Login onLogin={handleLogin} />
  );
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
