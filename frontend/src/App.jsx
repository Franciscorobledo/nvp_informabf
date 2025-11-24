import React, { useState, useEffect } from "react";
import Login from "./Login";
import HomeModules from "../components/HomeModules";
import ConfigurationPage from "./ConfigurationPage";
import DataUploadAnalysis from "../components/DataUploadAnalysis";
import DataMovieModule from "../components/DataMovieModule";
import DataComparisonModule from "../components/DataComparisonModule";
import AppLayout from "./AppLayout";
import { LoadingBanner } from "../components/Feedback";

const navItems = [
  { id: "home", label: "Home" },
  { id: "analysis", label: "Carga y análisis" },
  { id: "movie", label: "Película de datos" },
  { id: "comparison", label: "Comparativa" },
  { id: "users", label: "Gestión de usuarios" },
];

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("dark");
  const [activePage, setActivePage] = useState("home");

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

  const handleLogin = (data) => {
    console.log("🎯 Login exitoso → usuario:", data.username);

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("🚫 Token ausente en localStorage después del login.");
      return;
    }

    setUser({ username: data.username, role: data.role || "user" });
  };

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
  };

  const renderActivePage = () => {
    switch (activePage) {
      case "analysis":
        return (
          <DataUploadAnalysis
            user={user}
            onUnauthorized={handleUnauthorized}
            onDataReceived={(data) => console.log("📈 Resultado del análisis:", data)}
          />
        );
      case "movie":
        return <DataMovieModule onUnauthorized={handleUnauthorized} />;
      case "comparison":
        return <DataComparisonModule onUnauthorized={handleUnauthorized} />;
      case "users":
        return <ConfigurationPage user={user} onUnauthorized={handleUnauthorized} />;
      default:
        return (
          <HomeModules
            user={user}
            onUnauthorized={handleUnauthorized}
            onDataReceived={(data) => console.log("📈 Resultado del análisis:", data)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
        <LoadingBanner message="Cargando aplicación..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {!user ? (
        <Login onLogin={handleLogin} />
      ) : (
        <AppLayout
          user={user}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          activePage={activePage}
          navItems={navItems}
          onNavigate={setActivePage}
        >
          {renderActivePage()}
        </AppLayout>
      )}
    </div>
  );
};

export default App;
