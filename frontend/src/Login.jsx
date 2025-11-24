import React, { useState } from "react";
import API_URL from "./api";
import { LoadingBanner, MessageCard } from "../components/Feedback";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!username.trim() || !password.trim()) {
      setError("Por favor, ingresa usuario y contraseña.");
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
        setError("Credenciales incorrectas o servidor no disponible.");
        return;
      }

      const data = await res.json();

      const token = data.access_token || data.token;
      if (!token) {
        setError("No se recibió token del servidor.");
        return;
      }

      const normalizedUser = {
        username: data.username || username,
        role: data.role || "user",
      };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      onLogin(normalizedUser);
    } catch (err) {
      console.error("💥 Error conexión:", err);
      setError("Error de conexión. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-slate-950 px-4 py-10 text-slate-100">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
        <div className="absolute left-4 top-10 h-56 w-56 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute right-10 bottom-8 h-60 w-60 rounded-full bg-emerald-500/20 blur-3xl" />
      </div>

      <div className="relative w-full max-w-xl rounded-3xl border border-white/10 bg-slate-900/70 p-10 shadow-2xl shadow-blue-500/20 backdrop-blur-xl">
        <div className="mb-8 space-y-2 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-2xl shadow-lg shadow-blue-600/30">
            🔐
          </div>
          <h1 className="text-3xl font-bold text-white">Inicia sesión en InformeBF</h1>
          <p className="text-sm text-slate-300">
            Analiza tus archivos de ventas, stock y más con IA.
          </p>
        </div>

        <form onSubmit={handleLogin} className="flex flex-col gap-5">
          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Usuario</span>
            <input
              type="text"
              placeholder="Ej: analista@empresa.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 placeholder:text-slate-400"
            />
          </label>

          <label className="space-y-2 text-sm font-medium text-slate-200">
            <span>Contraseña</span>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white shadow-inner focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/60 placeholder:text-slate-400"
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-lg font-semibold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-500"
          >
            {loading ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {loading && <LoadingBanner message="Validando credenciales..." subtle />}
          {error && <MessageCard message={error} />}
        </div>
      </div>
    </div>
  );
};

export default Login;
