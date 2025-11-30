import React, { useEffect, useMemo, useRef, useState } from "react";

const DataChat = ({ datasetId, datasetName }) => {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "Soy tu asesor inteligente de negocio. Pregunta cómo optimizar ventas, marketing, operaciones o rentabilidad basándome en tu archivo.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState(datasetId ? "checking" : "missing");
  const [datasetNote, setDatasetNote] = useState("");
  const [resolvedDatasetName, setResolvedDatasetName] = useState(datasetName || "");
  const scrollRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";
  const hasDataset = datasetStatus === "ready";

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
    () => hasDataset && Boolean(input.trim()) && !loading,
    [hasDataset, input, loading]
  );

  const statusClasses = useMemo(() => {
    if (datasetStatus === "ready")
      return "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-100 dark:ring-emerald-800";
    if (datasetStatus === "checking" || datasetStatus === "pending")
      return "bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:ring-blue-800";
    if (datasetStatus === "error")
      return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700";
    return "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-700";
  }, [datasetStatus]);

  const statusLabel = useMemo(() => {
    if (datasetStatus === "ready") return "Dataset listo para conversar";
    if (datasetStatus === "checking") return "Validando dataset…";
    if (datasetStatus === "pending") return "Dataset en preparación";
    if (datasetStatus === "error") return "No pudimos validar el dataset";
    return "Sube un archivo para habilitar";
  }, [datasetStatus]);

  const contextMessage = hasDataset
    ? resolvedDatasetName || "Dataset cargado"
    : datasetNote || "Conecta tu dataset desde el módulo \"Carga y análisis\" para activar el chat.";

  useEffect(() => {
    setResolvedDatasetName(datasetName || "");
  }, [datasetName]);

  useEffect(() => {
    let cancelled = false;
    let retryTimer;

    if (!datasetId) {
      setDatasetStatus("missing");
      setDatasetNote("Carga un archivo o la demo para desbloquear el chat de recomendaciones.");
      return () => {};
    }

    if (datasetStatus === "ready" || datasetStatus === "missing") return () => {};

    const token = localStorage.getItem("token");
    const checkContext = async () => {
      setDatasetStatus((prev) => (prev === "pending" ? "pending" : "checking"));
      if (!datasetNote) setDatasetNote("Validando dataset…");
      try {
        const res = await fetch(`${API_URL}/datasets/${datasetId}/context`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        if (cancelled) return;

        if (res.status === 404) {
          setDatasetStatus("pending");
          setDatasetNote("Estamos preparando el dataset para el chat. Si ya terminó el análisis, vuelve a cargar el archivo o la demo.");
          return;
        }

        if (!res.ok) {
          throw new Error("No se pudo validar el dataset para el chat.");
        }

        const data = await res.json();
        if (cancelled) return;

        setDatasetStatus("ready");
        setDatasetNote("");
        if (!resolvedDatasetName && data?.metadata?.file_name) {
          setResolvedDatasetName(data.metadata.file_name);
        }
      } catch (error) {
        if (cancelled) return;
        setDatasetStatus("error");
        setDatasetNote("No pudimos validar el dataset. Intenta recargar el módulo o reanalizar el archivo.");
        console.error("Error validando dataset para chat:", error);
      }
    };

    if (datasetStatus === "pending") {
      retryTimer = setTimeout(checkContext, 2500);
    } else {
      checkContext();
    }

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [API_URL, datasetId, datasetStatus, datasetNote, resolvedDatasetName]);

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
    if (!textToSend || !textToSend.trim() || loading || !hasDataset) return;

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

      if (res.status === 404) {
        setDatasetStatus("missing");
        setDatasetNote("No encontramos el dataset en el servidor. Vuelve a cargar tu archivo o la demo.");
        appendMessage({
          role: "system",
          content:
            "No encontramos tu dataset en el servidor. Vuelve a cargar el archivo o la demo para continuar la conversación.",
        });
        return;
      }

      if (!res.ok) {
        const detail = await res.text();
        setDatasetStatus("error");
        setDatasetNote("El chat no pudo responder. Reintenta en unos segundos o recarga el análisis.");
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

  const handleQuickQuestion = (question) => {
    setInput(question);
    if (hasDataset && !loading) {
      handleSend(question);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-br from-white via-slate-50 to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 shadow-xl p-6 space-y-5">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Chat con tus datos</h4>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Haz preguntas y recibe recomendaciones accionables basadas en tu último archivo cargado.
            </p>
          </div>
          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm ring-1 ${statusClasses}`}
          >
            <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
            {statusLabel}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-gray-100 dark:border-slate-800 px-4 py-3 text-xs text-gray-700 dark:text-slate-200 shadow-inner">
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-100 px-2.5 py-1 font-semibold">
            ⚡ Contexto activo
          </span>
          <span className="font-semibold text-gray-900 dark:text-white">{contextMessage}</span>
        </div>
        {datasetNote && (
          <p className="text-xs text-amber-700 dark:text-amber-200 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
            {datasetNote}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-blue-100 dark:border-slate-800 bg-blue-50/50 dark:bg-slate-800/60 p-3 text-sm text-blue-900 dark:text-slate-100">
        <p className="font-semibold text-blue-800 dark:text-blue-100 mb-2">Preguntas sugeridas</p>
        <div className="flex flex-wrap gap-2">
          {quickQuestions.map((question, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleQuickQuestion(question)}
              disabled={loading}
              className={`text-left rounded-lg px-3 py-2 text-xs font-semibold shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-400 ${
                loading
                  ? "bg-white/50 dark:bg-slate-900/60 text-gray-400 cursor-wait"
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

        {!hasDataset && (
          <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-600 rounded-xl px-3 py-2">
            {datasetNote ||
              "Carga un archivo para habilitar el chat y obtener recomendaciones sobre tu dataset. El módulo recordará tu último archivo analizado automáticamente."}
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
