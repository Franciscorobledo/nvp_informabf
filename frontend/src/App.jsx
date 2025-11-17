import React, { useState, useEffect } from "react";
import Login from "./Login";
import FileUpload from "../components/FileUpload";

const App = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 🔍 Comprobamos el token y el usuario almacenado
  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    console.log("🧩 useEffect inicial → token:", token, "user:", storedUser);

    if (token && storedUser) {
      console.log("✅ Sesión encontrada, usuario autenticado.");
      setUser({ username: storedUser });
    } else {
      console.log("⚠️ No hay token, se requiere login.");
    }

    setLoading(false);
  }, []);

  const handleLogin = (data) => {
    console.log("🎯 handleLogin ejecutado, usuario:", data.username);
    const token = localStorage.getItem("token");
    console.log("🔐 Token actual en localStorage:", token);

    if (!token) {
      console.error("🚫 No se encontró token después del login.");
      return;
    }

    setUser(data);
  };

  const handleLogout = () => {
    console.log("👋 Cerrando sesión...");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p>Cargando aplicación...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      {!user ? (
        <>
          <p className="text-gray-700 mb-2">🔐 Renderizando componente Login...</p>
          <Login onLogin={handleLogin} />
        </>
      ) : (
        <div className="w-full max-w-2xl p-6 bg-white rounded-2xl shadow-xl text-center">
          <header className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">
              InformeBF — AI Data Visualizer 
            </h1>
            <button
              onClick={handleLogout}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Cerrar sesión
            </button>
          </header>

          <h2 className="text-lg font-semibold mb-4 text-gray-700">
            Carga y análisis de datos
          </h2>

          <FileUpload
            key={user.username}
            onDataReceived={(data) =>
              console.log("📊 Resultado del análisis:", data)
            }
          />
        </div>
      )}
    </div>
  );
};

export default App;
