import React, { useState, useEffect } from "react";
import Login from "./Login";
import HomeModules from "../components/HomeModules";
import ConfigurationPage from "./ConfigurationPage";
import AppLayout from "./AppLayout";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState("light");
  const [activePage, setActivePage] = useState("home");

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
  };

  const navigateTo = (page) => {
    setActivePage(page);
  };

  // ⏳ Pantalla de carga inicial
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <p className="text-sm text-slate-300">Cargando aplicación...</p>
      </div>
    );
  }

  // -------------------------------
  // 🧩 Renderizado condicional
  // -------------------------------
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {!user ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 py-10">
          <p className="text-base font-semibold text-slate-200">
            🔐 Inicia sesión para acceder al panel de análisis
          </p>
          <Login onLogin={handleLogin} />
        </div>
      ) : (
        <AppLayout
          user={user}
          theme={theme}
          onToggleTheme={toggleTheme}
          onLogout={handleLogout}
          activePage={activePage}
          onNavigate={navigateTo}
        >
          {activePage === "home" ? (
            <HomeModules
              user={user}
              onUnauthorized={handleUnauthorized}
              onDataReceived={(data) =>
                console.log("📈 Resultado del análisis:", data)
              }
            />
          ) : (
            <ConfigurationPage
              user={user}
              onUnauthorized={handleUnauthorized}
            />
          )}
        </AppLayout>
      )}
    </div>
  );
};

export default App;
