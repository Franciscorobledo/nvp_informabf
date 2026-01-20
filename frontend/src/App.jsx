import React, { useEffect, useMemo, useState } from "react";
import API_URL from "./api";
import "./index.css";

const defaultBot = {
  client_id: "",
  name: "",
  system_prompt: "Eres un bot de agenda profesional.",
  slack_channel_id: "",
  slack_team_id: "",
  slack_bot_user_id: "",
  is_active: true,
  openai_model: "gpt-4o-mini",
  openai_temperature: 0.2,
  google_calendar_id: "",
};

const defaultClient = {
  name: "",
  contact_email: "",
  timezone: "UTC",
  is_active: true,
};

const defaultService = {
  bot_id: "",
  name: "",
  duration_minutes: 30,
  is_active: true,
};

const useApi = (token) => {
  const headers = useMemo(() => {
    const base = { "Content-Type": "application/json" };
    if (token) {
      base.Authorization = `Bearer ${token}`;
    }
    return base;
  }, [token]);

  const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const detail = await response.json().catch(() => ({}));
      throw new Error(detail.detail || "Error de API");
    }
    if (response.status === 204) {
      return null;
    }
    return response.json();
  };

  return { request };
};

const Login = ({ onLogin }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Credenciales inválidas");
      }
      onLogin(data.access_token, data.username);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Panel SaaS de Bots de Agenda</h1>
        <p>Accede con tu usuario administrador.</p>
        <form onSubmit={handleSubmit}>
          <label>
            Usuario / Email
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              type="text"
              placeholder="admin@tuempresa.com"
              required
            />
          </label>
          <label>
            Contraseña
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              placeholder="********"
              required
            />
          </label>
          {error && <div className="error">{error}</div>}
          <button className="primary" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
};

const SectionHeader = ({ title, description }) => (
  <div className="section-header">
    <div>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  </div>
);

const App = () => {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [username, setUsername] = useState(localStorage.getItem("username"));
  const [activeTab, setActiveTab] = useState("clientes");
  const [clients, setClients] = useState([]);
  const [bots, setBots] = useState([]);
  const [services, setServices] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [health, setHealth] = useState(null);

  const [clientForm, setClientForm] = useState(defaultClient);
  const [botForm, setBotForm] = useState(defaultBot);
  const [serviceForm, setServiceForm] = useState(defaultService);
  const [editingClientId, setEditingClientId] = useState(null);
  const [editingBotId, setEditingBotId] = useState(null);
  const [editingServiceId, setEditingServiceId] = useState(null);

  const api = useApi(token);

  const refreshAll = async () => {
    const [clientData, botData, serviceData, reservationData, healthData] =
      await Promise.all([
        api.request("/clientes"),
        api.request("/bots"),
        api.request("/servicios"),
        api.request("/reservas"),
        api.request("/health"),
      ]);
    setClients(clientData);
    setBots(botData);
    setServices(serviceData);
    setReservations(reservationData);
    setHealth(healthData);
  };

  useEffect(() => {
    if (token) {
      refreshAll().catch(() => {});
    }
  }, [token]);

  const handleLogin = (newToken, user) => {
    localStorage.setItem("token", newToken);
    localStorage.setItem("username", user);
    setToken(newToken);
    setUsername(user);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setToken(null);
    setUsername(null);
  };

  if (!token) {
    return <Login onLogin={handleLogin} />;
  }

  const submitClient = async (event) => {
    event.preventDefault();
    if (editingClientId) {
      await api.request(`/clientes/${editingClientId}`, {
        method: "PUT",
        body: JSON.stringify(clientForm),
      });
    } else {
      await api.request("/clientes", {
        method: "POST",
        body: JSON.stringify(clientForm),
      });
    }
    setClientForm(defaultClient);
    setEditingClientId(null);
    refreshAll();
  };

  const submitBot = async (event) => {
    event.preventDefault();
    const payload = {
      ...botForm,
      client_id: Number(botForm.client_id),
      openai_temperature: Number(botForm.openai_temperature),
      is_active: Boolean(botForm.is_active),
    };
    if (editingBotId) {
      await api.request(`/bots/${editingBotId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api.request("/bots", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setBotForm(defaultBot);
    setEditingBotId(null);
    refreshAll();
  };

  const submitService = async (event) => {
    event.preventDefault();
    const payload = {
      ...serviceForm,
      bot_id: Number(serviceForm.bot_id),
      duration_minutes: Number(serviceForm.duration_minutes),
      is_active: Boolean(serviceForm.is_active),
    };
    if (editingServiceId) {
      await api.request(`/servicios/${editingServiceId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    } else {
      await api.request("/servicios", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    }
    setServiceForm(defaultService);
    setEditingServiceId(null);
    refreshAll();
  };

  const startEditClient = (client) => {
    setEditingClientId(client.id);
    setClientForm({
      name: client.name,
      contact_email: client.contact_email || "",
      timezone: client.timezone,
      is_active: client.is_active,
    });
  };

  const startEditBot = (bot) => {
    setEditingBotId(bot.id);
    setBotForm({
      client_id: bot.client_id,
      name: bot.name,
      system_prompt: bot.system_prompt,
      slack_channel_id: bot.slack_channel_id,
      slack_team_id: bot.slack_team_id || "",
      slack_bot_user_id: bot.slack_bot_user_id || "",
      is_active: bot.is_active,
      openai_model: bot.openai_model,
      openai_temperature: bot.openai_temperature,
      google_calendar_id: bot.google_calendar_id,
    });
  };

  const startEditService = (service) => {
    setEditingServiceId(service.id);
    setServiceForm({
      bot_id: service.bot_id,
      name: service.name,
      duration_minutes: service.duration_minutes,
      is_active: service.is_active,
    });
  };

  const deleteItem = async (path) => {
    await api.request(path, { method: "DELETE" });
    refreshAll();
  };

  return (
    <div className="app-shell">
      <aside>
        <h1>Agenda SaaS</h1>
        <nav>
          {[
            ["clientes", "Clientes"],
            ["bots", "Bots"],
            ["servicios", "Servicios"],
            ["reservas", "Reservas"],
            ["estado", "Estado"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={activeTab === key ? "active" : ""}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span>{username}</span>
          <button className="ghost" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main>
        {activeTab === "clientes" && (
          <section>
            <SectionHeader
              title="Clientes"
              description="Gestiona los tenants del SaaS."
            />
            <div className="grid">
              <form onSubmit={submitClient} className="card">
                <h3>{editingClientId ? "Editar cliente" : "Nuevo cliente"}</h3>
                <label>
                  Nombre
                  <input
                    value={clientForm.name}
                    onChange={(event) =>
                      setClientForm({ ...clientForm, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Email de contacto
                  <input
                    value={clientForm.contact_email}
                    onChange={(event) =>
                      setClientForm({
                        ...clientForm,
                        contact_email: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Zona horaria
                  <input
                    value={clientForm.timezone}
                    onChange={(event) =>
                      setClientForm({
                        ...clientForm,
                        timezone: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={clientForm.is_active}
                    onChange={(event) =>
                      setClientForm({
                        ...clientForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Cliente activo
                </label>
                <button className="primary" type="submit">
                  {editingClientId ? "Guardar cambios" : "Crear cliente"}
                </button>
              </form>

              <div className="card">
                <h3>Lista de clientes</h3>
                <ul className="list">
                  {clients.map((client) => (
                    <li key={client.id}>
                      <div>
                        <strong>{client.name}</strong>
                        <span>{client.contact_email || "Sin email"}</span>
                        <span>{client.timezone}</span>
                      </div>
                      <div className="actions">
                        <button onClick={() => startEditClient(client)}>
                          Editar
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteItem(`/clientes/${client.id}`)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {activeTab === "bots" && (
          <section>
            <SectionHeader
              title="Bots"
              description="Configura prompts, Slack y Google Calendar."
            />
            <div className="grid">
              <form onSubmit={submitBot} className="card">
                <h3>{editingBotId ? "Editar bot" : "Nuevo bot"}</h3>
                <label>
                  Cliente
                  <select
                    value={botForm.client_id}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        client_id: event.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Selecciona un cliente</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nombre del bot
                  <input
                    value={botForm.name}
                    onChange={(event) =>
                      setBotForm({ ...botForm, name: event.target.value })
                    }
                    required
                  />
                </label>
                <label>
                  Prompt del sistema
                  <textarea
                    rows={4}
                    value={botForm.system_prompt}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        system_prompt: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Slack Channel ID
                  <input
                    value={botForm.slack_channel_id}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        slack_channel_id: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Slack Team ID
                  <input
                    value={botForm.slack_team_id}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        slack_team_id: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Slack Bot User ID
                  <input
                    value={botForm.slack_bot_user_id}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        slack_bot_user_id: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Google Calendar ID
                  <input
                    value={botForm.google_calendar_id}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        google_calendar_id: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Modelo OpenAI
                  <input
                    value={botForm.openai_model}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        openai_model: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Temperatura OpenAI
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={botForm.openai_temperature}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        openai_temperature: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={botForm.is_active}
                    onChange={(event) =>
                      setBotForm({
                        ...botForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Bot activo
                </label>
                <button className="primary" type="submit">
                  {editingBotId ? "Guardar cambios" : "Crear bot"}
                </button>
              </form>

              <div className="card">
                <h3>Lista de bots</h3>
                <ul className="list">
                  {bots.map((bot) => (
                    <li key={bot.id}>
                      <div>
                        <strong>{bot.name}</strong>
                        <span>Cliente #{bot.client_id}</span>
                        <span>{bot.slack_channel_id}</span>
                      </div>
                      <div className="actions">
                        <button onClick={() => startEditBot(bot)}>
                          Editar
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteItem(`/bots/${bot.id}`)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {activeTab === "servicios" && (
          <section>
            <SectionHeader
              title="Servicios"
              description="Define los servicios y duraciones por bot."
            />
            <div className="grid">
              <form onSubmit={submitService} className="card">
                <h3>{editingServiceId ? "Editar servicio" : "Nuevo servicio"}</h3>
                <label>
                  Bot
                  <select
                    value={serviceForm.bot_id}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        bot_id: event.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Selecciona un bot</option>
                    {bots.map((bot) => (
                      <option key={bot.id} value={bot.id}>
                        {bot.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Nombre
                  <input
                    value={serviceForm.name}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        name: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label>
                  Duración (minutos)
                  <input
                    type="number"
                    min="5"
                    max="480"
                    value={serviceForm.duration_minutes}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        duration_minutes: event.target.value,
                      })
                    }
                    required
                  />
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={serviceForm.is_active}
                    onChange={(event) =>
                      setServiceForm({
                        ...serviceForm,
                        is_active: event.target.checked,
                      })
                    }
                  />
                  Servicio activo
                </label>
                <button className="primary" type="submit">
                  {editingServiceId ? "Guardar cambios" : "Crear servicio"}
                </button>
              </form>

              <div className="card">
                <h3>Lista de servicios</h3>
                <ul className="list">
                  {services.map((service) => (
                    <li key={service.id}>
                      <div>
                        <strong>{service.name}</strong>
                        <span>Bot #{service.bot_id}</span>
                        <span>{service.duration_minutes} min</span>
                      </div>
                      <div className="actions">
                        <button onClick={() => startEditService(service)}>
                          Editar
                        </button>
                        <button
                          className="danger"
                          onClick={() => deleteItem(`/servicios/${service.id}`)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {activeTab === "reservas" && (
          <section>
            <SectionHeader
              title="Reservas"
              description="Listado centralizado de citas confirmadas."
            />
            <div className="card">
              <table>
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Bot</th>
                    <th>Servicio</th>
                    <th>Usuario Slack</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>{reservation.client_id}</td>
                      <td>{reservation.bot_id}</td>
                      <td>{reservation.service_id || "-"}</td>
                      <td>{reservation.slack_user_id}</td>
                      <td>{new Date(reservation.start_time).toLocaleString()}</td>
                      <td>{new Date(reservation.end_time).toLocaleString()}</td>
                      <td>{reservation.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === "estado" && (
          <section>
            <SectionHeader
              title="Estado del sistema"
              description="Métricas rápidas de salud del SaaS."
            />
            <div className="status-grid">
              <div className="card">
                <h3>Salud</h3>
                <p>{health ? health.status : "Cargando..."}</p>
              </div>
              <div className="card">
                <h3>Clientes</h3>
                <p>{health ? health.clients : "-"}</p>
              </div>
              <div className="card">
                <h3>Bots</h3>
                <p>{health ? health.bots : "-"}</p>
              </div>
              <div className="card">
                <h3>Reservas</h3>
                <p>{health ? health.reservations : "-"}</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
};

export default App;
