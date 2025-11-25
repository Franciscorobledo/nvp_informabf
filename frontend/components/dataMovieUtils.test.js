import assert from "node:assert";
import test from "node:test";
import {
  extractScenes,
  hasPlayableDataMovie,
  normalizeSceneList,
} from "./dataMovieUtils.js";

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

test("extrae escenas sin valores nulos", () => {
  const movie = { scenes: [null, { id: "scene_1" }, undefined] };
  assert.deepStrictEqual(extractScenes(movie).map((scene) => scene.id), ["scene_1"]);
});

test("normaliza escenas aplicando defaults del registro", () => {
  const registry = {
    sample: {
      type: "sample",
      defaultMood: "happy",
      defaultDuration: 5,
      defaults: { chart_data: [] },
      render: () => null,
    },
    fallback: {
      type: "fallback",
      defaultMood: "neutral",
      defaultDuration: 3,
      defaults: {},
      render: () => null,
    },
  };

  const normalized = normalizeSceneList([{ type: "sample" }], registry);
  assert.strictEqual(normalized[0].id, "sample-1");
  assert.strictEqual(normalized[0].avatar_mood, "happy");
  assert.strictEqual(normalized[0].duration_sec, 5);
});
