import React, { useState } from "react";

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
      console.log("🚀 Enviando credenciales al backend:", { username });

      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      // ✅ URL dinámica desde el entorno (.env)
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:10000";

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: formData,
      });

      console.log("📡 Respuesta HTTP:", res.status);

      if (!res.ok) {
        const msg = await res.text();
        console.error("❌ Error del backend:", msg);
        alert("Usuario o contraseña incorrectos, o servidor no disponible.");
        return;
      }

      const data = await res.json();
      console.log("📩 Datos recibidos:", data);

      // ✅ Leer token con compatibilidad total
      const token = data.access_token || data.token;
      if (!token) {
        console.error("⚠️ No se recibió token válido:", data);
        alert("El servidor no devolvió un token válido.");
        return;
      }

      // ✅ Guardar sesión local
      localStorage.setItem("token", token);
      localStorage.setItem("user", data.username || username);

      console.log("🔐 Token guardado en localStorage:", token);
      console.log("👤 Usuario:", data.username || username);

      // ✅ Notificar al componente padre
      onLogin({ username: data.username || username });
    } catch (err) {
      console.error("💥 Error de red o conexión:", err);
      alert("No se pudo conectar con el servidor. Verifica que esté activo.");
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
            required
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-3 rounded-lg bg-slate-900 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-all duration-200"
            required
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

export default Login;
