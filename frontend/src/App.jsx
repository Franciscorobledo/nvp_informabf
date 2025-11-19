import React, { useState, useEffect } from "react";
import Login from "./Login";
import FileUpload from "../components/FileUpload";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🧠 Verifica si existe sesión al iniciar
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log("🧩 Inicializando App.jsx → Token:", token, "| Usuario:", storedUser);

    if (token && storedUser) {
      console.log("✅ Sesión activa detectada.");
      setUser({ username: storedUser });
    } else {
      console.log("⚠️ No hay sesión activa, mostrando pantalla de login.");
    }

    setLoading(false);
  }, []);

  // 🔓 Maneja el login exitoso desde Login.jsx
  const handleLogin = (data) => {
    console.log("🎯 Login exitoso → usuario:", data.username);

    const token = localStorage.getItem("token");
    if (!token) {
      console.error("🚫 Token ausente en localStorage después del login.");
      return;
    }

    setUser(data);
  };

  // 🔒 Cierre de sesión
  const handleLogout = () => {
    console.log("👋 Cerrando sesión...");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
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
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center font-sans px-4 py-6">
      {!user ? (
        <>
          <p className="text-gray-700 mb-2 text-sm">
            🔐 Inicia sesión para acceder al panel de análisis
          </p>
          <Login onLogin={handleLogin} />
        </>
      ) : (
        <div className="w-full max-w-5xl p-6 bg-white rounded-2xl shadow-xl border border-gray-200">
          {/* HEADER */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 border-b pb-3">
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold text-blue-700">InformeBF</h1>
              <p className="text-sm text-gray-500">AI Data Visualizer</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-all duration-200 w-full sm:w-auto"
            >
              Cerrar sesión
            </button>
          </header>

          {/* MAIN */}
          <main>
            <h2 className="text-lg font-semibold mb-4 text-gray-700 text-center">
              📊 Carga y análisis de datos
            </h2>

            <FileUpload
              key={user.username}
              onDataReceived={(data) =>
                console.log("📈 Resultado del análisis:", data)
              }
            />

            <div className="mt-10 text-gray-600 text-sm text-center italic">
              Carga tus archivos .CSV o .XLSX para generar visualizaciones automáticas.
            </div>
          </main>

          {/* FOOTER */}
          <footer className="mt-8 text-center text-gray-400 text-sm border-t pt-4">
            © {new Date().getFullYear()} InformeBF — Desarrollado con ❤️ y IA.
          </footer>
        </div>
      )}
    </div>
  );
};

export default App;
