import React, { useState } from "react";

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      console.log("🚀 Enviando credenciales al backend:", { username });

      const formData = new FormData();
      formData.append("username", username);
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/auth/login", {
        method: "POST",
        body: formData,
      });

      console.log("📡 Respuesta HTTP:", res.status);

      if (!res.ok) {
        const msg = await res.text();
        console.error("❌ Error del servidor:", msg);
        alert("Error al iniciar sesión. Verifica tus credenciales.");
        return;
      }

      const data = await res.json();
      console.log("📩 Datos recibidos:", data);

      const token = data.access_token || data.token || data.access || null;

      if (!token) {
        console.error("⚠️ El servidor no devolvió un token válido:", data);
        alert("El servidor no devolvió un token válido.");
        return;
      }

      // Guardamos el token
      localStorage.setItem("token", token);
      localStorage.setItem("user", data.user || username);

      // Confirmar inmediatamente
      console.log("🔐 Token guardado en localStorage:", localStorage.getItem("token"));

      // Notificar al componente padre
      onLogin({ username: data.user || username });
    } catch (err) {
      console.error("💥 Error de red o conexión:", err);
      alert("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-xl shadow-md w-80">
        <h2 className="text-center text-xl font-semibold mb-4">Iniciar sesión</h2>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="text"
            placeholder="Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded-md"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border px-3 py-2 rounded-md"
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 rounded-md font-semibold ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700 text-white"
            }`}
          >
            {loading ? "Iniciando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
