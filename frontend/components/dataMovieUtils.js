export const hasPlayableDataMovie = (dataMovie) => {
  if (!dataMovie || !Array.isArray(dataMovie.frames)) return false;
  return dataMovie.frames.length > 0;
};
