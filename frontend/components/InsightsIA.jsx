import React, { useEffect, useMemo, useRef, useState } from "react";

const MessageBubble = ({ message, onFollowUp, onSave }) => {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in`}>
      <div className={`flex items-start gap-3 max-w-[90%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        <span
          className={`mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full shadow-sm border ${
            isUser
              ? "bg-gradient-to-br from-slate-200 to-slate-100 text-slate-700 border-slate-200"
              : "bg-gradient-to-br from-blue-500 to-indigo-500 text-white border-blue-300/60"
          }`}
        >
          {isUser ? "🧑" : "✨"}
        </span>
        <div
          className={`group relative rounded-3xl px-4 py-3 shadow-sm backdrop-blur-sm border transition-all duration-300 ${
            isUser
              ? "bg-slate-100/80 border-slate-200 text-slate-800"
              : "bg-white/80 border-white/40 text-slate-900"
          }`}
        >
          <p className="whitespace-pre-line leading-relaxed text-sm sm:text-[15px]">{message.content}</p>
          {message.series && message.series.length > 1 && (
            <InsightChartMini series={message.series} title={message.seriesLabel} />
          )}
          <div className="mt-3 flex flex-wrap gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            {!isUser && (
              <button
                onClick={() => onSave(message)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm hover:shadow-md"
              >
                ➕ Agregar al Reporte Ejecutivo
              </button>
            )}
            {message.followUps?.map((follow, idx) => (
              <button
                key={`${follow}-${idx}`}
                onClick={() => onFollowUp(follow)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                ↩️ {follow}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SuggestedChips = ({ suggestions, onSelect, loading }) => (
  <div className="flex flex-wrap gap-2">
    {suggestions.map((suggestion, idx) => (
      <button
        key={`${suggestion}-${idx}`}
        type="button"
        onClick={() => onSelect(suggestion)}
        disabled={loading}
        className={`group relative overflow-hidden rounded-full px-4 py-2 text-xs sm:text-sm font-semibold shadow-sm transition-all duration-300 backdrop-blur bg-white/70 border border-white/40 text-slate-800 hover:-translate-y-0.5 hover:shadow-lg ${
          loading ? "opacity-50 cursor-wait" : ""
        }`}
      >
        <span className="absolute inset-0 bg-gradient-to-r from-blue-50/60 via-indigo-50/70 to-blue-100/60 opacity-0 group-hover:opacity-100 transition-opacity" />
        <span className="relative flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" />
          {suggestion}
        </span>
      </button>
    ))}
  </div>
);

const InsightChartMini = ({ series, title }) => {
  const max = Math.max(...series);
  const min = Math.min(...series);
  const normalized = series.map((value) => ((value - min) / (max - min || 1)) * 100);
  const points = normalized
    .map((value, idx) => {
      const x = (idx / (normalized.length - 1 || 1)) * 100;
      const y = 100 - value;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="mt-3 rounded-2xl border border-white/50 bg-gradient-to-r from-indigo-50/70 via-white/60 to-blue-50/70 px-3 py-2 shadow-inner">
      <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
        <span className="font-semibold text-slate-700">{title || "Mini tendencia"}</span>
        <span className="text-blue-600 font-semibold">{series[series.length - 1].toLocaleString()}</span>
      </div>
      <svg viewBox="0 0 100 40" className="w-full h-16 overflow-visible">
        <defs>
          <linearGradient id="spark" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.15" />
          </linearGradient>
        </defs>
        <polyline
          fill="url(#spark)"
          stroke="none"
          points={`0,40 ${points} 100,40`}
          className="animate-fade-in"
        />
        <polyline
          fill="none"
          stroke="#4f46e5"
          strokeWidth="2.5"
          strokeLinecap="round"
          points={points}
          className="drop-shadow-[0_4px_10px_rgba(79,70,229,0.25)]"
        />
      </svg>
    </div>
  );
};

const LoadingSkeleton = () => (
  <div className="flex gap-3 animate-pulse">
    <span className="mt-1 inline-flex h-8 w-8 rounded-full bg-gradient-to-br from-blue-500/60 to-indigo-500/60" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-3/4 rounded-full bg-white/60" />
      <div className="h-4 w-1/2 rounded-full bg-white/50" />
    </div>
  </div>
);

const ContextPills = ({ memory }) => (
  <div className="flex flex-wrap gap-2">
    {memory.map((item, idx) => (
      <span
        key={`${item}-${idx}`}
        className="inline-flex items-center gap-2 rounded-full bg-white/60 border border-white/30 px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500" />
        {item}
      </span>
    ))}
  </div>
);

const InsightsIA = ({ datasetId, datasetName }) => {
  const [messages, setMessages] = useState([
    {
      role: "system",
      content:
        "Soy tu copiloto de inteligencia de negocio. Puedo generar recomendaciones, detectar riesgos y priorizar acciones basándome en tu dataset.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [datasetStatus, setDatasetStatus] = useState(datasetId ? "checking" : "missing");
  const [datasetNote, setDatasetNote] = useState("");
  const [resolvedDatasetName, setResolvedDatasetName] = useState(datasetName || "");
  const [columns, setColumns] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [memory, setMemory] = useState([
    "Ventas, clientes y producto",
    "Seguimiento de KPIs clave",
  ]);
  const [savedInsights, setSavedInsights] = useState([]);
  const scrollRef = useRef(null);
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:1000";
  const hasDataset = datasetStatus === "ready";

  useEffect(() => {
    setResolvedDatasetName(datasetName || "");
  }, [datasetName]);

  const baseSuggestions = useMemo(
    () => [
      "¿Qué palancas de crecimiento priorizamos este trimestre?",
      "Identifica riesgos de churn y su impacto en ingresos.",
      "Genera un mini plan comercial con quick wins.",
      "Dame 3 focos de eficiencia operativa con este archivo.",
    ],
    []
  );

  const buildDynamicSuggestions = (cols = []) => {
    const lowered = cols.map((c) => c.toLowerCase());
    const hasVentas = lowered.some((c) => c.includes("venta"));
    const hasProducto = lowered.some((c) => c.includes("producto"));
    const hasCliente = lowered.some((c) => c.includes("cliente"));
    const hasFecha = lowered.some((c) => c.includes("fecha") || c.includes("date"));

    const dynamic = [];
    if (hasVentas) dynamic.push("¿Dónde se concentra el 20% de ventas y cómo escalarlo?");
    if (hasProducto) dynamic.push("Top productos por margen y acciones sugeridas.");
    if (hasCliente) dynamic.push("Segmenta clientes por valor y riesgo de abandono.");
    if (hasFecha) dynamic.push("Muéstrame tendencias mensuales y estacionalidad clave.");

    return [...dynamic, ...baseSuggestions].slice(0, 8);
  };

  useEffect(() => {
    const merged = buildDynamicSuggestions(columns);
    setSuggestions(merged);
  }, [columns, baseSuggestions]);

  const statusClasses = useMemo(() => {
    if (datasetStatus === "ready")
      return "bg-emerald-100/70 text-emerald-800 ring-emerald-200/80 dark:bg-emerald-900/30 dark:text-emerald-50 dark:ring-emerald-700/50";
    if (datasetStatus === "checking" || datasetStatus === "pending")
      return "bg-blue-100/70 text-blue-800 ring-blue-200/80 dark:bg-blue-900/40 dark:text-blue-50 dark:ring-blue-800/50";
    if (datasetStatus === "error")
      return "bg-amber-100/80 text-amber-800 ring-amber-200/70 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700/60";
    return "bg-amber-100/80 text-amber-800 ring-amber-200/70 dark:bg-amber-900/50 dark:text-amber-100 dark:ring-amber-700/60";
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
        if (Array.isArray(data?.metadata?.columns)) {
          setColumns(data.metadata.columns);
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

  const generateFollowUps = (content) => {
    const cues = [];
    const lowered = content.toLowerCase();
    if (lowered.includes("venta")) cues.push("¿Qué pasa si duplicamos inversión en el top 2 canales?");
    if (lowered.includes("cliente")) cues.push("¿Cómo retenemos al segmento con mayor margen?");
    if (lowered.includes("costo")) cues.push("Dame acciones para reducir costos sin afectar NPS.");
    if (cues.length < 2 && columns.length) cues.push("Profundiza con un desglose por columna clave.");
    cues.push("Proponme el siguiente paso en 30 días.");
    return cues.slice(0, 3);
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

      const followUps = generateFollowUps(aiReply);
      const insightSeries =
        (Array.isArray(data?.series) && data.series.filter((v) => typeof v === "number")) ||
        (Array.isArray(data?.chart?.series) && data.chart.series.filter((v) => typeof v === "number")) ||
        null;

      appendMessage({
        role: "system",
        content: aiReply,
        followUps,
        series: insightSeries || undefined,
        seriesLabel: data?.seriesLabel || data?.chart?.label || undefined,
      });

      setMemory((prev) => {
        const updated = [userMessage, aiReply, ...prev].slice(0, 6);
        return Array.from(new Set(updated));
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

  const handleSaveInsight = (message) => {
    setSavedInsights((prev) => {
      if (prev.find((item) => item.content === message.content)) return prev;
      return [...prev, message];
    });
  };

  const handleClearChat = () => {
    setMessages([
      {
        role: "system",
        content:
          "Soy tu copiloto de inteligencia de negocio. Puedo generar recomendaciones, detectar riesgos y priorizar acciones basándome en tu dataset.",
      },
    ]);
  };

  const canSend = useMemo(
    () => hasDataset && Boolean(input.trim()) && !loading,
    [hasDataset, input, loading]
  );

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600/20 via-slate-900/40 to-blue-700/10 p-[1px] shadow-2xl">
      <div className="relative rounded-[22px] bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-800/80 p-6 sm:p-7 space-y-6">
        <div className="absolute inset-0 pointer-events-none rounded-[22px] bg-gradient-to-br from-white/10 via-indigo-500/5 to-blue-900/10" />
        <div className="relative flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/80 border border-white/40 px-3 py-1 shadow-sm text-xs font-semibold text-indigo-700">
                <span className="h-2 w-2 rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 animate-pulse" />
                Copiloto Insights IA
              </div>
              <h4 className="text-2xl font-semibold text-slate-900 dark:text-white">Asistente de decisiones premium</h4>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Conversa con tu dataset, guarda hallazgos y visualiza micro-tendencias sin perder contexto.
              </p>
            </div>
            <div className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold shadow-sm ring-1 ${statusClasses}`}>
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-current" aria-hidden="true" />
              {statusLabel}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white/70 dark:bg-slate-900/60 border border-white/40 dark:border-slate-800/60 px-4 py-3 text-xs sm:text-sm text-slate-800 dark:text-slate-100 shadow-inner">
            <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-blue-500/20 to-indigo-500/30 text-blue-900 dark:text-blue-100 px-2.5 py-1 font-semibold">
              ⚡ Contexto activo
            </span>
            <span className="font-semibold text-slate-900 dark:text-white">{contextMessage}</span>
          </div>
          {datasetNote && (
            <p className="text-xs text-amber-700 dark:text-amber-200 flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-current" aria-hidden="true" />
              {datasetNote}
            </p>
          )}

          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="space-y-2">
              <p className="text-[13px] uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300 font-semibold">Sugerencias dinámicas</p>
              <SuggestedChips suggestions={suggestions} onSelect={handleQuickQuestion} loading={loading} />
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <p className="text-[13px] text-slate-500 dark:text-slate-300">Memoria temporal</p>
              <ContextPills memory={memory} />
            </div>
          </div>

          <div
            ref={scrollRef}
            className="relative h-80 sm:h-96 overflow-y-auto rounded-[18px] border border-white/50 dark:border-slate-800 bg-gradient-to-br from-indigo-50/70 via-white/80 to-blue-50/60 dark:from-slate-900/60 dark:via-slate-900/70 dark:to-slate-950/80 p-4 space-y-3 shadow-inner"
          >
            <div className="absolute inset-0 pointer-events-none rounded-[18px] bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_40%),radial-gradient(circle_at_bottom_right,rgba(45,212,191,0.08),transparent_35%)]" />
            <div className="relative space-y-3">
              {messages.map((msg, idx) => (
                <MessageBubble
                  key={`${msg.role}-${idx}`}
                  message={msg}
                  onFollowUp={handleQuickQuestion}
                  onSave={handleSaveInsight}
                />
              ))}

              {loading && (
                <div className="rounded-2xl border border-white/60 bg-white/70 dark:bg-slate-900/70 p-3 shadow-sm">
                  <LoadingSkeleton />
                </div>
              )}

              {!hasDataset && (
                <p className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50/80 dark:bg-amber-900/30 border border-amber-200/80 dark:border-amber-700/50 rounded-xl px-3 py-2">
                  {datasetNote ||
                    "Carga un archivo para habilitar el chat y obtener recomendaciones sobre tu dataset. El módulo recordará tu último archivo analizado automáticamente."}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Preguntas de seguimiento soportadas</span>
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-semibold bg-white/70 border border-white/50 text-slate-600 hover:text-indigo-600 hover:border-indigo-200"
                >
                  🧹 Limpiar chat
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500/10 via-blue-500/10 to-teal-400/10 blur" />
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ej: ¿Qué productos debo empujar más? Pide tendencias, riesgos o quick wins."
                  className="relative flex-1 w-full rounded-full border border-white/60 dark:border-slate-700 bg-white/90 dark:bg-slate-900/80 px-5 py-4 text-sm sm:text-base shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-300 min-h-[60px]"
                  rows={2}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              className={`sm:w-36 inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm sm:text-base font-semibold transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-blue-200 ${
                canSend
                  ? "bg-gradient-to-r from-indigo-500 via-blue-600 to-cyan-400 text-white hover:scale-[1.02] hover:shadow-xl"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-white animate-ping" />
                  Pensando…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Enviar
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </span>
                </span>
              )}
            </button>
          </div>

          {Boolean(savedInsights.length) && (
            <div className="rounded-2xl border border-emerald-100/70 dark:border-emerald-700/40 bg-emerald-50/70 dark:bg-emerald-900/20 p-4 flex items-center justify-between text-sm text-emerald-900 dark:text-emerald-100">
              <div>
                <p className="font-semibold">Agregaste {savedInsights.length} insight(s) al reporte ejecutivo.</p>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">Se conservarán durante esta sesión.</p>
              </div>
              <div className="flex -space-x-2">
                {savedInsights.slice(0, 3).map((item, idx) => (
                  <span
                    key={`${item.content}-${idx}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-teal-400 text-white text-xs ring-2 ring-white/70"
                  >
                    IA
                  </span>
                ))}
                {savedInsights.length > 3 && (
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-emerald-800 text-xs ring-2 ring-emerald-200">
                    +{savedInsights.length - 3}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightsIA;
