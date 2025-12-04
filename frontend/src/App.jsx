import React, { useEffect, useRef, useState } from "react";
import Login from "./Login";
import ConfigurationPage from "./ConfigurationPage";
import MercadoLibreIntegration from "./MercadoLibreIntegration";
import AdminMercadoLibreApps from "./AdminMercadoLibreApps";
import DataUploadAnalysis from "../components/DataUploadAnalysis";
import DataMovieModule from "../components/DataMovieModule";
import DataComparisonModule from "../components/DataComparisonModule";
import HomeView from "./views/home/HomeView";
import MainLayout from "./layouts/MainLayout";
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
  const [modulesOpen, setModulesOpen] = useState(false);
  const moduleContentRef = useRef(null);

  const HomeIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.25h-5V21H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const BoxIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m4.5 7 7.5 4.25L19.5 7m-15 0L12 2.75 19.5 7m-15 0v10.25L12 22l7.5-4.75V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const GearIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 15.25a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.25 12a7.25 7.25 0 0 1-.074.995l1.662 1.211a.75.75 0 0 1 .173 1.048l-1.75 2.426a.75.75 0 0 1-.992.21l-1.88-.985a7.273 7.273 0 0 1-1.72.999l-.279 2.1a.75.75 0 0 1-.742.646h-3.5a.75.75 0 0 1-.742-.646l-.28-2.1a7.26 7.26 0 0 1-1.719-.998l-1.88.984a.75.75 0 0 1-.992-.21l-1.75-2.426a.75.75 0 0 1 .173-1.048l1.662-1.21A7.251 7.251 0 0 1 4.75 12c0-.336.025-.667.074-.995L3.162 9.794a.75.75 0 0 1-.173-1.048l1.75-2.426a.75.75 0 0 1 .992-.21l1.88.985c.54-.404 1.121-.742 1.72-.999l.28-2.1A.75.75 0 0 1 10.583 3h3.5a.75.75 0 0 1 .742.646l.28 2.1c.598.257 1.18.595 1.719.999l1.88-.985a.75.75 0 0 1 .992.21l1.75 2.426a.75.75 0 0 1-.173 1.048l-1.662 1.21c.05.328.075.659.075.995Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const SunIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2v2.5M12 19.5V22M4.5 12H2m20 0h-2.5M18.95 5.05 17.2 6.8M6.8 17.2 5.05 18.95M18.95 18.95 17.2 17.2M6.8 6.8 5.05 5.05"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );

  const MoonIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M20.5 14.25A8.25 8.25 0 0 1 10.274 4.03 7.25 7.25 0 1 0 20.5 14.25Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const SparklesIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m12 3.5 1.1 2.4 2.4 1.1-2.4 1.1-1.1 2.4-1.1-2.4-2.4-1.1 2.4-1.1L12 3.5ZM6.25 11l.75 1.6 1.6.75-1.6.75-.75 1.6-.75-1.6-1.6-.75 1.6-.75.75-1.6Zm12.5 0 .75 1.6 1.6.75-1.6.75-.75 1.6-.75-1.6-1.6-.75 1.6-.75.75-1.6Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ClockIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 7.5V12l2.5 1.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ShieldIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12 21s7-3.5 7-10.5V6.25L12 3 5 6.25V10.5C5 17.5 12 21 12 21Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m9.5 12.25 1.75 1.75 3.25-3.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const LogoutIcon = ({ className = "" }) => (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M15.5 7V6a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1m3-4-3-3m3 3-3 3m3-3H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const getNavigationFromPath = (path) => {
    if (path.startsWith("/modules/analyze"))
      return { page: "home", module: "analyze" };
    if (path.startsWith("/modules/movie"))
      return { page: "home", module: "movie" };
    if (path.startsWith("/modules/compare"))
      return { page: "home", module: "compare" };
    if (path.startsWith("/integraciones/mercadolibre"))
      return { page: "meli-user", module: "home" };
    if (path.startsWith("/admin/integraciones/mercadolibre"))
      return { page: "meli-admin", module: "home" };
    if (path.startsWith("/integrations"))
      return { page: "integrations", module: "home" };
    if (path.startsWith("/config")) return { page: "config", module: "home" };
    return { page: "home", module: "analyze" };
  };

  const initialNavigation = getNavigationFromPath(window.location.pathname);

  const [activePage, setActivePage] = useState(initialNavigation.page);
  const [currentModule, setCurrentModule] = useState(initialNavigation.module);

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      if (isTokenExpired(token)) {
        clearStoredSession();
        setSessionMessage("Tu sesión expiró. Vuelve a iniciar sesión.");
      } else {
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
      setModulesOpen(false);
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

  const handleLogin = (data) => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    setSessionMessage("");
    setUser({ username: data.username, role: data.role || "user" });
    setCurrentModule("analyze");
  };

  const handleLogout = (eventOrMessage = "") => {
    const isEvent =
      eventOrMessage &&
      typeof eventOrMessage === "object" &&
      "preventDefault" in eventOrMessage;

    if (isEvent) {
      eventOrMessage.preventDefault();
    }

    clearStoredSession();

    const message = typeof eventOrMessage === "string" ? eventOrMessage : "";
    setSessionMessage(
      message || "Sesión cerrada. Vuelve a iniciar sesión para continuar."
    );
    setUser(null);
    setActivePage("home");
    setCurrentModule("home");
    setMenuOpen(false);
    setModulesOpen(false);
    window.history.replaceState({ page: "home" }, "", "/");
    window.scrollTo(0, 0);
  };

  const handleUnauthorized = (message) => {
    handleLogout(message || "Tu sesión expiró. Vuelve a iniciar sesión.");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    setMenuOpen(false);
    setModulesOpen(false);
  };

  const navigateTo = (page) => {
    if (page === "config" && user?.role !== "admin") {
      setSessionMessage(
        "Solo los administradores pueden acceder al panel de configuración."
      );
      setActivePage("home");
      setCurrentModule("home");
      setMenuOpen(false);
      setModulesOpen(false);
      return;
    }

    setActivePage(page);
    setMenuOpen(false);
    setModulesOpen(false);

    if (page === "config") {
      window.history.pushState({ page }, "", "/config");
      setCurrentModule("home");
    } else if (page === "integrations") {
      window.history.pushState({ page }, "", "/integrations");
      setCurrentModule("home");
    } else {
      window.history.pushState({ page }, "", "/");
      setCurrentModule("analyze");
    }
  };

  const goToMeliUser = () => {
    setActivePage("meli-user");
    setMenuOpen(false);
    window.history.pushState({ page: "meli-user" }, "", "/integraciones/mercadolibre");
    window.scrollTo(0, 0);
  };

  const goToMeliAdmin = () => {
    if (user?.role !== "admin") {
      setSessionMessage("Solo el administrador puede gestionar apps de Mercado Libre.");
      return;
    }
    setActivePage("meli-admin");
    setMenuOpen(false);
    window.history.pushState(
      { page: "meli-admin" },
      "",
      "/admin/integraciones/mercadolibre"
    );
    window.scrollTo(0, 0);
  };

  const scrollToModuleContent = () => {
    if (!moduleContentRef.current) return;

    const offset = 100;
    const targetPosition =
      moduleContentRef.current.getBoundingClientRect().top + window.scrollY - offset;

    window.scrollTo({ top: targetPosition, behavior: "smooth" });
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
    setModulesOpen(false);
    window.history.pushState({ module: moduleId }, "", moduleRoutes[moduleId] || "/");
    scrollToModuleContent();
  };

  useEffect(() => {
    if (!user) {
      setActivePage("home");
      setCurrentModule("home");
      setMenuOpen(false);
      window.history.replaceState({ page: "home" }, "", "/");
    }
  }, [user]);

  useEffect(() => {
    if (currentModule === "home") return;

    const timeoutId = setTimeout(scrollToModuleContent, 50);
    return () => clearTimeout(timeoutId);
  }, [currentModule]);

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
            onDataReceived={(data) => console.log("📈 Resultado del análisis:", data)}
            onNavigateModule={navigateToModule}
            onOpenIntegrations={() => navigateTo("integrations")}
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

  const appShellClasses = !user
    ? "min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex items-center justify-center font-sans px-4 py-10 text-white"
    : "min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans text-gray-900 dark:text-slate-100 transition-colors duration-300";

  return (
    <div className={appShellClasses}>
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <>
          <header className="fixed top-0 left-0 right-0 z-40 w-full flex justify-center px-2 sm:px-0">
            <div className="w-full max-w-6xl px-3">
              <div className="relative overflow-hidden lg:overflow-visible rounded-2xl border border-white/70 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl shadow-[0_20px_70px_-35px_rgba(15,23,42,0.6)]">
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-r from-blue-50/60 via-white/0 to-indigo-100/40 dark:from-slate-800/50 dark:via-slate-950/20 dark:to-indigo-900/50"
                  aria-hidden="true"
                />
                <div className="relative flex items-center gap-3 sm:gap-4 px-4 sm:px-6 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/20 ring-4 ring-white/60 dark:ring-slate-800/60">
                      <span className="text-lg" aria-hidden="true">
                        ✨
                      </span>
                    </div>
                    <div className="leading-tight">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white tracking-tight">
                        InformeBF
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">Insights con IA</p>
                    </div>
                  </div>

                  <nav className="hidden lg:flex items-center gap-1 ml-4">
                    <button
                      onClick={() => navigateTo("home")}
                      className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                        activePage === "home"
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                          : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <HomeIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                      Inicio
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setModulesOpen((prev) => !prev)}
                        className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                          modulesOpen
                            ? "bg-slate-900 text-white shadow-lg shadow-indigo-500/20"
                            : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                        }`}
                        aria-expanded={modulesOpen}
                        aria-haspopup="menu"
                      >
                        <BoxIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                        Módulos
                        <span className={`transition-transform duration-200 ${modulesOpen ? "rotate-180" : "rotate-0"}`}>
                          ▾
                        </span>
                      </button>

                      {modulesOpen && (
                        <div className="absolute left-0 mt-2 w-64 rounded-2xl border border-white/70 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-xl p-2 space-y-1">
                          <button
                            onClick={() => navigateToModule("analyze")}
                            className={`group flex w-full items-start justify-between gap-2 rounded-xl px-3 py-2 text-sm text-left transition-all duration-200 hover:-translate-y-0.5 ${
                              currentModule === "analyze"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold">Carga y análisis</span>
                              <span className="text-xs text-slate-500 dark:text-slate-300">Análisis rápido</span>
                            </div>
                            <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                              Recomendado
                            </span>
                          </button>
                          <button
                            onClick={() => navigateToModule("movie")}
                            className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-sm text-left transition-all duration-200 hover:-translate-y-0.5 ${
                              currentModule === "movie"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold">Película de datos</span>
                              <span className="text-xs text-slate-500 dark:text-slate-300">Animaciones</span>
                            </div>
                          </button>
                          <button
                            onClick={() => navigateToModule("compare")}
                            className={`group flex w-full items-start gap-2 rounded-xl px-3 py-2 text-sm text-left transition-all duration-200 hover:-translate-y-0.5 ${
                              currentModule === "compare"
                                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/80 dark:hover:bg-slate-800/70"
                            }`}
                          >
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold">Comparativa</span>
                              <span className="text-xs text-slate-500 dark:text-slate-300">Resultados lado a lado</span>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => navigateTo("integrations")}
                      className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                        activePage === "integrations"
                          ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                          : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <SparklesIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                      Integraciones
                    </button>

                    {user?.role === "admin" && (
                      <button
                        onClick={() => navigateTo("config")}
                        className={`group flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 ${
                          activePage === "config"
                            ? "bg-slate-900 text-white shadow-lg shadow-slate-900/30"
                            : "text-slate-700 dark:text-slate-100 hover:bg-slate-100/70 dark:hover:bg-slate-800/70"
                        }`}
                      >
                        <GearIcon className="h-4 w-4 transition-transform duration-200 group-hover:-translate-y-0.5" />
                        Configuración
                      </button>
                    )}
                  </nav>

                  <div className="hidden sm:flex items-center gap-3 sm:ml-auto">
                    <div className="text-right leading-tight">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-50">
                        Hola, {user.username} 👋
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-300">Sesión activa y segura</p>
                    </div>

                    <button
                      onClick={toggleTheme}
                      aria-pressed={theme === "dark"}
                      className="relative inline-flex items-center gap-2 rounded-full border border-white/70 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/70 px-2 py-1 text-xs font-semibold text-slate-700 dark:text-slate-100 shadow-inner shadow-white/60 dark:shadow-none transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                    >
                      <span
                        className={`flex items-center justify-center h-6 w-6 rounded-full bg-white/90 dark:bg-slate-700 text-slate-800 dark:text-amber-100 shadow-sm transition-transform duration-300 ${
                          theme === "dark" ? "translate-x-8" : "translate-x-0"
                        }`}
                      >
                        {theme === "dark" ? (
                          <MoonIcon className="h-3.5 w-3.5" />
                        ) : (
                          <SunIcon className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <span className="px-2">{theme === "dark" ? "Modo oscuro" : "Modo claro"}</span>
                    </button>

                    <button
                      onClick={handleLogout}
                      className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 bg-white/70 dark:bg-slate-800/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                    >
                      <LogoutIcon className="h-4 w-4 opacity-80 transition-transform duration-200 group-hover:-translate-y-0.5" />
                      Cerrar sesión
                    </button>
                  </div>

                  <button
                    className="inline-flex items-center justify-center rounded-xl border border-white/70 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 text-slate-700 dark:text-slate-100 p-2 shadow-sm hover:shadow-md transition lg:hidden ml-auto"
                    onClick={() => {
                      setMenuOpen((prev) => !prev);
                      setModulesOpen(false);
                    }}
                    aria-expanded={menuOpen}
                    aria-label="Abrir menú"
                  >
                    <span className="text-lg" aria-hidden="true">
                      ☰
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </header>

          {menuOpen && (
            <div className="fixed inset-0 z-30 lg:hidden">
              <div
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-4 top-4 w-72 rounded-2xl border border-white/70 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl p-4 space-y-3 transform transition duration-200">
                <div className="flex items-center gap-3 pb-2 border-b border-slate-200/70 dark:border-slate-800">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/25">
                    <span aria-hidden="true">✨</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">InformeBF</p>
                    <p className="text-xs text-slate-500 dark:text-slate-300">AI Data Visualizer</p>
                  </div>
                </div>

                <button
                  onClick={() => navigateTo("home")}
                  className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                    activePage === "home"
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                      : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                  }`}
                >
                  <HomeIcon className="h-4 w-4" />
                  Inicio
                </button>

                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">Módulos</p>
                  <button
                    onClick={() => navigateToModule("analyze")}
                    className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      currentModule === "analyze"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                    }`}
                  >
                    <span className="flex-1 text-left">Carga y análisis</span>
                    <span className="rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
                      Recomendado
                    </span>
                  </button>
                  <button
                    onClick={() => navigateToModule("movie")}
                    className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      currentModule === "movie"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                    }`}
                  >
                    <span className="flex-1 text-left">Película de datos</span>
                  </button>
                  <button
                    onClick={() => navigateToModule("compare")}
                    className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      currentModule === "compare"
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                        : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                    }`}
                  >
                    <span className="flex-1 text-left">Comparativa</span>
                  </button>
                </div>

                <button
                  onClick={() => navigateTo("integrations")}
                  className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                    activePage === "integrations"
                      ? "bg-emerald-600 text-white shadow-lg shadow-emerald-500/30"
                      : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                  }`}
                >
                  <SparklesIcon className="h-4 w-4" />
                  Integraciones
                </button>

                {user?.role === "admin" && (
                  <button
                    onClick={() => navigateTo("config")}
                    className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 ${
                      activePage === "config"
                        ? "bg-slate-900 text-white shadow-lg shadow-slate-900/30"
                        : "text-slate-800 dark:text-slate-100 bg-slate-100/80 dark:bg-slate-800/70"
                    }`}
                  >
                    <GearIcon className="h-4 w-4" />
                    Configuración
                  </button>
                )}

                <button
                  onClick={toggleTheme}
                  aria-pressed={theme === "dark"}
                  className="flex items-center justify-between w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/70 px-3 py-2 text-sm font-semibold text-slate-800 dark:text-slate-100 transition-all duration-200 hover:-translate-y-0.5"
                >
                  <span className="flex items-center gap-2">
                    {theme === "dark" ? <MoonIcon className="h-4 w-4" /> : <SunIcon className="h-4 w-4" />}
                    {theme === "dark" ? "Modo oscuro" : "Modo claro"}
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-300">
                    {theme === "dark" ? "Activo" : "Desactivado"}
                  </span>
                </button>

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    handleLogout();
                  }}
                  className="group flex items-center gap-2 w-full rounded-xl border border-slate-200 dark:border-slate-700 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-100 bg-white/70 dark:bg-slate-800/70 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <LogoutIcon className="h-4 w-4 opacity-80 transition-transform duration-200 group-hover:-translate-y-0.5" />
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}

          <MainLayout>
            <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-900/40 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-100 shadow-sm">
                    <SparklesIcon className="h-4 w-4" /> Nueva experiencia
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-900/30 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-100 shadow-sm">
                    <ClockIcon className="h-4 w-4" /> Listo en minutos
                  </span>
                </div>
              </div>
            </header>

            <main className="space-y-10">
              {activePage === "config" && user?.role === "admin" ? (
                <ConfigurationPage
                  user={user}
                  onUnauthorized={handleUnauthorized}
                />
              ) : activePage === "integrations" ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-sm p-5 space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                      Integraciones disponibles
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Conecta Mercado Libre en modo usuario u administra apps oficiales si eres administrador.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        onClick={goToMeliUser}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white px-5 py-2.5 text-sm font-semibold shadow hover:-translate-y-0.5 transition"
                      >
                        Ir a integración de usuario
                      </button>
                      <button
                        onClick={goToMeliAdmin}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-800 dark:text-slate-100"
                      >
                        Panel admin Mercado Libre
                      </button>
                    </div>
                  </div>
                </div>
              ) : activePage === "meli-user" ? (
                <MercadoLibreIntegration onUnauthorized={handleUnauthorized} />
              ) : activePage === "meli-admin" ? (
                <AdminMercadoLibreApps onUnauthorized={handleUnauthorized} />
              ) : (
                <>
                  <div ref={moduleContentRef} className="space-y-8">
                    {renderModuleContent()}
                  </div>

                  <HomeView
                    onUnauthorized={handleUnauthorized}
                    onNavigate={(page, module) => {
                      if (page === "integrations") {
                        navigateTo("integrations");
                        return;
                      }
                      if (module) {
                        navigateToModule(module);
                        return;
                      }
                      navigateTo(page || "home");
                    }}
                  />
                </>
              )}
            </main>

            <footer className="mt-16 border-t border-gray-200 dark:border-slate-800 px-6 py-8 text-center text-sm text-gray-500 dark:text-slate-400">
              <div className="flex flex-col items-center gap-3">

                <span className="font-semibold text-gray-700 dark:text-slate-200 tracking-tight">
                  InformeBF • Plataforma de Análisis Inteligente
                </span>

                <p className="max-w-md text-xs text-gray-500 dark:text-slate-500">
                  Transformando datos en decisiones claras. Tecnología creada para PYMEs, equipos modernos
                  y mentes curiosas.
                </p>

                <div className="flex items-center gap-4 mt-2 text-xs">
                  <a className="hover:text-primary-500 transition-colors" href="/terminos">
                    Términos & Condiciones
                  </a>
                  <span>•</span>
                  <a className="hover:text-primary-500 transition-colors" href="/privacidad">
                    Política de Privacidad
                  </a>
                  <span>•</span>
                  <a className="hover:text-primary-500 transition-colors" href="/soporte">
                    Soporte
                  </a>
                </div>

                <div className="mt-4 text-xs text-gray-400 dark:text-slate-600">
                  © {new Date().getFullYear()} InformeBF — Datos que hablan, decisiones que avanzan.
                </div>

              </div>
            </footer>

          </MainLayout>
        </>
      )}
    </div>
  );
};

export default App;
