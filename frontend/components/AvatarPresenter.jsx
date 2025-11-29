import React from "react";

const moodStyles = {
  neutral: {
    bg: "bg-slate-700",
    text: "text-white",
    halo: "ring-slate-500",
    icon: "🤖",
  },
  happy: {
    bg: "bg-emerald-600",
    text: "text-white",
    halo: "ring-emerald-400",
    icon: "😊",
  },
  positive: {
    bg: "bg-blue-600",
    text: "text-white",
    halo: "ring-blue-400",
    icon: "😃",
  },
  focused: {
    bg: "bg-indigo-600",
    text: "text-white",
    halo: "ring-indigo-400",
    icon: "🧐",
  },
  warning: {
    bg: "bg-amber-600",
    text: "text-white",
    halo: "ring-amber-300",
    icon: "⚠️",
  },
};

const AvatarPresenter = ({ mood = "neutral", narration }) => {
  const style = moodStyles[mood] || moodStyles.neutral;

  return (
    <div className="flex flex-col items-center gap-4 text-left">
      <div
        className={`flex h-20 w-20 items-center justify-center rounded-full ${style.bg} ${style.text} shadow-lg ring-4 ${style.halo}`}
        aria-label="Avatar narrador"
      >
        <span className="text-3xl" aria-hidden="true">
          {style.icon}
        </span>
      </div>
    </div>
  );
};

export default AvatarPresenter;
