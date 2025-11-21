import React, { useState, useEffect } from "react";
import Login from "./Login";
import FileUpload from "../components/FileUpload";
import UserManagement from "./UserManagement";
import AdminOpenAIUsage from "./AdminOpenAIUsage";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [menuOpen, setMenuOpen] = useState(false);

  // 🧠 Verifica si existe sesión al iniciar
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log("🧩 Inicializando App.jsx → Token:", token, "| Usuario:", storedUser);

    if (token && storedUser) {
      console.log("✅ Sesión activa detectada.");
      try {
        const parsed = JSON.parse(storedUser);
        if (parsed?.username) {
          setUser({ username: parsed.username, role: parsed.role || "user" });
        } else {
          setUser({ username: storedUser, role: "user" });
        }
      } catch {
        setUser({ username: storedUser, role: "user" });
      }
    } else {
      console.log("⚠️ No hay sesión activa, mostrando pantalla de login.");
    }

    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    setTheme(savedTheme || (prefersDark ? "dark" : "light"));
    setLoading(false);
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

  // 🔓 Maneja el login exitoso desde Login.jsx
  const handleLogin = (data) => {
    console.log("🎯 Login exitoso → usuario:", data.username);

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("🚫 Token ausente en localStorage después del login.");
      return;
    }

    setUser({ username: data.username, role: data.role || "user" });
  };

  // 🔒 Cierre de sesión
  const handleLogout = () => {
    console.log("👋 Cerrando sesión...");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  const handleUnauthorized = (message) => {
    console.warn("🚫 Sesión inválida o expirada.");
    if (message) alert(message);
    handleLogout();
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    setMenuOpen(false);
  };

  // ⏳ Pantalla de carga inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  // -------------------------------
  // 🧩 Renderizado condicional
  // -------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans px-4 py-6 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {!user ? (
        <>
          <p className="text-gray-700 mb-3 text-base font-semibold">
            🔐 Inicia sesión para acceder al panel de análisis
          </p>
          <Login onLogin={handleLogin} />
        </>
      ) : (
        <div className="w-full max-w-5xl p-6 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-800 transition-colors duration-300">
          {/* HEADER */}
          <header className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6 border-b pb-4">
            <div className="text-center sm:text-left space-y-1">
              <h1 className="text-2xl font-bold text-blue-700 dark:text-blue-300">InformeBF</h1>
              <p className="text-sm text-gray-500 dark:text-slate-300">AI Data Visualizer</p>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex flex-wrap items-center justify-end gap-3">
                <button
                  onClick={toggleTheme}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-100 shadow-sm hover:shadow-md transition"
                  aria-pressed={theme === "dark"}
                >
                  <span className="text-lg" role="img" aria-hidden="true">
                    {theme === "dark" ? "🌙" : "☀️"}
                  </span>
                  <span className="text-sm font-semibold">
                    {theme === "dark" ? "Modo oscuro" : "Modo claro"}
                  </span>
                </button>

                <button
                  onClick={handleLogout}
                  className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
                >
                  Cerrar sesión
                </button>
              </div>

              <button
                className="sm:hidden inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-100 p-2 shadow-sm hover:shadow-md transition"
                onClick={() => setMenuOpen((prev) => !prev)}
                aria-expanded={menuOpen}
                aria-label="Abrir menú"
              >
                <span className="text-xl" role="img" aria-hidden="true">
                  ☰
                </span>
              </button>
            </div>

            {menuOpen && (
              <div className="sm:hidden absolute top-full right-0 mt-3 w-full rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-4 z-10">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center justify-between px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-100 shadow-sm hover:shadow-md transition"
                    aria-pressed={theme === "dark"}
                  >
                    <span className="flex items-center gap-2 text-sm font-semibold">
                      <span className="text-lg" role="img" aria-hidden="true">
                        {theme === "dark" ? "🌙" : "☀️"}
                      </span>
                      Modo oscuro
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-300">
                      {theme === "dark" ? "Activo" : "Desactivado"}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      handleLogout();
                    }}
                    className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200"
                  >
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </header>

          {/* MAIN */}
          <main>
            <h2 className="text-lg font-semibold mb-4 text-gray-700 dark:text-slate-100 text-center">
              📊 Carga y análisis de datos
            </h2>

            <FileUpload
              key={user.username}
              onUnauthorized={handleUnauthorized}
              onDataReceived={(data) =>
                console.log("📈 Resultado del análisis:", data)
              }
            />

            {user.role === "admin" && (
              <div className="mt-10 space-y-3">
                <h3 className="text-lg font-semibold text-gray-700 dark:text-slate-100 text-center">
                  👤 Administración de usuarios
                </h3>
                <UserManagement onUnauthorized={handleUnauthorized} />
                <AdminOpenAIUsage onUnauthorized={handleUnauthorized} />
              </div>
            )}

            <div className="mt-10 text-gray-600 dark:text-slate-300 text-sm text-center italic">
              Carga tus archivos .CSV o .XLSX para generar visualizaciones automáticas.
            </div>
          </main>

          {/* FOOTER */}
          <footer className="mt-8 text-center text-gray-400 dark:text-slate-500 text-sm border-t border-gray-200 dark:border-slate-800 pt-4">
            © {new Date().getFullYear()} InformeBF — Desarrollado con ❤️ y IA.
          </footer>
        </div>
      )}
    </div>
  );
};

export default App;
