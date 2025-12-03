import React from "react";
import FileUpload from "./FileUpload";

const DataUploadAnalysis = ({
  user,
  onUnauthorized,
  onDataReceived,
  onNavigateModule,
}) => {
  return (
    <section className="w-full max-w-6xl mx-auto space-y-8">
      <FileUpload
        key={user?.username}
        onUnauthorized={onUnauthorized}
        onDataReceived={onDataReceived}
        onNavigateModule={onNavigateModule}
      />
    </section>
  );
};

export default DataUploadAnalysis;
