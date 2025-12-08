import React from "react";
import { logClientError } from "../services/logService";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  async componentDidCatch(error, info) {
    try {
      await logClientError({
        level: "ERROR",
        message: error?.toString?.() || "Error no controlado en el componente",
        details: info?.componentStack,
        path: window?.location?.pathname,
      });
    } catch (logError) {
      console.warn("No se pudo registrar el error en ErrorBoundary", logError);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h1 className="text-2xl font-semibold text-red-600">
            Ocurrió un error inesperado
          </h1>
          <p className="text-gray-600 mt-2">
            Por favor recarga la página o intenta nuevamente más tarde.
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
