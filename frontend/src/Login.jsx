import React, { useState } from "react";
import API_URL from "./api";
import { persistUserSession } from "./session";

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
      console.log("🚀 Enviando credenciales:", username);
      console.log("🌐 API_URL:", API_URL);

      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const msg = await res.text();
        console.error("❌ Error backend:", msg);
        alert("Credenciales incorrectas o servidor no disponible.");
        return;
      }

      const data = await res.json();

      const token = data.access_token || data.token;
      if (!token) {
        alert("No se recibió token del servidor.");
        return;
      }

      const normalizedUser = {
        username: data.username || username,
        role: data.role || "user",
      };

      persistUserSession(token, normalizedUser);

      onLogin(normalizedUser);
    } catch (err) {
      console.error("💥 Error conexión:", err);
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-layout">
      <div className="login-card">
        <div className="flex flex-col items-center mb-8 space-y-1 text-center">
          <img src="/logo.png" alt="Logo" className="w-28 mb-2 drop-shadow-xl" />
          <h2 className="text-3xl font-bold tracking-wide text-blue-300">
            InformeBF
          </h2>
          <p className="text-gray-300 text-base">
            AI Data Visualizer — Inicio de sesión
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 transition-all duration-200 text-lg"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="p-4 rounded-xl bg-slate-900/80 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-400 transition-all duration-200 text-lg"
          />

          <button
            type="submit"
            disabled={loading}
            className={`mt-2 ${
              loading ? "bg-gray-500" : "bg-blue-600 hover:bg-blue-700"
            } transition-all duration-300 text-white py-3.5 rounded-xl font-semibold shadow-xl text-lg`}
          >
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
