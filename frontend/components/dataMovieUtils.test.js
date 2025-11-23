import assert from "node:assert";
import test from "node:test";
import { hasPlayableDataMovie } from "./dataMovieUtils.js";

test("retorna falso cuando no hay dataMovie", () => {
  assert.strictEqual(hasPlayableDataMovie(null), false);
});

test("retorna falso cuando la lista de escenas está vacía", () => {
  assert.strictEqual(hasPlayableDataMovie({ scenes: [] }), false);
});

test("retorna verdadero cuando hay escenas disponibles", () => {
  const movie = { scenes: [{ id: "scene_1" }] };
  assert.strictEqual(hasPlayableDataMovie(movie), true);
});
