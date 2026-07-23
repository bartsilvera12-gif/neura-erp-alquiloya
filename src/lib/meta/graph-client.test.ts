// Tests del wrapper Graph API — errores y clasificacion.
// No hace requests reales; monkey-patchea globalThis.fetch.

import test from "node:test";
import assert from "node:assert/strict";

process.env.META_SECRETS_KEY = "test-key-32-bytes-minimum";
process.env.META_APP_ID = "1234567890";
process.env.META_APP_SECRET = "app-secret-for-tests";
process.env.META_GRAPH_API_VERSION = "v21.0";

const { graphRequest, GraphError } = await import("./graph-client.ts");

function mockFetch(response: {
  status: number;
  bodyJson?: unknown;
  bodyText?: string;
}) {
  const body = response.bodyJson !== undefined
    ? JSON.stringify(response.bodyJson)
    : response.bodyText ?? "";
  globalThis.fetch = (async () => new Response(body, {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  })) as typeof fetch;
}

test("200 OK devuelve el body parseado", async () => {
  mockFetch({ status: 200, bodyJson: { data: [{ id: "42" }] } });
  const res = await graphRequest<{ data: { id: string }[] }>({
    method: "GET",
    path: "/me/accounts",
    accessToken: "tok",
  });
  assert.deepEqual(res.data, [{ id: "42" }]);
});

test("429 rate limit clasifica como transient", async () => {
  mockFetch({ status: 429, bodyJson: { error: { message: "rate limited" } } });
  await assert.rejects(async () => {
    await graphRequest({ method: "GET", path: "/x", accessToken: "tok" });
  }, (err: unknown) => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.kind, "transient");
    return true;
  });
});

test("500 clasifica como transient", async () => {
  mockFetch({ status: 500, bodyJson: { error: { message: "boom" } } });
  await assert.rejects(async () => {
    await graphRequest({ method: "GET", path: "/x", accessToken: "tok" });
  }, (err: unknown) => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.kind, "transient");
    return true;
  });
});

test("OAuthException clasifica como auth", async () => {
  mockFetch({
    status: 400,
    bodyJson: {
      error: {
        message: "Session has expired",
        type: "OAuthException",
        code: 190,
        error_subcode: 463,
      },
    },
  });
  await assert.rejects(async () => {
    await graphRequest({ method: "GET", path: "/x", accessToken: "tok" });
  }, (err: unknown) => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.kind, "auth");
    assert.equal(err.code, "190");
    assert.equal(err.subcode, "463");
    return true;
  });
});

test("400 con code arbitrario clasifica como permanent", async () => {
  mockFetch({
    status: 400,
    bodyJson: { error: { message: "Bad param", code: 100 } },
  });
  await assert.rejects(async () => {
    await graphRequest({ method: "GET", path: "/x", accessToken: "tok" });
  }, (err: unknown) => {
    assert.ok(err instanceof GraphError);
    assert.equal(err.kind, "permanent");
    return true;
  });
});
