import { useEffect, useState } from "react";
import API_URL from "./api";

const panelStyle = {
  background: "#111827",
  border: "1px solid #1f2937",
  borderRadius: 12,
  padding: 16,
  marginTop: 16,
};

const inputStyle = {
  width: "100%",
  marginTop: 8,
  marginBottom: 8,
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #334155",
  background: "#0b1220",
  color: "#fff",
};

const buttonStyle = {
  padding: "10px 14px",
  borderRadius: 8,
  border: "none",
  background: "#2563eb",
  color: "white",
  cursor: "pointer",
};

const ShortsStudio = () => {
  const [topic, setTopic] = useState("");
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("Listo");
  const [showDocs, setShowDocs] = useState(true);
  const [config, setConfig] = useState({
    youtube_refresh_token: "",
    openai_api_key: "",
    tts_api_key: "",
    tts_provider: "openai",
    pexels_api_key: "",
    pixabay_api_key: "",
  });

  const saveConfig = async () => {
    setStatus("Guardando credenciales...");
    await fetch(`${API_URL}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setStatus("Credenciales guardadas correctamente.");
  };

  const randomTopic = async () => {
    setStatus("Generando tema viral...");
    const response = await fetch(`${API_URL}/api/topic/random`, { method: "POST" });
    const data = await response.json();
    setTopic(data.topic);
    setStatus("Tema generado.");
  };

  const createVideo = async () => {
    setStatus("Creando video...");
    const response = await fetch(`${API_URL}/api/video/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    const data = await response.json();
    setJob({ id: data.job_id, status: data.status });
  };

  useEffect(() => {
    if (!job?.id) return;
    const interval = setInterval(async () => {
      const response = await fetch(`${API_URL}/api/video/${job.id}`);
      const data = await response.json();
      setJob(data);
      setStatus(`Estado del proceso: ${data.status}`);
      if (["completed", "failed"].includes(data.status)) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job?.id]);

  const publish = async () => {
    if (!job?.id) return;
    setStatus("Publicando en YouTube...");
    const response = await fetch(`${API_URL}/api/video/${job.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: "private" }),
    });
    const data = await response.json();
    setStatus(`Publicación completada. Video ID: ${data.video_id || "éxito"}`);
  };

  return (
    <div style={{ maxWidth: 940, margin: "0 auto", padding: 24, color: "#fff" }}>
      <h1>YouTube Shorts Auto Publisher</h1>
      <p style={{ color: "#cbd5e1" }}>{status}</p>

      <div style={panelStyle}>
        <button type="button" style={buttonStyle} onClick={() => setShowDocs((prev) => !prev)}>
          {showDocs ? "Ocultar documentación" : "Ver documentación"}
        </button>
        {showDocs && (
          <div style={{ marginTop: 12, lineHeight: 1.5 }}>
            <h2 style={{ marginBottom: 8 }}>Documentación rápida (Español)</h2>
            <p>
              <strong>¿El video lo genera ChatGPT?</strong> No directamente. OpenAI/ChatGPT genera el <strong>tema</strong>, el
              <strong> script</strong>, y los <strong>metadatos</strong> (título/descripcion/hashtags). El archivo MP4 final lo arma el backend
              con <strong>MoviePy + FFmpeg</strong> combinando audio y subtítulos.
            </p>
            <ol>
              <li>Configura tus credenciales (OpenAI, YouTube, opcional TTS).</li>
              <li>Escribe un tema o usa <em>Generar tema aleatorio</em>.</li>
              <li>Presiona <em>Crear video</em> para iniciar el proceso.</li>
              <li>Revisa la vista previa cuando el estado pase a <em>completed</em>.</li>
              <li>Presiona <em>Compartir en YouTube</em> para subirlo.</li>
            </ol>
          </div>
        )}
      </div>

      <div style={panelStyle}>
        <h2>1) Panel de configuración</h2>
        <input
          style={inputStyle}
          placeholder="OpenAI API Key"
          value={config.openai_api_key}
          onChange={(e) => setConfig({ ...config, openai_api_key: e.target.value })}
        />
        <input
          style={inputStyle}
          placeholder="YouTube Refresh/Access Token"
          value={config.youtube_refresh_token}
          onChange={(e) => setConfig({ ...config, youtube_refresh_token: e.target.value })}
        />
        <input
          style={inputStyle}
          placeholder="TTS API Key (opcional)"
          value={config.tts_api_key}
          onChange={(e) => setConfig({ ...config, tts_api_key: e.target.value })}
        />
        <button type="button" style={buttonStyle} onClick={saveConfig}>
          Guardar credenciales
        </button>
      </div>

      <div style={panelStyle}>
        <h2>2) Dashboard principal</h2>
        <input
          style={inputStyle}
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Ingresa un tema"
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
          <button type="button" style={buttonStyle} onClick={randomTopic}>
            Generar tema aleatorio
          </button>
          <button type="button" style={buttonStyle} onClick={createVideo}>
            Crear video
          </button>
          <button type="button" style={buttonStyle} onClick={publish}>
            Compartir en YouTube
          </button>
        </div>

        {job?.video_path && (
          <video controls style={{ width: "100%", marginTop: 16, borderRadius: 12 }}>
            <source src={`${API_URL}/${job.video_path}`} type="video/mp4" />
          </video>
        )}
      </div>
    </div>
  );
};

export default ShortsStudio;
