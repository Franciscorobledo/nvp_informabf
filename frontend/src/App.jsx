import React, { useState, useEffect } from "react";
import Login from "./Login";
import HomeModules from "../components/HomeModules";
import ConfigurationPage from "./ConfigurationPage";
import DataUploadAnalysis from "../components/DataUploadAnalysis";
import DataMovieModule from "../components/DataMovieModule";
import DataComparisonModule from "../components/DataComparisonModule";
import {
  clearStoredSession,
  decodeTokenPayload,
  isTokenExpired,
} from "./session";

const App = () => {
  const [user, setUser] = useState(null);
  const [sessionMessage, setSessionMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [menuOpen, setMenuOpen] = useState(false);
  const getNavigationFromPath = (path) => {
    if (path.startsWith("/modules/analyze"))
      return { page: "home", module: "analyze" };
    if (path.startsWith("/modules/movie"))
      return { page: "home", module: "movie" };
    if (path.startsWith("/modules/compare"))
      return { page: "home", module: "compare" };
    if (path.startsWith("/config")) return { page: "config", module: "home" };
    return { page: "home", module: "home" };
  };

  const initialNavigation = getNavigationFromPath(window.location.pathname);

  const [activePage, setActivePage] = useState(initialNavigation.page);
  const [currentModule, setCurrentModule] = useState(initialNavigation.module);

  // 🧠 Verifica si existe sesión al iniciar
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log("🧩 Inicializando App.jsx → Token:", token, "| Usuario:", storedUser);

    if (token && storedUser) {
      if (isTokenExpired(token)) {
        console.warn("⏰ Token expirado al iniciar la app. Limpiando sesión.");
        clearStoredSession();
        setSessionMessage("Tu sesión expiró. Vuelve a iniciar sesión.");
      } else {
        console.log("✅ Sesión activa detectada.");
        try {
          const parsed = JSON.parse(storedUser);
          const payload = decodeTokenPayload(token);
          const resolvedUser = {
            username: parsed?.username || payload?.sub || storedUser,
            role: parsed?.role || payload?.role || "user",
          };
          setUser(resolvedUser);
        } catch {
          setUser({ username: storedUser, role: "user" });
        }
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
    const handlePopState = () => {
      const navigation = getNavigationFromPath(window.location.pathname);
      setActivePage(navigation.page);
      setCurrentModule(navigation.module);
      setMenuOpen(false);
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
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

  useEffect(() => {
    if (user && activePage === "config" && user.role !== "admin") {
      setSessionMessage(
        "Solo los administradores pueden acceder al panel de configuración."
      );
      setActivePage("home");
      setCurrentModule("home");
    }
  }, [user, activePage]);

  // 🔓 Maneja el login exitoso desde Login.jsx
  const handleLogin = (data) => {
    console.log("🎯 Login exitoso → usuario:", data.username);

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("🚫 Token ausente en localStorage después del login.");
      return;
    }

    setSessionMessage("");
    setUser({ username: data.username, role: data.role || "user" });
  };

  // 🔒 Cierre de sesión
  const handleLogout = (message = "") => {
    console.log("👋 Cerrando sesión...");
    clearStoredSession();
    if (message) {
      setSessionMessage(message);
    }
    setUser(null);
    setActivePage("home");
    setCurrentModule("home");
  };

  const handleUnauthorized = (message) => {
    console.warn("🚫 Sesión inválida o expirada.");
    handleLogout(message || "Tu sesión expiró. Vuelve a iniciar sesión.");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    setMenuOpen(false);
  };

  const navigateTo = (page) => {
    if (page === "config" && user?.role !== "admin") {
      setSessionMessage(
        "Solo los administradores pueden acceder al panel de configuración."
      );
      setActivePage("home");
      setCurrentModule("home");
      setMenuOpen(false);
      return;
    }

    setActivePage(page);
    setMenuOpen(false);

    if (page === "config") {
      window.history.pushState({ page }, "", "/config");
      setCurrentModule("home");
    } else {
      window.history.pushState({ page }, "", "/");
      setCurrentModule("home");
    }
  };

  const navigateToModule = (moduleId) => {
    const moduleRoutes = {
      analyze: "/modules/analyze",
      movie: "/modules/movie",
      compare: "/modules/compare",
    };

    setActivePage("home");
    setCurrentModule(moduleId);
    setMenuOpen(false);
    window.history.pushState({ module: moduleId }, "", moduleRoutes[moduleId] || "/");
  };

  // ⏳ Pantalla de carga inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 text-gray-700">
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  const renderModuleContent = () => {
    switch (currentModule) {
      case "analyze":
        return (
          <DataUploadAnalysis
            user={user}
            onUnauthorized={handleUnauthorized}
            onDataReceived={(data) =>
              console.log("📈 Resultado del análisis:", data)
            }
            onNavigateModule={navigateToModule}
          />
        );
      case "movie":
        return <DataMovieModule onUnauthorized={handleUnauthorized} />;
      case "compare":
        return <DataComparisonModule onUnauthorized={handleUnauthorized} />;
      default:
        return null;
    }
  };

  // -------------------------------
  // 🧩 Renderizado condicional
  // -------------------------------
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans px-4 py-6 text-gray-900 dark:text-slate-100 transition-colors duration-300">
      {!user ? (
        <>
          {sessionMessage && (
            <div className="mb-4 max-w-2xl w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
              {sessionMessage}
            </div>
          )}
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
              <div className="text-right flex-1 sm:flex-none leading-tight">
                <p className="text-sm font-semibold text-gray-700 dark:text-slate-100">
                  Hola, {user.username} 👋
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-300">
                  Sesión personalizada activa
                </p>
              </div>

              <nav className="hidden sm:flex flex-wrap items-center justify-end gap-3">
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-1">
                  <button
                    onClick={() => navigateTo("home")}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                      activePage === "home"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    Inicio
                  </button>
                  <button
                    onClick={() => navigateTo("config")}
                    disabled={user?.role !== "admin"}
                    className={`px-4 py-2 rounded-md text-sm font-semibold transition ${
                      user?.role !== "admin"
                        ? "text-gray-400 dark:text-slate-500 cursor-not-allowed"
                        : activePage === "config"
                        ? "bg-blue-600 text-white shadow"
                        : "text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                    }`}
                  >
                    Configuración
                  </button>
                </div>

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
              </nav>

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
                  <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 p-2">
                    <button
                      onClick={() => navigateTo("home")}
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${
                        activePage === "home"
                          ? "bg-blue-600 text-white shadow"
                          : "text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Inicio
                    </button>
                    <button
                      onClick={() => navigateTo("config")}
                      disabled={user?.role !== "admin"}
                      className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition ${
                        user?.role !== "admin"
                          ? "text-gray-400 dark:text-slate-500 cursor-not-allowed"
                          : activePage === "config"
                          ? "bg-blue-600 text-white shadow"
                          : "text-gray-700 dark:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                      }`}
                    >
                      Configuración
                    </button>
                  </div>

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
          <main className="space-y-10">
            {activePage === "config" ? (
              <ConfigurationPage
                user={user}
                onUnauthorized={handleUnauthorized}
              />
            ) : (
              <>
                <HomeModules
                  user={user}
                  onUnauthorized={handleUnauthorized}
                  onDataReceived={(data) =>
                    console.log("📈 Resultado del análisis:", data)
                  }
                  onNavigateModule={navigateToModule}
                  currentModule={currentModule}
                />

                {renderModuleContent()}
              </>
            )}
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
