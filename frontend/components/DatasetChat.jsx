import React, { useState } from "react";
import API_URL from "../src/api";

const DatasetChat = ({ className }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const appendMessage = (message) => {
    setMessages((prev) => [...prev, message]);
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    appendMessage({ role: "user", content: userMessage });
    setInput("");
    setLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/data/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "No se pudo obtener la respuesta de la IA.");
      }

      const data = await res.json();
      appendMessage({ role: "assistant", content: data.reply || data.message || "Aquí tienes una respuesta basada en tus datos." });
    } catch (err) {
      console.error("Error en chat de dataset", err);
      setError(err.message || "No pudimos responder en este momento.");
      appendMessage({ role: "assistant", content: "No pude responder. Intenta nuevamente en unos segundos." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-sm ${className || ""}`}>
      <div className="p-4 border-b border-gray-100 dark:border-slate-800">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">💬 Chat rápido sobre tu dataset</h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Envía preguntas cortas y usa el dataset cargado recientemente como contexto.
        </p>
      </div>

      <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-slate-400">No hay mensajes aún. Pregunta algo como "¿Cuál es el producto con más ventas?"</p>
        )}
        {messages.map((msg, idx) => (
          <div key={`msg-${idx}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`rounded-2xl px-3 py-2 text-sm max-w-[85%] ${
                msg.role === "user"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {error && <div className="px-4 pb-2 text-xs text-red-600">{error}</div>}

      <div className="p-4 border-t border-gray-100 dark:border-slate-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          placeholder="Escribe tu pregunta..."
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={loading}
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all duration-200 ${
            loading
              ? "bg-gray-200 dark:bg-slate-800 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {loading ? "Enviando..." : "Enviar"}
        </button>
      </div>
    </div>
  );
};

export default DatasetChat;
