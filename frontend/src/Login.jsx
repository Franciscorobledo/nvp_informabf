import React, { useState } from "react";
import API_URL from "./api";
import AppCard from "../components/ui/AppCard";
import { PrimaryButton } from "../components/ui/Button";

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

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(normalizedUser));

      onLogin(normalizedUser);
    } catch (err) {
      console.error("💥 Error conexión:", err);
      alert("Error de conexión.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-xl">
      <AppCard
        title="InformeBF"
        subtitle="AI Data Visualizer — Accede a tu panel de análisis"
        className="backdrop-blur bg-slate-900/70"
      >
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-semibold text-slate-200">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              placeholder="Ingresa tu usuario"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-semibold text-slate-200">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full"
            />
          </div>

          <PrimaryButton type="submit" disabled={loading} className="mt-2 w-full py-3 text-base">
            {loading ? "Ingresando..." : "Entrar"}
          </PrimaryButton>
        </form>
      </AppCard>
    </div>
  );
};

export default Login;
