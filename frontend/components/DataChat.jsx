import React, { useMemo, useRef, useState } from "react";

const DataChat = ({ datasetId }) => {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "Soy tu asesor inteligente de negocio. Pregunta cómo optimizar ventas, marketing, operaciones o rentabilidad basándome en tu archivo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";

  const quickQuestions = useMemo(
    () => [
      "¿Qué productos debo empujar más este mes?",
      "Dame 3 acciones para aumentar margen con estos datos.",
      "¿Qué clientes están en riesgo de churn y qué hago al respecto?",
      "¿Cómo puedo reducir costos operativos en 30 días?",
      "Genera un plan de campañas con el top de oportunidades.",
    ],
    []
  );

  const canSend = useMemo(
    () => Boolean(datasetId) && Boolean(input.trim()) && !loading,
    [datasetId, input, loading]
  );

  const appendMessage = (newMessage) => {
    setMessages((prev) => {
      const next = [...prev, newMessage];
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
      return next;
    });
  };

  const handleSend = async (overrideMessage) => {
    const textToSend = overrideMessage ?? input;
    if (!textToSend || !textToSend.trim() || loading || !datasetId) return;

    const userMessage = textToSend.trim();
    appendMessage({ role: "user", content: userMessage });
    setInput("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/datasets/${datasetId}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ datasetId, message: userMessage }),
      });

      if (!res.ok) {
        const detail = await res.text();
        throw new Error(detail || "No se pudo obtener la respuesta de la IA.");
      }

      const data = await res.json();
      const aiReply =
        data?.reply ||
        data?.message ||
        data?.response ||
        "Aquí tienes algunas recomendaciones basadas en el archivo analizado.";

      appendMessage({
        role: "system",
        content: aiReply,
      });
    } catch (error) {
      appendMessage({
        role: "system",
        content:
          "No pudimos obtener recomendaciones en este momento. Intenta de nuevo o verifica que el dataset esté disponible.",
      });
      console.error("Error al consultar el chat de datos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg p-6 space-y-4">
      <div className="space-y-1">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Chat con tus datos</h4>
        <p className="text-sm text-gray-600 dark:text-slate-300">
          Haz preguntas y recibe recomendaciones accionables basadas en este archivo.
        </p>
      </div>

      <div className="rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/50 dark:bg-slate-800/60 p-3 text-sm text-blue-900 dark:text-slate-100">
        <p className="font-semibold text-blue-800 dark:text-blue-100 mb-2">Preguntas sugeridas</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((question, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(question)}
              disabled={loading || !datasetId}
              className={`text-left rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 ${
                loading || !datasetId
                  ? "bg-white/50 dark:bg-slate-900/60 text-gray-400 cursor-not-allowed"
                  : "bg-white dark:bg-slate-900 text-blue-800 dark:text-slate-100 hover:bg-blue-100 dark:hover:bg-slate-800"
              }`}
            >
              {question}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto rounded-xl border border-gray-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 p-4 space-y-3"
      >
        {messages.map((msg, idx) => (
          <div
            key={`${msg.role}-${idx}`}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-300">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden="true" />
            Pensando…
          </div>
        )}

        {!datasetId && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-600 rounded-xl px-3 py-2">
            Carga un archivo para habilitar el chat y obtener recomendaciones sobre tu dataset.
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ej: ¿Qué decisiones puedo tomar con estos datos? ¿Qué productos debería empujar más?"
          className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[56px]"
          rows={2}
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          className={`sm:w-32 inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition shadow-md focus:outline-none focus:ring-4 focus:ring-blue-200 ${
            canSend
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-200 text-gray-500 cursor-not-allowed"
          }`}
        >
          {loading ? "Pensando…" : "Enviar"}
        </button>
      </div>
    </div>
  );
};

export default DataChat;
