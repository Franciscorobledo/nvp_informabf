import assert from "node:assert";
import test from "node:test";
import { hasPlayableDataMovie } from "./dataMovieUtils.js";

test("retorna falso cuando no hay dataMovie", () => {
  assert.strictEqual(hasPlayableDataMovie(null), false);
});

test("retorna falso cuando la lista de frames está vacía", () => {
  assert.strictEqual(hasPlayableDataMovie({ frames: [] }), false);
});

test("retorna verdadero cuando hay frames disponibles", () => {
  const movie = { frames: [{ id: "frame_1" }] };
  assert.strictEqual(hasPlayableDataMovie(movie), true);
});
