import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";

const defaultFormState = {
  username: "",
  fullName: "",
  password: "",
  role: "user",
  expiresAt: "",
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(defaultFormState);

  const token = useMemo(() => localStorage.getItem("token"), []);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }),
    [token]
  );

  const fetchUsers = async () => {
    if (!token) {
      setError("No se encontró un token válido. Inicia sesión nuevamente.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error("No se pudo obtener la lista de usuarios");
      }

      const data = await response.json();
      setUsers(Array.isArray(data.users) ? data.users : []);
    } catch (err) {
      console.error("Error al cargar usuarios:", err);
      setError(err.message || "Ocurrió un error al cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    if (!formData.username.trim() || !formData.password.trim()) {
      setError("Usuario y contraseña son obligatorios.");
      setSubmitting(false);
      return;
    }

    const payload = {
      username: formData.username.trim(),
      password: formData.password.trim(),
      full_name: formData.fullName.trim() || formData.username.trim(),
      role: formData.role,
      expires_at: formData.expiresAt
        ? new Date(formData.expiresAt).toISOString()
        : null,
    };

    try {
      const response = await fetch(`${API_URL}/auth/users`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(backendMessage || "No se pudo crear el usuario");
      }

      setMessage(`Usuario ${payload.username} creado correctamente.`);
      setFormData(defaultFormState);
      fetchUsers();
    } catch (err) {
      console.error("Error al crear usuario:", err);
      setError(err.message || "No se pudo crear el usuario.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRoleChange = async (username, newRole) => {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/users/${username}/role`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(backendMessage || "No se pudo actualizar el rol");
      }

      setMessage(`Rol de ${username} actualizado a ${newRole}.`);
      setUsers((prev) =>
        prev.map((user) =>
          user.username === username ? { ...user, role: newRole } : user
        )
      );
    } catch (err) {
      console.error("Error al actualizar rol:", err);
      setError(err.message || "No se pudo actualizar el rol.");
    }
  };

  const handleDelete = async (username) => {
    const confirmed = window.confirm(
      `¿Estás seguro de eliminar al usuario "${username}"?`
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/users/${username}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(backendMessage || "No se pudo eliminar el usuario");
      }

      setMessage(`Usuario ${username} eliminado.`);
      setUsers((prev) => prev.filter((user) => user.username !== username));
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setError(err.message || "No se pudo eliminar el usuario.");
    }
  };

  return (
    <section className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300">
            Gestión de usuarios
          </h3>
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Los administradores pueden crear, actualizar roles y eliminar cuentas.
          </p>
        </div>
        <button
          onClick={fetchUsers}
          className="self-start sm:self-auto px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-sm text-gray-700 dark:text-slate-100 bg-gray-50 dark:bg-slate-800 hover:shadow-md transition"
        >
          ↻ Actualizar
        </button>
      </header>

      {message && (
        <div className="rounded-lg bg-green-50 text-green-800 border border-green-200 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 text-red-800 border border-red-200 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4 border border-gray-200 dark:border-slate-800"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Usuario
          </label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleInputChange}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            placeholder="Ej: ana.garcia"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Nombre completo
          </label>
          <input
            type="text"
            name="fullName"
            value={formData.fullName}
            onChange={handleInputChange}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            placeholder="Ej: Ana García"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Contraseña
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Rol
          </label>
          <select
            name="role"
            value={formData.role}
            onChange={handleInputChange}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="user">Usuario</option>
            <option value="admin">Administrador</option>
          </select>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Fecha de expiración (opcional)
          </label>
          <input
            type="datetime-local"
            name="expiresAt"
            value={formData.expiresAt}
            onChange={handleInputChange}
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          />
          <p className="text-xs text-gray-500 dark:text-slate-400">
            Si se establece, la cuenta quedará inactiva al cumplirse la fecha.
          </p>
        </div>

        <div className="md:col-span-2 flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow disabled:bg-blue-400"
          >
            {submitting ? "Guardando..." : "Crear usuario"}
          </button>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-200">
              <th className="p-3">Usuario</th>
              <th className="p-3">Nombre</th>
              <th className="p-3">Rol</th>
              <th className="p-3">Expira</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-4 text-center text-gray-500">
                  No hay usuarios registrados.
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr
                  key={user.username}
                  className="border-b border-gray-200 dark:border-slate-800"
                >
                  <td className="p-3 font-semibold text-gray-800 dark:text-slate-100">
                    {user.username}
                  </td>
                  <td className="p-3 text-gray-700 dark:text-slate-200">
                    {user.full_name || user.fullName || "—"}
                  </td>
                  <td className="p-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.username, e.target.value)}
                      disabled={user.username === "admin"}
                      className="w-full p-2 rounded border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="user">Usuario</option>
                      <option value="admin">Administrador</option>
                    </select>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-slate-300">
                    {user.expires_at || user.expiresAt || "Sin expiración"}
                  </td>
                  <td className="p-3 text-right space-x-2">
                    <button
                      onClick={() => handleRoleChange(user.username, user.role)}
                      disabled={user.username === "admin"}
                      className="px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 disabled:opacity-60"
                    >
                      Guardar rol
                    </button>
                    <button
                      onClick={() => handleDelete(user.username)}
                      disabled={user.username === "admin"}
                      className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 disabled:opacity-60"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default UserManagement;
