export const hasPlayableDataMovie = (dataMovie) => {
  const scenes = dataMovie?.scenes || dataMovie?.frames;
  if (!Array.isArray(scenes)) return false;
  return scenes.length > 0;
};
