import API_URL from "../../api.js";

export const handleUploadSubmission = async (
  event,
  {
    authorizedFetch,
    setLoading,
    setError,
    setUploadStatus,
    setDatasets,
    setUnmappedColumns = () => {},
    formDataFactory = (target) => new FormData(target),
    apiUrl = API_URL,
    onComplete,
  },
) => {
  event.preventDefault();
  setLoading(true);
  setError("");
  const formData = formDataFactory(event.currentTarget);

  try {
    const data = await authorizedFetch(`${apiUrl}/ingest/upload`, {
      method: "POST",
      body: formData,
    });
    setUploadStatus?.({ ...data, updated_at: new Date().toISOString() });
    setDatasets?.(data?.datasets || []);
    setUnmappedColumns?.(data?.unmapped_columns || []);
    if (onComplete) {
      await onComplete(data);
    }
  } catch (err) {
    setError(err.message || "No se pudo subir los archivos");
  } finally {
    setLoading(false);
  }
};
