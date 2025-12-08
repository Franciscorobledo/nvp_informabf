import assert from "node:assert";
import test from "node:test";

import API_URL from "../../api.js";
import { handleUploadSubmission } from "./uploadHelpers.js";

test("handleUploadSubmission envía el formulario y actualiza el estado de carga", async () => {
  const loadingStates = [];
  const errors = [];
  let receivedStatus = null;
  let receivedDatasets = null;
  let receivedUnmapped = null;
  let preventCalled = false;
  let capturedTarget = null;

  const formTarget = { id: "formulario-prueba" };
  const mockFormData = { mocked: true };
  const event = {
    currentTarget: formTarget,
    preventDefault: () => {
      preventCalled = true;
    },
  };

  const mockResponse = {
    datasets: [{ type: "sales", row_count: 10 }],
    ok: true,
    unmapped_columns: [{ dataset: "sales", column: "extra_col" }],
  };

  const authorizedFetch = async (url, options) => {
    assert.strictEqual(url, `${API_URL}/ingest/upload`);
    assert.strictEqual(options.method, "POST");
    assert.strictEqual(options.body, mockFormData);
    return mockResponse;
  };

  await handleUploadSubmission(event, {
    authorizedFetch,
    setLoading: (value) => loadingStates.push(value),
    setError: (value) => errors.push(value),
    setUploadStatus: (value) => {
      receivedStatus = value;
    },
    setDatasets: (value) => {
      receivedDatasets = value;
    },
    setUnmappedColumns: (value) => {
      receivedUnmapped = value;
    },
    formDataFactory: (target) => {
      capturedTarget = target;
      return mockFormData;
    },
  });

  assert.strictEqual(preventCalled, true);
  assert.strictEqual(capturedTarget, formTarget);
  assert.deepStrictEqual(loadingStates, [true, false]);
  assert.deepStrictEqual(errors, [""]);
  assert.strictEqual(receivedDatasets, mockResponse.datasets);
  assert.strictEqual(receivedUnmapped, mockResponse.unmapped_columns);
  assert.ok(receivedStatus.updated_at);
});

test("handleUploadSubmission registra errores y limpia el estado de carga", async () => {
  const loadingStates = [];
  const errors = [];

  const failingFetch = async () => {
    throw new Error("fallo de red");
  };

  await handleUploadSubmission(
    {
      currentTarget: null,
      preventDefault: () => {},
    },
    {
      authorizedFetch: failingFetch,
      setLoading: (value) => loadingStates.push(value),
      setError: (value) => errors.push(value),
      setUploadStatus: () => {},
      setDatasets: () => {},
      formDataFactory: () => ({}),
    },
  );

  assert.deepStrictEqual(loadingStates, [true, false]);
  assert.strictEqual(errors.at(-1), "fallo de red");
});
