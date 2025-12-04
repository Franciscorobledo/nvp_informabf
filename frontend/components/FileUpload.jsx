import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import API_URL from "../src/api";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import VisualizationExplorer from "./VisualizationExplorer";
import AppButton from "./AppButton";
import LoadingBar from "./LoadingBar";
import focusOptions from "./focusOptions";
import InsightsIA from "./InsightsIA";

const FileUpload = ({ onDataReceived, onUnauthorized, onNavigateModule }) => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [activeTab, setActiveTab] = useState("graficos");
  const [downloading, setDownloading] = useState(false);
  const [aiCharts, setAiCharts] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState("todos");
  const [uploadMode, setUploadMode] = useState("local");
  const [drivePickerReady, setDrivePickerReady] = useState(false);
  const [selectedDriveFileName, setSelectedDriveFileName] = useState("");
  const [driveLoading, setDriveLoading] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const [emailFeedback, setEmailFeedback] = useState("");
  const [jobId, setJobId] = useState(null);
  const [displayProgress, setDisplayProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState("cargando");
  const [preAnalysis, setPreAnalysis] = useState(null);
  const [polling, setPolling] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [demoMetadata, setDemoMetadata] = useState(null);
  const [analysisError, setAnalysisError] = useState("");
  const [resultNotice, setResultNotice] = useState("");
  const [galleryMode, setGalleryMode] = useState("static");
  const [interactiveLimit, setInteractiveLimit] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [meliAccounts, setMeliAccounts] = useState([]);
  const [selectedMeliAccount, setSelectedMeliAccount] = useState("");
  const [meliDataset, setMeliDataset] = useState("orders");
  const [meliLoading, setMeliLoading] = useState(false);
  const [meliError, setMeliError] = useState("");
  const [persistedDatasetId, setPersistedDatasetId] = useState(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("lastDatasetId");
  });
  const [persistedDatasetName, setPersistedDatasetName] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("lastDatasetName") || "";
  });
  const filterSelectRef = useRef(null);

  const datasetId =
    analysis?.datasetId || analysis?.dataset_id || jobId || persistedDatasetId;
  const datasetName =
    analysis?.metadata?.file_name || analysis?.file_name || persistedDatasetName;

  const goToMovieModule = () => onNavigateModule?.("movie");
  const goToCompareModule = () => onNavigateModule?.("compare");

  const tokenClientRef = useRef(null);
  const fileInputRef = useRef(null);
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY;

  const persistDatasetMeta = (id, name) => {
    if (!id) return;
    setPersistedDatasetId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem("lastDatasetId", id);
    }
    if (name) {
      setPersistedDatasetName(name);
      if (typeof window !== "undefined") {
        localStorage.setItem("lastDatasetName", name);
      }
    }
  };

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        existingScript.addEventListener("load", resolve);
        existingScript.addEventListener("error", reject);
        if (
          existingScript.dataset.loaded ||
          existingScript.readyState === "complete"
        )
          return resolve();
      }

      const script = document.createElement("script");
      script.src = src;
      script.async = true;
      script.onload = () => {
        script.dataset.loaded = "true";
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });

  useEffect(() => {
    let cancelled = false;

    const initGoogleApis = async () => {
      try {
        await loadScript("https://accounts.google.com/gsi/client");
        await loadScript("https://apis.google.com/js/api.js");

        await new Promise((resolve, reject) => {
          window?.gapi?.load("client:picker", {
            callback: resolve,
            onerror: () => reject(new Error("No se pudo cargar Google API")),
          });
        });

        if (!cancelled) setDrivePickerReady(true);
      } catch (error) {
        console.error("Error al inicializar Google Drive Picker:", error);
      }
    };

    initGoogleApis();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!drivePickerReady || !googleClientId || !window.google?.accounts?.oauth2)
      return;

    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: googleClientId,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: () => { },
    });
  }, [drivePickerReady, googleClientId]);

  useEffect(() => {
    const fetchMeliAccounts = async () => {
      const token = localStorage.getItem("token");
      if (!token) return;
      try {
        const res = await fetch(`${API_URL}/mercadolibre/credentials`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 401 || res.status === 403) {
          onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        setMeliAccounts(data || []);
        if (data?.length && !selectedMeliAccount) {
          setSelectedMeliAccount(String(data[0].id));
        }
      } catch (error) {
        console.error("No se pudieron cargar las cuentas de MercadoLibre", error);
      }
    };

    fetchMeliAccounts();
  }, []);

  useEffect(() => {
    if (!jobId || !polling) return;
    const token = localStorage.getItem("token");
    if (!token) {
      setPolling(false);
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    const apiBase = API_URL;
    let cancelled = false;

    const fetchStatus = async () => {
      try {
        const res = await fetch(`${apiBase}/analyze/status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          if ([401, 403].includes(res.status)) {
            onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
            setPolling(false);
            setIsAnalyzing(false);
            return;
          }
          const msg = await res.text();
          throw new Error(msg || "No se pudo consultar el estado del análisis.");
        }

        const data = await res.json();
        if (cancelled) return;

        setAnalysisStep(data.step || "cargando");
        setStatusMessage(getStepLabel(data.step));

        if (data.done) {
          setDisplayProgress(100);
          setPolling(false);
          setIsAnalyzing(false);
          if (data.error) {
            setAnalysisError(data.error || "No se pudo completar el análisis.");
            setResultNotice(
              "Revisa el formato del archivo. Si el problema persiste, intenta con el CSV/Excel original o usa la demo."
            );
            return;
          }
          if (data.result) {
            setAnalysis(data.result);
            setAiCharts(generateAiCharts(data.result.sample));
            const resolvedDatasetId =
              data.result.datasetId || data.result.dataset_id || jobId;
            const resolvedFileName =
              data.result.metadata?.file_name || data.result.file_name;
            persistDatasetMeta(resolvedDatasetId, resolvedFileName);
            onDataReceived?.(data.result);
            setResultNotice("Análisis listo. Explora los KPIs, gráficos e insights generados.");
          }
        }
      } catch (error) {
        console.error("Error consultando estado del análisis:", error);
        if (!cancelled) {
          setStatusMessage("No se pudo consultar el progreso.");
          setAnalysisError("No pudimos actualizar el estado. Reintenta o usa la demo.");
        }
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [jobId, polling, onUnauthorized, onDataReceived]);

  useEffect(() => {
    if (!isAnalyzing) return;

    setDisplayProgress(0);
    const interval = setInterval(() => {
      setDisplayProgress((prev) => {
        if (prev >= 100) return 100;
        return prev + 1;
      });
    }, 120);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  const categoryKeywords = {
    ventas: [
      "venta",
      "ventas",
      "sale",
      "sales",
      "ingreso",
      "ingresos",
      "revenue",
      "facturacion",
    ],
    stock: ["stock", "inventario", "existencia", "bodega", "almacen"],
    producto: ["producto", "sku", "item", "referencia", "catalogo"],
    reportes: ["reporte", "report", "analisis", "analysis"],
    auditoria: [
      "auditoria",
      "control",
      "riesgo",
      "compliance",
      "fraude",
      "hallazgo",
      "segregacion",
      "acceso",
      "log",
      "trazabilidad",
    ],
  };

  const stepLabels = {
    cargando: "Leyendo archivo…",
    pre_analisis: "Generando pre-análisis…",
    analisis_completo: "Analizando dataset completo…",
    ia: "Generando insights de IA…",
    reporte: "Preparando reportes…",
    error: "Ocurrió un error en el análisis",
  };

  const getStepLabel = (step) => stepLabels[step] || "Procesando…";

  const matchesCategory = (text, category) => {
    if (category === "todos") return true;
    const normalized = String(text || "").toLowerCase();
    const keywords = categoryKeywords[category] || [];
    return keywords.some((keyword) => normalized.includes(keyword));
  };

  const filterGraphsByCategory = (graphs = []) => {
    if (categoryFilter === "todos") return graphs;
    const filtered = graphs.filter((chart) =>
      matchesCategory(chart?.column || chart?.title || chart?.type, categoryFilter)
    );
    return filtered.length ? filtered : graphs;
  };

  const filterInsights = (text) => {
    if (categoryFilter === "todos" || !text) return text;
    const sentences = text.split(/(?<=[.!?])\s+/);
    const filtered = sentences.filter((sentence) =>
      matchesCategory(sentence, categoryFilter)
    );
    return filtered.length ? filtered.join(" ") : text;
  };

  const truncateText = (text = "", limit = 280) => {
    if (!text) return "";
    if (text.length <= limit) return text;
    return `${text.slice(0, limit).trim()}…`;
  };

  const buildInteractiveChart = (column) => {
    if (!column || !analysis?.sample?.length) return null;

    const values = analysis.sample.map((row) => row?.[column]);
    const numericValues = values.filter((value) =>
      typeof value === "number" && Number.isFinite(value)
    );

    if (numericValues.length >= 2) {
      return {
        type: "line",
        title: `Tendencia de ${column}`,
        column,
        xKey: "name",
        yKey: "value",
        data: numericValues.map((value, index) => ({
          name: `Fila ${index + 1}`,
          value,
        })),
      };
    }

    const counts = values.reduce((acc, value) => {
      const key = (value ?? "Sin dato").toString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const data = Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    if (!data.length) return null;

    return {
      type: "bar",
      title: `Distribución de ${column}`,
      column,
      xKey: "name",
      yKey: "value",
      data,
    };
  };

  const interactiveGalleryCharts = useMemo(() => {
    if (!analysis?.graphs?.length) return [];

    return analysis.graphs
      .map((chart) => buildInteractiveChart(chart.column))
      .filter(Boolean);
  }, [analysis]);

  const buildSuggestedActions = () => {
    if (!analysis) return [];

    const pushUnique = (list, value) => {
      if (value && !list.includes(value)) list.push(value);
    };

    const focusKey = categoryFilter === "todos" ? "general" : categoryFilter;

    const focusActions = {
      ventas: [
        "Planifica una campaña específica para los segmentos con mayor crecimiento y mide el uplift semanal.",
        "Revisa precios y disponibilidad de los productos top para evitar quiebres durante promociones.",
        "Activa alertas cuando las ventas caigan frente a la semana anterior y define un responsable por línea.",
      ],
      stock: [
        "Prioriza reposiciones para los SKU con mayor rotación y define stock de seguridad por tienda o canal.",
        "Identifica excesos de inventario y prepara un plan de liquidación o bundles para liberar bodegas.",
        "Automatiza alertas de stock mínimo en los productos críticos y confirma con logística su cumplimiento.",
      ],
      producto: [
        "Revisa la conversión y satisfacción de las referencias con peor desempeño y define mejoras rápidas.",
        "Impulsa bundles o cross-selling usando los productos que aparecen con mayor frecuencia en las ventas.",
        "Valida consistencia de atributos (precio, categoría, código) antes del siguiente corte de datos.",
      ],
      reportes: [
        "Prepara un resumen ejecutivo con los hallazgos clave y compártelo con los stakeholders esta semana.",
        "Crea un tablero recurrente con los KPIs destacados y agenda revisión quincenal con los responsables.",
        "Documenta supuestos y limitaciones del dataset para que el equipo los tenga presentes en decisiones.",
      ],
      auditoria: [
        "Monitorea la ejecución de controles críticos (plan vs. ejecutado) y documenta las excepciones con evidencias.",
        "Revisa accesos y segregación de funciones en procesos sensibles y genera alertas por accesos no revisados.",
        "Da seguimiento a hallazgos abiertos: aging, reincidencias y tiempos de remediación por responsable.",
      ],
      general: [
        "Comparte los hallazgos principales con el equipo y acuerda responsables y fechas de seguimiento.",
        "Crea un tablero semanal con los KPIs críticos y revisa variaciones frente al período anterior.",
        "Define un ciclo de retroalimentación: mide impacto de las acciones y ajusta en la siguiente iteración.",
      ],
    };

    const actions = [];

    const filteredCharts = filterGraphsByCategory(analysis.graphs || []);
    const [firstChart, secondChart] = filteredCharts;

    if (firstChart?.column || firstChart?.title) {
      pushUnique(
        actions,
        `Monitorea el indicador "${firstChart.column || firstChart.title}" en un tablero semanal y asigna un responsable.`,
      );
    }

    if (secondChart?.column || secondChart?.title) {
      pushUnique(
        actions,
        `Profundiza en el gráfico "${secondChart.column || secondChart.title}" para explicar variaciones y documenta el plan de acción.`,
      );
    }

    const insightSentences = (filterInsights(analysis.ai_summary) || "")
      .split(/(?<=[.!?])\s+/)
      .map((sentence) => sentence.replace(/^[-•\d\s]+/, "").trim())
      .filter(Boolean);

    insightSentences.slice(0, 2).forEach((sentence) => {
      pushUnique(actions, `Convierte este hallazgo en tarea concreta: ${sentence}`);
    });

    (focusActions[focusKey] || focusActions.general).forEach((action) =>
      pushUnique(actions, action)
    );

    return actions.slice(0, 4);
  };

  const generateAiCharts = (sample = []) => {
    if (!Array.isArray(sample) || sample.length === 0) return [];

    const rows = sample.slice(0, 50);
    const keys = Object.keys(rows[0] || {});
    const numericKeys = keys.filter((key) =>
      rows.some((row) => typeof row?.[key] === "number" && Number.isFinite(row[key]))
    );
    const stringKeys = keys.filter((key) => rows.some((row) => typeof row?.[key] === "string"));

    const charts = [];

    if (numericKeys.length && stringKeys.length) {
      const [categoryKey] = stringKeys;
      const [metricKey] = numericKeys;

      const grouped = rows.reduce((acc, row) => {
        const category = row?.[categoryKey] ?? "Sin dato";
        const value = Number(row?.[metricKey]) || 0;
        acc[category] = (acc[category] || 0) + value;
        return acc;
      }, {});

      const data = Object.entries(grouped)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6);

      charts.push({
        type: "bar",
        title: `Distribución de ${metricKey} por ${categoryKey}`,
        data,
        xKey: "name",
        yKey: "value",
      });
    }

    if (charts.length < 2 && numericKeys.length) {
      const metricKey = numericKeys[0];
      const data = rows.slice(0, 20).map((row, index) => ({
        index: index + 1,
        value: Number(row?.[metricKey]) || 0,
      }));

      charts.push({
        type: "line",
        title: `Tendencia inicial de ${metricKey}`,
        data,
        xKey: "index",
        yKey: "value",
      });
    }

    return charts.slice(0, 2);
  };

  const setLocalFiles = (incomingFiles = []) => {
    setDemoMetadata(null);
    setFiles(Array.from(incomingFiles));
  };

  const handleFileChange = (e) => {
    setLocalFiles(e.target.files || []);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      setLocalFiles(e.dataTransfer.files);
    }
  };

  const openFileDialog = () => fileInputRef.current?.click();

  const downloadDriveFile = async (fileId, accessToken, suggestedName) => {
    try {
      setDriveLoading(true);
      const response = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const message = await response.text();
        throw new Error(
          message || "No se pudo descargar el archivo desde Google Drive."
        );
      }

      const blob = await response.blob();
      const extension = blob.type?.split("/")?.[1] || "dat";
      const filename =
        suggestedName?.trim() || `drive-file-${fileId}.${extension}`;
      const driveFile = new File([blob], filename, { type: blob.type });
      setFiles([driveFile]);
      setUploadMode("local");
      setSelectedDriveFileName(driveFile.name);
      alert(
        `Archivo importado desde Google Drive y listo para analizar: ${driveFile.name}`
      );
    } catch (error) {
      console.error("Error al descargar archivo de Drive:", error);
      alert(error.message);
    } finally {
      setDriveLoading(false);
    }
  };

  const openDrivePicker = () => {
    if (!googleApiKey || !googleClientId)
      return alert(
        "Faltan las claves de Google (VITE_GOOGLE_CLIENT_ID y VITE_GOOGLE_API_KEY)."
      );

    if (!drivePickerReady || !tokenClientRef.current)
      return alert("Google Drive Picker aún no está listo. Intenta de nuevo en unos segundos.");

    setDriveLoading(true);

    tokenClientRef.current.callback = (response) => {
      if (response.error) {
        console.error("Error de autenticación con Google:", response);
        setDriveLoading(false);
        return;
      }

      const accessToken = response.access_token;

      const view = new window.google.picker.DocsView()
        .setIncludeFolders(true)
        .setSelectFolderEnabled(true);

      const picker = new window.google.picker.PickerBuilder()
        .enableFeature(window.google.picker.Feature.NAV_HIDDEN)
        .enableFeature(window.google.picker.Feature.MULTISELECT_DISABLED)
        .setDeveloperKey(googleApiKey)
        .setOAuthToken(accessToken)
        .setLocale("es")
        .addView(view)
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const file = data.docs?.[0];
            if (file?.id) {
              downloadDriveFile(file.id, accessToken, file.name);
            }
          }

          if (data.action === window.google.picker.Action.CANCEL) {
            setDriveLoading(false);
          }
        })
        .build();

      picker.setVisible(true);
    };

    tokenClientRef.current.requestAccessToken({ prompt: "consent" });
  };

  const handleUpload = async () => {
    if (!files.length) {
      setAnalysisError("Selecciona al menos un archivo .csv, .xlsx o .zip primero.");
      return;
    }
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setDemoMetadata(null);
    setAnalysis(null);
    setAiCharts([]);
    setPreAnalysis(null);
    setJobId(null);
    setDisplayProgress(0);
    setAnalysisStep("cargando");
    setStatusMessage("Preparando archivo…");
    setPolling(false);
    setIsAnalyzing(true);
    setAnalysisError("");
    setResultNotice("");
    setGalleryMode("static");

    const formData = new FormData();
    files.forEach((fileItem) => formData.append("files", fileItem));
    formData.append("focus", categoryFilter);
    setLoading(true);

    try {
      const apiBase = API_URL;
      console.log("🌐 Iniciando análisis en:", `${apiBase}/analyze/start`);

      const res = await axios.post(`${apiBase}/analyze/start`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        onUploadProgress: (event) => {
          if (!event.total) return;
          const percent = Math.round((event.loaded * 100) / event.total);
          setStatusMessage(
            percent < 100
              ? "Preparando archivo…"
              : "Archivo recibido. Lanzando análisis…"
          );
        },
      });

      const data = res.data;
      console.log("📊 Job lanzado:", data);
      setJobId(data.job_id);
      setPreAnalysis(data.pre_analysis);
      setAnalysisStep(data.step || "pre_analisis");
      setStatusMessage("Analizando datos…");
      setPolling(true);
    } catch (err) {
      console.error("💥 Error al conectar con el backend:", err);
      const status = err?.response?.status;
      if ([401, 403].includes(status)) {
        onUnauthorized?.("Tu sesión expiró. Por favor, vuelve a iniciar sesión.");
      } else {
        const detail = err?.response?.data?.detail || err?.message || "Error de conexión.";
        setAnalysisError(
          typeof detail === "string"
            ? detail
            : "No se pudo iniciar el análisis. Verifica que el archivo sea CSV, Excel o ZIP válido."
        );
        setResultNotice("Intenta de nuevo o carga la demo para validar el flujo.");
      }
      setIsAnalyzing(false);
      setStatusMessage("No se pudo iniciar el análisis.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoAnalyze = async () => {
    setDemoMetadata(null);
    setAnalysis(null);
    setFiles([]);
    setStatusMessage("Cargando demo…");
    setActiveTab("graficos");
    setIsAnalyzing(true);
    setDisplayProgress(0);
    setAnalysisError("");
    setResultNotice("");
    setGalleryMode("interactive");

    const token = localStorage.getItem("token");
    const apiBase = API_URL;
    try {
      const res = await fetch(
        `${apiBase}/demo/analyze?scenario=ventas_demo`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      if ([401, 403].includes(res.status)) {
        onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
        setIsAnalyzing(false);
        return;
      }

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo cargar la demo.");
      }

      const data = await res.json();
      setAnalysis(data);
      const demoDatasetId = data?.datasetId || data?.dataset_id || data?.analysis_id;
      const demoFileName = data?.metadata?.file_name || data?.file_name || "Demo de ventas";
      persistDatasetMeta(demoDatasetId, demoFileName);
      setAiCharts(generateAiCharts(data.sample));
      setDemoMetadata(data.demo_metadata || { is_demo: true, scenario: "ventas_demo" });
      onDataReceived?.(data);
      setStatusMessage("Demo lista");
      setDisplayProgress(100);
      setResultNotice("Demo lista. Explora los gráficos interactivos y descárgalos en PDF.");
    } catch (error) {
      console.error("Error al cargar demo:", error);
      setAnalysisError(error.message || "No se pudo cargar la demo");
      setResultNotice("Intenta nuevamente o usa otro escenario demo disponible.");
    } finally {
      setIsAnalyzing(false);
      setLoading(false);
    }
  };

  const handleMercadoLibreAnalyze = async () => {
    setMeliError("");
    if (!selectedMeliAccount) {
      setMeliError("Configura primero una cuenta de MercadoLibre desde Integraciones.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    setMeliLoading(true);
    setAnalysis(null);
    setAiCharts([]);
    setStatusMessage("Consultando MercadoLibre…");
    setAnalysisError("");
    setResultNotice("");
    setIsAnalyzing(true);

    try {
      const res = await fetch(
        `${API_URL}/mercadolibre/credentials/${selectedMeliAccount}/analyze/${meliDataset}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if ([401, 403].includes(res.status)) {
        onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión.");
        setIsAnalyzing(false);
        return;
      }

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "No se pudo analizar la data de MercadoLibre.");
      }

      const data = await res.json();
      setAnalysis(data);
      setAiCharts(generateAiCharts(data.sample));
      setStatusMessage("Análisis listo desde MercadoLibre");
      setDisplayProgress(100);
      setResultNotice("Datos sincronizados correctamente. Explora los gráficos sugeridos.");
      onDataReceived?.(data);
    } catch (error) {
      console.error("Error analizando datos de MercadoLibre:", error);
      setAnalysisError(error.message || "No se pudo analizar la data de MercadoLibre.");
      setResultNotice("Revisa las credenciales y que la cuenta tenga órdenes recientes.");
    } finally {
      setMeliLoading(false);
      setIsAnalyzing(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!analysis) return;
    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    try {
      setDownloading(true);
      const apiBase = API_URL;
      const res = await fetch(`${apiBase}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ analysis }),
      });

      if (!res.ok) {
        if ([401, 403].includes(res.status)) {
          onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión para descargar el reporte.");
          return;
        }

        const message = await res.text();
        throw new Error(message || "No se pudo generar el reporte.");
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "Reporte_InformeBF.pdf";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al generar el reporte:", error);
      alert(`No se pudo generar el reporte: ${error.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const handleSendReportEmail = async () => {
    if (!analysis) return;
    if (!reportEmail.trim()) {
      setEmailFeedback("Ingresa un correo válido para enviar el reporte.");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      onUnauthorized?.("Tu sesión expiró. Inicia sesión nuevamente.");
      return;
    }

    try {
      setSendingReport(true);
      setEmailFeedback("");
      const apiBase = API_URL;
      const res = await fetch(`${apiBase}/report/email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ analysis, email: reportEmail.trim() }),
      });

      if (!res.ok) {
        if ([401, 403].includes(res.status)) {
          onUnauthorized?.("Tu sesión expiró. Vuelve a iniciar sesión para enviar el reporte.");
          return;
        }

        const message = await res.text();
        throw new Error(message || "No se pudo enviar el reporte por correo.");
      }

      setEmailFeedback("📨 Reporte enviado correctamente al correo indicado.");
    } catch (error) {
      console.error("Error al enviar el reporte:", error);
      setEmailFeedback(`⚠️ ${error.message}`);
    } finally {
      setSendingReport(false);
    }
  };

  const tabs = [
    { id: "graficos", label: "📊 Visualizaciones" },
    { id: "insights", label: "🤖 Insights IA" },
    { id: "reporte", label: "📑 Reporte ejecutivo" },
  ];

  const suggestedActions = buildSuggestedActions();

  const getFocusIndicators = () => {
    if (categoryFilter !== "auditoria") return [];

    return [
      {
        title: "Controles y cumplimiento",
        description:
          "% de controles críticos ejecutados vs. planificados y tasa de excepciones documentadas.",
      },
      {
        title: "Accesos y segregación",
        description:
          "% de accesos críticos revisados, violaciones de segregación de funciones y usuarios con privilegios temporales.",
      },
      {
        title: "Hallazgos y remediación",
        description:
          "Número de hallazgos abiertos, días promedio de cierre, reincidencias y SLA de remediación por responsable.",
      },
      {
        title: "Trazabilidad operacional",
        description:
          "Transacciones sin evidencia o fuera de horario, cambios en datos maestros y anomalías detectadas en logs.",
      },
    ];
  };

  const focusInsightsPanel = () => setActiveTab("insights");

  const rowsEstimated =
    (preAnalysis?.rows_est || preAnalysis?.rows || preAnalysis?.sample_size || 0);

  const topNullColumns = preAnalysis
    ? (() => {
      const source = preAnalysis.null_percentages || preAnalysis.null_counts || {};
      const hasPercentages = Boolean(preAnalysis.null_percentages);
      return Object.entries(source)
        .sort(([, a], [, b]) => (Number(b ?? 0) || 0) - (Number(a ?? 0) || 0))
        .slice(0, 3)
        .map(([col, value]) => {
          const numericValue = Number(value ?? 0);
          const displayValue = hasPercentages
            ? `${numericValue.toFixed(1)}%`
            : `${numericValue.toLocaleString()}`;
          return `${col} (${displayValue})`;
        });
    })()
    : [];

  return (
    <div className="w-full max-w-6xl mx-auto flex flex-col space-y-8 text-gray-800 dark:text-slate-100">
      <div className="grid w-full gap-6 px-2 lg:grid-cols-[1.05fr_1.2fr]">
        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-xl p-6 sm:p-7 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
              </svg>
            </div>
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Prioriza el análisis</p>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Foco del informe</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Elige el enfoque (ventas, stock o auditoría) para que los KPIs y visualizaciones se alineen con tu objetivo. "Todo" mantiene el comportamiento actual.
              </p>
            </div>
          </div>
          <div className="relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M11 5a6 6 0 014.74 9.69l2.78 2.77" />
                <circle cx="11" cy="11" r="6" />
              </svg>
            </span>
            <select
              id="category-filter"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              ref={filterSelectRef}
              className="w-full appearance-none rounded-2xl border border-slate-200/90 dark:border-slate-700 bg-white/90 dark:bg-slate-900/70 px-12 py-3 pr-12 shadow-sm text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {focusOptions.map((option) => (
                <option key={option.valor} value={option.valor}>
                  {option.etiqueta}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-400 dark:text-slate-500">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
                  clipRule="evenodd"
                />
              </svg>
            </span>
          </div>
          {getFocusIndicators().length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {getFocusIndicators().map((indicator) => (
                <div
                  key={indicator.title}
                  className="flex items-start gap-3 rounded-2xl border border-amber-200/70 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-900/20 p-4"
                >
                  <span className="mt-0.5 text-lg" aria-hidden="true">
                    📌
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">{indicator.title}</p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-100/80 leading-relaxed">{indicator.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white/80 dark:bg-slate-900/70 shadow-xl p-6 sm:p-7 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-300">Carga inteligente</p>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Carga y análisis de archivos</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                Arrastra tus datos o súbelos desde tu equipo. Formatos permitidos: CSV, XLSX o ZIP. Mantén el flujo: subir → elegir enfoque → analizar.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/60 px-3 py-1 text-xs font-semibold text-blue-700 dark:text-blue-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden />
              Validación automática
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setUploadMode("local")}
              className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${uploadMode === "local"
                  ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
                  : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                }`}
            >
              <span className="text-lg" aria-hidden>
                📁
              </span>
              Subir desde tu equipo
            </button>
            {false && (
              <button
                type="button"
                onClick={() => setUploadMode("drive")}
                className={`flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${uploadMode === "drive"
                    ? "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-700 dark:bg-blue-900/40 dark:text-blue-100"
                    : "border-slate-200 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  }`}
              >
                <span className="text-lg" aria-hidden>
                  ☁️
                </span>
                Importar desde Google Drive
              </button>
            )}
          </div>

          {uploadMode === "local" ? (
            <>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`group relative w-full rounded-2xl border-2 border-dashed p-6 sm:p-7 transition ${isDragging
                    ? "border-blue-500 bg-blue-50/70 dark:bg-blue-900/20 shadow-lg shadow-blue-500/20"
                    : "border-slate-300/80 dark:border-slate-700/80 bg-white/70 dark:bg-slate-900/50"
                  }`}
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M7 10l5 5 5-5" />
                        <path d="M12 15V4" />
                        <rect x="4" y="17" width="16" height="3" rx="1.5" />
                      </svg>
                    </div>
                    <div className="space-y-1">
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">
                        Arrastra y suelta tus archivos
                      </p>
                      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                        También puedes buscarlos en tu dispositivo y prepararlos para el análisis asistido por IA.
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Formatos permitidos: CSV, XLSX, ZIP.</p>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <button
                      type="button"
                      onClick={openFileDialog}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white px-5 py-3 text-sm font-semibold shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-slate-900/30 dark:bg-white dark:text-slate-900"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 dark:bg-slate-200/90 text-base">
                        ⬆️
                      </span>
                      Subir desde tu equipo
                    </button>
                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">Compatible con arrastrar y soltar.</p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  accept=".csv, .xlsx, .zip"
                  multiple
                  className="hidden"
                />
              </div>
              {demoMetadata?.is_demo && (
                <p className="text-xs text-amber-600 dark:text-amber-300 text-left">
                  Estás viendo datos de ejemplo. Sube un archivo para reemplazarlos.
                </p>
              )}
            </>
          ) : (
            <div className="w-full space-y-2 bg-white/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-slate-700 dark:text-slate-200 font-medium">Importa un archivo de Google Drive</p>
              <button
                onClick={openDrivePicker}
                disabled={driveLoading || !drivePickerReady}
                className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-semibold transition-all duration-300 ${driveLoading || !drivePickerReady
                    ? "bg-slate-400 text-white cursor-not-allowed"
                    : "bg-emerald-600 hover:bg-emerald-700 text-white shadow"
                  }`}
              >
                {driveLoading ? "Conectando con Google..." : "Elegir archivo en Google Drive"}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Se abrirá una ventana de Google para autorizar y elegir el archivo sin escribir tokens.
              </p>
              {selectedDriveFileName && (
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold">
                  Archivo seleccionado: {selectedDriveFileName}
                </p>
              )}
            </div>
          )}

          {files.length > 0 && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                {files.length}
              </span>
              {files.length === 1
                ? `Archivo listo: ${files[0].name}`
                : `${files.length} archivos listos para analizar`}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 w-full">
            <AppButton
              onClick={handleUpload}
              disabled={files.length === 0}
              loading={loading || isAnalyzing}
              loadingText="Analizando..."
              fullWidth
              className="sm:flex-1"
            >
              Analizar archivo(s)
            </AppButton>

            <AppButton
              onClick={handleDemoAnalyze}
              disabled={isAnalyzing}
              loading={isAnalyzing && !analysis}
              loadingText="Cargando demo…"
              variant="secondary"
              fullWidth
              className="sm:flex-1"
            >
              Probar con datos de ejemplo
            </AppButton>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/60 dark:bg-emerald-900/30 p-4 space-y-3 mt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">MercadoLibre</p>
                <h4 className="text-lg font-semibold text-slate-900 dark:text-white">Analizar data en un clic</h4>
                <p className="text-sm text-slate-700 dark:text-slate-200">Usa tus tokens OAuth guardados para sincronizar ventas y métricas sin subir archivos.</p>
              </div>
              <span className="rounded-full bg-white/80 dark:bg-slate-800/70 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-100">Beta</span>
            </div>

            {meliAccounts.length === 0 ? (
              <p className="text-sm text-emerald-900 dark:text-emerald-100">
                Configura una cuenta en Integraciones → MercadoLibre para habilitar este acceso directo.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-[1.2fr_0.8fr_0.8fr] items-end">
                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Cuenta</span>
                  <select
                    value={selectedMeliAccount}
                    onChange={(e) => setSelectedMeliAccount(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    {meliAccounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.account_name} ({account.country_code})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">Dataset</span>
                  <select
                    value={meliDataset}
                    onChange={(e) => setMeliDataset(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white/90 dark:bg-slate-900/60 px-3 py-2 text-sm"
                  >
                    <option value="orders">Órdenes y ventas</option>
                  </select>
                </label>

                <AppButton
                  onClick={handleMercadoLibreAnalyze}
                  loading={meliLoading}
                  disabled={!selectedMeliAccount}
                  loadingText="Sincronizando..."
                  fullWidth
                >
                  Analizar data de MercadoLibre
                </AppButton>
              </div>
            )}

            {meliError && (
              <p className="text-sm text-red-700 dark:text-red-300">{meliError}</p>
            )}
          </div>
        </div>
      </div>

      {(preAnalysis || isAnalyzing) && (
        <div className="w-full max-w-5xl mt-6 space-y-4">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">
                  Estado del análisis
                </p>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                  {getStepLabel(analysisStep)}
                </h3>
              </div>
            </div>

            <div className="space-y-3">
              <LoadingBar
                progress={displayProgress}
                label={getStepLabel(analysisStep)}
                status="Análisis inteligente"
                step={analysisStep}
                helperText={
                  statusMessage ||
                  "El asistente está limpiando, conectando y resumiendo tu dataset."
                }
              />
            </div>
          </div>

          {(analysisError || resultNotice) && (
            <div className="space-y-2">
              {analysisError && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-100">
                  <span aria-hidden className="text-lg">⚠️</span>
                  <div>
                    <p className="text-sm font-semibold">Hubo un problema con el archivo</p>
                    <p className="text-sm leading-relaxed">{analysisError}</p>
                  </div>
                </div>
              )}
              {resultNotice && (
                <div className="flex items-start gap-2 p-3 rounded-xl border border-blue-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-900/60 text-blue-800 dark:text-slate-100">
                  <span aria-hidden className="text-lg">💡</span>
                  <p className="text-sm leading-relaxed">{resultNotice}</p>
                </div>
              )}
            </div>
          )}

          {preAnalysis && (
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-200 flex items-center justify-center font-bold">
                  ⚡️
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-gray-500 dark:text-slate-400">Pre-análisis rápido</p>
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-slate-100">
                    {rowsEstimated.toLocaleString()} filas estimadas · {preAnalysis.columns} columnas
                  </h3>
                </div>
              </div>

              <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">
                Pre-análisis listo: {rowsEstimated.toLocaleString()} filas estimadas, {preAnalysis.columns} columnas. Columnas con más nulos: {topNullColumns.length ? topNullColumns.join(", ") : "sin nulos relevantes"}.
              </p>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-300">Columnas numéricas</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{preAnalysis.numeric_column_count}</p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-300">Candidatos de fecha</p>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    {preAnalysis.date_candidates?.length
                      ? preAnalysis.date_candidates.join(", ")
                      : "Sin detectar"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs text-gray-500 dark:text-slate-300">Esquema IA</p>
                  <p className="text-sm text-gray-700 dark:text-slate-200 line-clamp-3">
                    {preAnalysis.ai_schema}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-300 mb-1">
                    Columnas detectadas
                  </p>
                  <p className="text-sm text-gray-700 dark:text-slate-200 leading-relaxed">
                    {preAnalysis.column_names?.slice(0, 12).join(", ")}
                    {preAnalysis.column_names?.length > 12 && "…"}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
                  <p className="text-xs font-semibold text-gray-500 dark:text-slate-300 mb-1">
                    Nulos por columna (top)
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-700 dark:text-slate-200">
                    {Object.entries(preAnalysis.null_counts || {})
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 6)
                      .map(([col, count]) => (
                        <span
                          key={col}
                          className="px-2 py-1 rounded-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700"
                        >
                          {col}: {count}
                        </span>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resultados del análisis */}
      {analysis && (
        <div className="mt-10 w-full space-y-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl">
            <div className="flex flex-wrap gap-2 p-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/70">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 text-sm font-semibold rounded-xl transition-all duration-300 flex items-center gap-2 ${activeTab === tab.id
                      ? "text-blue-700 bg-white shadow-sm border border-blue-200 dark:text-blue-200 dark:bg-slate-800 dark:border-slate-700"
                      : "text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-300"
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {/* 📊 GRÁFICOS */}
              {activeTab === "graficos" && (
                <div className="space-y-8">
                  <VisualizationExplorer analysis={analysis} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-xs uppercase tracking-[0.15em] text-gray-500 dark:text-slate-400">Galería automática</p>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white">Gráficos generados por el backend</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-300">Alterna entre capturas rápidas y vistas interactivas con filtros.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setGalleryMode("static")}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${galleryMode === "static"
                              ? "border-blue-500 text-blue-700 dark:text-blue-200 bg-blue-50 dark:bg-slate-800"
                              : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300"
                            }`}
                        >
                          📷 Capturas
                        </button>
                        <button
                          onClick={() => setGalleryMode("interactive")}
                          disabled={!interactiveGalleryCharts.length}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition flex items-center gap-1 ${galleryMode === "interactive"
                              ? "border-emerald-500 text-emerald-700 dark:text-emerald-200 bg-emerald-50 dark:bg-slate-800"
                              : "border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-300"
                            } ${!interactiveGalleryCharts.length ? "opacity-60 cursor-not-allowed" : ""}`}
                        >
                          🧭 Interactivo
                        </button>
                      </div>
                    </div>

                    {galleryMode === "interactive" && interactiveGalleryCharts.length > 0 && (
                      <div className="flex items-center justify-between flex-wrap gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-gray-200 dark:border-slate-800 text-xs text-gray-700 dark:text-slate-200">
                        <p className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">i</span>
                          Ajusta cuántas categorías quieres ver en cada gráfico.
                        </p>
                        <div className="flex items-center gap-2">
                          <span>Top {interactiveLimit}</span>
                          <input
                            type="range"
                            min="3"
                            max="20"
                            value={interactiveLimit}
                            onChange={(e) => setInteractiveLimit(Number(e.target.value))}
                            className="accent-emerald-500"
                          />
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                      {galleryMode === "interactive"
                        ? (() => {
                          const charts = filterGraphsByCategory(interactiveGalleryCharts).slice(
                            0,
                            interactiveLimit
                          );

                          return charts.length ? (
                            charts.map((chart, index) => (
                              <div
                                key={`${chart.title}-${index}`}
                                className="group overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg"
                              >
                                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                                  <div className="flex items-center gap-3">
                                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-200">
                                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M3 3v18h18" />
                                        <path d="M7 16l3-3 4 4 5-5" />
                                      </svg>
                                    </span>
                                    <div>
                                      <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Interactivo</p>
                                      <h4 className="text-base font-semibold text-gray-900 dark:text-white">{chart.title}</h4>
                                    </div>
                                  </div>
                                  <span className="text-[11px] text-gray-500 dark:text-slate-400">Tooltip + Leyenda</span>
                                </div>
                                <div className="p-5 h-72">
                                  <ResponsiveContainer width="100%" height="100%">
                                    {chart.type === "bar" ? (
                                      <BarChart data={chart.data.slice(0, interactiveLimit)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} angle={-15} textAnchor="end" height={70} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                                        <Legend />
                                        <Bar dataKey={chart.yKey} name={chart.yKey} fill="#10b981" radius={[10, 10, 4, 4]} />
                                      </BarChart>
                                    ) : (
                                      <LineChart data={chart.data.slice(0, interactiveLimit)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                                        <XAxis dataKey={chart.xKey} tick={{ fontSize: 12 }} angle={-10} textAnchor="end" height={60} />
                                        <YAxis tick={{ fontSize: 12 }} />
                                        <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                                        <Legend />
                                        <Line type="monotone" dataKey={chart.yKey} name={chart.yKey} stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} />
                                      </LineChart>
                                    )}
                                  </ResponsiveContainer>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-500 dark:text-slate-400 italic text-center col-span-2">
                              No hay datos suficientes en la muestra para construir gráficos interactivos.
                            </p>
                          );
                        })()
                        : filterGraphsByCategory(analysis.graphs)?.length > 0 ? (
                          filterGraphsByCategory(analysis.graphs).map((chart, i) => (
                            <div
                              key={i}
                              className="group relative overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-900 dark:to-slate-950 shadow-lg"
                            >
                              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-slate-800">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-200">
                                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                      <path d="M3 3v18h18" />
                                      <path d="M7 16l3-3 4 4 5-5" />
                                    </svg>
                                  </span>
                                  <div>
                                    <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">Visualización</p>
                                    <h4 className="text-base font-semibold text-gray-900 dark:text-white">{chart.column || `Gráfico ${i + 1}`}</h4>
                                  </div>
                                </div>
                                <div className="relative">
                                  <div className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700 rounded-full px-3 py-1">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    Hover para detalles
                                  </div>
                                  <div className="pointer-events-none absolute right-0 mt-2 w-48 rounded-xl bg-white/95 dark:bg-slate-900/95 shadow-lg border border-gray-200 dark:border-slate-800 p-3 text-xs text-gray-600 dark:text-slate-200 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition duration-200">
                                    Gráficos enmarcados con sombra sutil y tipografía reforzada para un look tipo Notion/Linear.
                                  </div>
                                </div>
                              </div>
                              <div className="p-5">
                                <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-slate-800 shadow-inner bg-white dark:bg-slate-900">
                                  <img
                                    src={chart.image}
                                    alt={chart.column}
                                    className="rounded-lg mx-auto"
                                    style={{ maxHeight: "320px", objectFit: "contain" }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-gray-500 dark:text-slate-400 italic text-center col-span-2">
                            No hay gráficos disponibles.
                          </p>
                        )}
                    </div>
                  </div>
                </div>
              )}

              {/* 🤖 INSIGHTS */}
              {activeTab === "insights" && (
                <div className="space-y-5">
                  <div className="rounded-3xl bg-gradient-to-r from-blue-50 via-white to-emerald-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 border border-blue-100/70 dark:border-slate-800 px-6 py-6 shadow-xl">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.2em] text-blue-700 dark:text-blue-200">Módulo Insights IA</p>
                        <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Chat con tus datos</h3>
                        <p className="text-sm text-gray-600 dark:text-slate-300">Un asesor inteligente que responde con recomendaciones accionables sobre tu archivo.</p>
                      </div>
                      <div className="rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-blue-100/60 dark:border-slate-700 px-4 py-3 shadow-sm text-sm text-gray-800 dark:text-slate-100">
                        <p className="font-semibold text-blue-800 dark:text-blue-200">Cómo sacarle provecho</p>
                        <ul className="mt-2 space-y-1 list-disc list-inside">
                          <li>Pregunta por acciones concretas de ventas, marketing u operaciones.</li>
                          <li>Solicita planes de campaña, foco de productos o reducciones de costo.</li>
                          <li>Usa las preguntas sugeridas para acelerar la conversación.</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <InsightsIA datasetId={datasetId} datasetName={datasetName} />
                </div>
              )}

              {/* 📑 REPORTE EJECUTIVO */}
              {activeTab === "reporte" && (
                <div className="flex flex-col gap-6 w-full">
                  <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-gradient-to-r from-white to-gray-50 dark:from-slate-900 dark:to-slate-950 shadow-lg p-6">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white" aria-hidden="true">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 4h16v14H5.5L4 19.5V4z" />
                        </svg>
                      </span>
                      <div className="space-y-1">
                        <p className="text-xs uppercase tracking-[0.15em] text-emerald-600 dark:text-emerald-300">Reporte ejecutivo</p>
                        <h4 className="text-lg font-semibold text-gray-900 dark:text-white">PDF listo para comité</h4>
                        <p className="text-sm text-gray-600 dark:text-slate-300">
                          Exporta y comparte insights, estadísticas y visualizaciones detectadas automáticamente en tu dataset.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl space-y-3">
                    <label className="block text-sm font-semibold text-gray-700 dark:text-slate-100">Enviar por correo electrónico</label>
                    <p className="text-xs text-gray-600 dark:text-slate-300">
                      Ingresa un correo para enviar el PDF generado directamente a tu bandeja de entrada.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                      <input
                        type="email"
                        value={reportEmail}
                        onChange={(e) => setReportEmail(e.target.value)}
                        placeholder="ejemplo@correo.com"
                        className="flex-1 rounded-xl border border-gray-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                      />
                      <button
                        onClick={handleSendReportEmail}
                        disabled={sendingReport || downloading || !analysis}
                        className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition shadow-md focus:outline-none focus:ring-4 focus:ring-emerald-200 ${sendingReport || downloading || !analysis
                            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                            : "bg-emerald-500 text-white hover:bg-emerald-600"
                          }`}
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M4 4l8 6 8-6" />
                          <path d="M4 20h16V6" />
                        </svg>
                        <span className="text-sm sm:text-base font-semibold">
                          {sendingReport ? "Enviando..." : "Enviar PDF"}
                        </span>
                      </button>
                    </div>
                    {emailFeedback && (
                      <p
                        className={`text-sm text-left ${emailFeedback.startsWith("⚠️")
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-emerald-700 dark:text-emerald-300"
                          }`}
                      >
                        {emailFeedback}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={handleDownloadReport}
                    disabled={downloading || !analysis}
                    className={`group relative inline-flex items-center justify-center gap-2 px-8 py-3 rounded-full font-semibold tracking-wide transition-all duration-300 shadow-lg focus:outline-none focus:ring-4 focus:ring-emerald-200 ${downloading || !analysis
                        ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                        : "bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 text-white hover:scale-[1.02] hover:shadow-xl"
                      }`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 3v12" />
                      <path d="M7 12l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    <span className="text-sm sm:text-base font-semibold">
                      {downloading ? "Generando reporte..." : "Descargar reporte"}
                    </span>
                    {!downloading && analysis && (
                      <span className="pointer-events-none absolute inset-0 rounded-full border border-white/30 blur-sm opacity-0 group-hover:opacity-100 transition" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
