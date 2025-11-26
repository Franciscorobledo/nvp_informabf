import React, { useEffect, useState } from "react";
import API_URL from "./api";
import { persistUserSession } from "./session";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "auto";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

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
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full bg-blue-600/20 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-6 top-12 h-48 w-48 rounded-full bg-cyan-400/20 blur-3xl" aria-hidden="true" />
        <div className="absolute left-1/4 bottom-0 h-60 w-60 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden="true" />
      </div>

      <div className="relative w-full max-w-5xl px-1 sm:px-3 md:px-6">
        <div
          className="absolute inset-0 -z-10 rounded-[36px] bg-gradient-to-br from-blue-500/25 via-indigo-500/15 to-cyan-400/20 blur-3xl"
          aria-hidden="true"
        />

        <div className="login-card overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" aria-hidden="true" />
          <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />

          <div className="relative grid gap-10 md:gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div className="flex flex-col items-center text-center lg:items-start lg:text-left space-y-4">
              <div className="relative">
                <div className="h-24 w-24 rounded-[28px] bg-gradient-to-br from-blue-500 via-indigo-500 to-cyan-400 p-[6px] shadow-lg shadow-blue-500/30 ring-8 ring-white/5">
                  <div className="flex h-full w-full items-center justify-center rounded-[22px] bg-slate-950/80 border border-white/10">
                    <img
                      src="/logo.png"
                      alt="Logo InformeBF"
                      className="h-14 w-14 rounded-2xl object-contain drop-shadow-[0_10px_30px_rgba(59,130,246,0.35)]"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-[11px] tracking-[0.22em] uppercase text-blue-100">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
                  Seguridad AI Ready
                </div>
                <div className="space-y-1">
                  <h2 className="text-3xl md:text-4xl font-extrabold tracking-wide text-blue-100">InformeBF</h2>
                  <p className="text-gray-300 text-base md:text-lg">AI Data Visualizer — Inicio de sesión</p>
                  <p className="text-gray-300/90 text-sm md:text-base max-w-xl">
                    Accede a tus módulos de análisis y visualización con una experiencia optimizada para pantallas grandes y móviles.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleLogin}
              className="flex flex-col gap-4 sm:gap-5 bg-slate-950/40 rounded-2xl p-5 sm:p-6 md:p-8 border border-white/10 shadow-inner shadow-blue-900/30"
            >
              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-blue-100/80">Usuario</label>
                <input
                  type="text"
                  placeholder="Ingresa tu usuario"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/40 text-white placeholder-gray-400 transition-all duration-200 text-lg shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                />
              </div>

              <div className="flex flex-col gap-3">
                <label className="text-sm font-semibold text-blue-100/80">Contraseña</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="p-4 rounded-2xl bg-white/5 border border-white/10 focus:border-blue-400/60 focus:ring-2 focus:ring-blue-500/40 text-white placeholder-gray-400 transition-all duration-200 text-lg shadow-[0_10px_40px_rgba(0,0,0,0.35)]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className={`mt-2 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 px-6 py-4 text-lg font-semibold text-white shadow-[0_18px_50px_rgba(59,130,246,0.35)] transition-all duration-300 ${
                  loading ? "opacity-70" : "hover:translate-y-[-2px] hover:shadow-[0_25px_60px_rgba(59,130,246,0.45)]"
                }`}
              >
                {loading ? "Ingresando..." : "Entrar"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
