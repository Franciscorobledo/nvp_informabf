export const extractScenes = (dataMovie) => {
  if (!dataMovie) return [];
  const scenes = dataMovie.scenes || dataMovie.frames;
  if (!Array.isArray(scenes)) return [];
  return scenes.filter(Boolean);
};

export const hasPlayableDataMovie = (dataMovie) => extractScenes(dataMovie).length > 0;

export const normalizeSceneList = (scenes, registry) => {
  if (!Array.isArray(scenes)) return [];
  return scenes
    .map((scene, index) => {
      const definition = registry[scene?.type] || registry.fallback;
      const id = scene?.id || `${scene?.type || "scene"}-${index + 1}`;
      return {
        ...definition.defaults,
        ...scene,
        id,
        type: scene?.type || definition.type,
        avatar_mood: scene?.avatar_mood || definition.defaultMood,
        duration_sec: scene?.duration_sec || definition.defaultDuration,
      };
    })
    .filter((scene) => Boolean(scene));
};
