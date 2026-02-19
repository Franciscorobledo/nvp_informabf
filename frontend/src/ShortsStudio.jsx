import { useEffect, useState } from "react";
import API_URL from "./api";

const ShortsStudio = () => {
  const [topic, setTopic] = useState("");
  const [job, setJob] = useState(null);
  const [status, setStatus] = useState("Ready");
  const [config, setConfig] = useState({
    youtube_refresh_token: "",
    openai_api_key: "",
    tts_api_key: "",
    tts_provider: "openai",
    pexels_api_key: "",
    pixabay_api_key: "",
  });

  const saveConfig = async () => {
    setStatus("Saving credentials...");
    await fetch(`${API_URL}/api/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });
    setStatus("Credentials saved.");
  };

  const randomTopic = async () => {
    setStatus("Generating random topic...");
    const response = await fetch(`${API_URL}/api/topic/random`, { method: "POST" });
    const data = await response.json();
    setTopic(data.topic);
    setStatus("Random topic ready.");
  };

  const createVideo = async () => {
    setStatus("Creating video...");
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
      setStatus(`Job status: ${data.status}`);
      if (["completed", "failed"].includes(data.status)) {
        clearInterval(interval);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [job?.id]);

  const publish = async () => {
    if (!job?.id) return;
    setStatus("Publishing to YouTube...");
    const response = await fetch(`${API_URL}/api/video/${job.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: "private" }),
    });
    const data = await response.json();
    setStatus(`Published video id: ${data.video_id || "success"}`);
  };

  return (
    <div style={{ maxWidth: 840, margin: "0 auto", padding: 24, color: "#fff" }}>
      <h1>YouTube Shorts Auto Publisher</h1>
      <p>{status}</p>

      <h2>Configuration Panel</h2>
      <input placeholder="OpenAI API key" value={config.openai_api_key} onChange={(e) => setConfig({ ...config, openai_api_key: e.target.value })} />
      <input placeholder="YouTube token" value={config.youtube_refresh_token} onChange={(e) => setConfig({ ...config, youtube_refresh_token: e.target.value })} />
      <input placeholder="Optional TTS API key" value={config.tts_api_key} onChange={(e) => setConfig({ ...config, tts_api_key: e.target.value })} />
      <button onClick={saveConfig}>Save Credentials</button>

      <h2>Main Dashboard</h2>
      <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter topic" style={{ width: "100%" }} />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button onClick={randomTopic}>Generate Random Topic</button>
        <button onClick={createVideo}>Create Video</button>
        <button onClick={publish}>Share to YouTube</button>
      </div>

      {job?.video_path && (
        <video controls style={{ width: "100%", marginTop: 16 }}>
          <source src={`${API_URL}/${job.video_path}`} type="video/mp4" />
        </video>
      )}
    </div>
  );
};

export default ShortsStudio;
