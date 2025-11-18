import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import FileUpload from "../components/FileUpload.jsx";
import "./index.css";

// ---------------------------
// COMPONENTE LOGIN
// ---------------------------
const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      alert("Por favor, ingresa tus credenciales.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      console.log("🔄 Intentando iniciar sesión:", username);

      // ✅ URL dinámica desde .env
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        console.error("❌ Error del backend:", msg);
        alert("Usuario o contraseña incorrectos o servidor no disponible.");
        return;
      }

      const data = await res.json();
      console.log("✅ Login exitoso:", data);

      const token = data.access_token || data.token;
      if (!token) {
        alert("No se recibió token del servidor.");
        return;
      }

      // Guardar token y usuario
      localStorage.setItem("token", token);
      localStorage.setItem("user", data.username || username);

      console.log("🔐 Token guardado:", token);
      console.log("👤 Usuario logueado:", data.username || username);

      onLogin({ username: data.username || username });
    } catch (err) {
      console.error("💥 Error de conexión:", err);
      alert("No se pudo conectar con el servidor. Verifica que el backend esté activo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-800 text-white">
      <div className="bg-slate-800/70 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-md border border-slate-700 animate-fade-in">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo.png" alt="Logo" className="w-24 mb-3 drop-shadow-lg" />
          <h2 className="text-2xl font-bold tracking-wide text-blue-400">
            InformeBF
          </h2>
          <p className="text-gray-400 text-sm mt-1">
            AI Data Visualizer — Inicio de sesión
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-all duration-200"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-all duration-200"
          />
          <button
            type="submit"
            disabled={loading}
            className={`mt-2 ${
              loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"
            } transition-all duration-300 text-white py-3 rounded-lg font-semibold shadow-lg`}
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

// ---------------------------
// COMPONENTE DASHBOARD
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
// COMPONENTE PRINCIPAL APP
// ---------------------------
const App = () => {
  const [user, setUser] = useState(null);

  // ✅ Mantener sesión activa si hay datos en localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem("user");
    const savedToken = localStorage.getItem("token");
    if (savedUser && savedToken) {
      console.log("🔁 Sesión restaurada automáticamente:", savedUser);
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

// Renderizar aplicación
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
