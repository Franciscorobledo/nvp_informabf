import React from "react";

const PrivacyPolicy = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Política de Privacidad
        </h1>
        <p className="text-gray-600 dark:text-slate-300">
          Protegemos tu información con estándares de seguridad modernos. Este
          texto es un placeholder y puede actualizarse con el contenido legal
          definitivo cuando esté disponible.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Cómo usamos tus datos
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Explica brevemente cómo recopilamos, almacenamos y utilizamos tus
          datos para ofrecer la experiencia de InformeBF. Incluye detalles sobre
          terceros y opciones de control para los usuarios.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 space-y-4 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Tus derechos
        </h2>
        <p className="text-gray-600 dark:text-slate-300">
          Describe cómo puedes acceder, modificar o eliminar tu información, así
          como los canales de contacto para consultas relacionadas con
          privacidad.
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
