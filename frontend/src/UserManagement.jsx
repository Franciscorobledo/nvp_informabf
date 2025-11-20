import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";

const defaultFormState = {
  username: "",
  fullName: "",
  password: "",
  role: "user",
  active: true,
  expiresAt: "",
};

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [formData, setFormData] = useState(defaultFormState);
  const [editingUser, setEditingUser] = useState(null);

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
        const backendMessage = await response.text();
        throw new Error(
          backendMessage || "No se pudo obtener la lista de usuarios"
        );
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

    const isEditing = Boolean(editingUser);

    if (!isEditing && (!formData.username.trim() || !formData.password.trim())) {
      setError("Usuario y contraseña son obligatorios para crear una cuenta.");
      setSubmitting(false);
      return;
    }

    const payload = isEditing
      ? {
          full_name: formData.fullName.trim(),
          role: formData.role,
          active: formData.active,
          expires_at: formData.expiresAt
            ? new Date(formData.expiresAt).toISOString()
            : null,
        }
      : {
          username: formData.username.trim(),
          password: formData.password.trim(),
          full_name: formData.fullName.trim() || formData.username.trim(),
          role: formData.role,
          active: formData.active,
          expires_at: formData.expiresAt
            ? new Date(formData.expiresAt).toISOString()
            : null,
        };

    try {
      const url = isEditing
        ? `${API_URL}/auth/users/${editingUser}`
        : `${API_URL}/auth/users`;
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(
          backendMessage ||
            (isEditing
              ? "No se pudo actualizar el usuario"
              : "No se pudo crear el usuario")
        );
      }

      setMessage(
        isEditing
          ? `Usuario ${editingUser} actualizado correctamente.`
          : `Usuario ${payload.username} creado correctamente.`
      );
      setEditingUser(null);
      setFormData(defaultFormState);
      fetchUsers();
    } catch (err) {
      console.error("Error al guardar usuario:", err);
      setError(
        err.message ||
          (isEditing
            ? "No se pudo actualizar el usuario."
            : "No se pudo crear el usuario.")
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleUserUpdate = async (username, payload, successMessage) => {
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/users/${username}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(backendMessage || "No se pudo actualizar el usuario");
      }

      setMessage(successMessage);
      fetchUsers();
    } catch (err) {
      console.error("Error al actualizar usuario:", err);
      setError(err.message || "No se pudo actualizar el usuario.");
    }
  };

  const handleRoleChange = async (username, newRole) => {
    await handleUserUpdate(username, { role: newRole }, `Rol de ${username} actualizado.`);
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
      if (editingUser === username) {
        setEditingUser(null);
        setFormData(defaultFormState);
      }
    } catch (err) {
      console.error("Error al eliminar usuario:", err);
      setError(err.message || "No se pudo eliminar el usuario.");
    }
  };

  const handleToggleActive = async (user) => {
    const nextState = !user.active;
    const actionLabel = nextState ? "activar" : "desactivar";
    const confirmed = window.confirm(
      `¿Deseas ${actionLabel} la cuenta de "${user.username}"?`
    );

    if (!confirmed) return;

    await handleUserUpdate(
      user.username,
      { active: nextState },
      `Usuario ${user.username} ${nextState ? "activado" : "desactivado"}.`
    );
  };

  const handleEdit = (user) => {
    setEditingUser(user.username);
    setFormData({
      username: user.username,
      fullName: user.full_name || user.fullName || "",
      password: "",
      role: user.role || "user",
      active: user.active ?? true,
      expiresAt: user.expires_at
        ? new Date(user.expires_at).toISOString().slice(0, 16)
        : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePasswordChange = async (username) => {
    const newPassword = window.prompt(
      `Nueva contraseña para ${username} (mínimo 4 caracteres):`
    );

    if (!newPassword) return;
    if (newPassword.trim().length < 4) {
      setError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/auth/users/${username}/password`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ password: newPassword.trim() }),
      });

      if (!response.ok) {
        const backendMessage = await response.text();
        throw new Error(backendMessage || "No se pudo actualizar la contraseña");
      }

      setMessage(`Contraseña de ${username} actualizada.`);
    } catch (err) {
      console.error("Error al actualizar contraseña:", err);
      setError(err.message || "No se pudo actualizar la contraseña.");
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return dateString;
    return date.toLocaleString();
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
            required={!editingUser}
            disabled={Boolean(editingUser)}
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
            required={!editingUser}
            placeholder={editingUser ? "(opcional, use 'Cambiar contraseña')" : ""}
            disabled={Boolean(editingUser)}
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

        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 dark:text-slate-200">
            Estado
          </label>
          <select
            name="active"
            value={String(formData.active)}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, active: e.target.value === "true" }))
            }
            className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900"
          >
            <option value="true">Activo</option>
            <option value="false">Inactivo</option>
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

        <div className="md:col-span-2 flex justify-end gap-3">
          {editingUser && (
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setFormData(defaultFormState);
              }}
              className="px-6 py-3 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-800 dark:text-slate-100 font-semibold shadow"
            >
              Cancelar edición
            </button>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold shadow disabled:bg-blue-400"
          >
            {submitting
              ? "Guardando..."
              : editingUser
              ? "Actualizar usuario"
              : "Crear usuario"}
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
              <th className="p-3">Estado</th>
              <th className="p-3">Creado</th>
              <th className="p-3">Expira</th>
              <th className="p-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="p-4 text-center text-gray-500">
                  Cargando usuarios...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" className="p-4 text-center text-gray-500">
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
                  <td className="p-3 font-semibold">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        user.active
                          ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                          : "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                      }`}
                    >
                      {user.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="p-3 text-gray-600 dark:text-slate-300">
                    {formatDate(user.created_at)}
                  </td>
                  <td className="p-3 text-gray-600 dark:text-slate-300">
                    {user.expires_at || user.expiresAt
                      ? formatDate(user.expires_at || user.expiresAt)
                      : "Sin expiración"}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handlePasswordChange(user.username)}
                        disabled={user.username === "admin"}
                        className="px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800 disabled:opacity-60"
                      >
                        Contraseña
                      </button>
                      <button
                        onClick={() => handleToggleActive(user)}
                        disabled={user.username === "admin"}
                        className="px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800 disabled:opacity-60"
                      >
                        {user.active ? "Desactivar" : "Activar"}
                      </button>
                      <button
                        onClick={() => handleDelete(user.username)}
                        disabled={user.username === "admin"}
                        className="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 disabled:opacity-60"
                      >
                        Eliminar
                      </button>
                    </div>
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
