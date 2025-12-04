import React, { useRef, useState } from "react";

const UploadDropzone = ({
  id,
  title = "Selecciona o arrastra el archivo aquí",
  description = "Compatible con arrastrar y soltar.",
  helperText = "Formatos permitidos: CSV, XLSX, ZIP.",
  accept,
  onFileSelect,
  disabled = false,
  multiple = false,
  selectedFileName,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef(null);

  const triggerInput = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleFiles = (fileList) => {
    if (!fileList?.length) return;
    const filesArray = Array.from(fileList);
    onFileSelect?.(multiple ? filesArray : filesArray[0]);
  };

  const handleChange = (event) => {
    handleFiles(event.target.files);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    if (disabled) return;
    setIsDragging(false);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div className="space-y-2">
      <div
        role="button"
        tabIndex={0}
        onClick={triggerInput}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            triggerInput();
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative flex flex-col gap-3 rounded-2xl border-2 border-dashed p-5 transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 ${
          isDragging
            ? "border-blue-400 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-900/20"
            : "border-gray-300/80 bg-white dark:border-slate-700 dark:bg-slate-900/60"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/90 text-white shadow-lg shadow-blue-500/30">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
            >
              <path d="M12 4v12" />
              <path d="M7 9l5-5 5 5" />
              <rect x="4" y="16" width="16" height="4" rx="1.5" />
            </svg>
          </div>
          <div className="space-y-1">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {title}
            </p>
            <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
              {description}
            </p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{helperText}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-900 text-white px-4 py-2 text-sm font-semibold shadow-md shadow-slate-900/20 transition hover:-translate-y-0.5 hover:shadow-slate-900/30 dark:bg-white dark:text-slate-900">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-base dark:bg-slate-200/80">
              ⬆️
            </span>
            <span>Seleccionar archivo</span>
          </div>
          {selectedFileName ? (
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-full px-3 py-1">
              {selectedFileName}
            </span>
          ) : (
            <span className="text-[11px] text-gray-500 dark:text-slate-400">
              También puedes arrastrar y soltar el archivo aquí.
            </span>
          )}
        </div>

        <input
          id={id}
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="sr-only"
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default UploadDropzone;
