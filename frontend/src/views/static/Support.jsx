import React from "react";

const Support = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Soporte y Ayuda
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Estamos aquí para ayudarte con cualquier duda sobre InformeBF. Este
          contenido es provisional y puede reemplazarse con instrucciones y
          recursos definitivos.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Canales de contacto
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Incluye correo de soporte, horarios de atención y enlaces a la base de
          conocimiento. Agrega instrucciones para reportar incidencias o
          solicitar mejoras.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Preguntas frecuentes
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Reserva un espacio para responder dudas comunes sobre integraciones,
          facturación y seguridad. Puedes añadir enlaces a tutoriales y guías
          paso a paso.
        </p>
      </div>
    </div>
  );
};

export default Support;
