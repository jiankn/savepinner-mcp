import assert from "node:assert/strict";
import test from "node:test";
import worker from "../dist/worker.js";

function executionContext() {
  return {
    props: {},
    passThroughOnException() {},
    waitUntil() {},
  };
}

async function callMcp(message) {
  const response = await worker.fetch(
    new Request("https://savepinner-pinterest-url-mcp.example.workers.dev/mcp", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        "content-type": "application/json",
        host: "savepinner-pinterest-url-mcp.example.workers.dev",
        "mcp-protocol-version": "2025-06-18",
      },
      body: JSON.stringify(message),
    }),
    {},
    executionContext(),
  );

  const body = await response.text();
  assert.equal(response.status, 200, body);

  if (response.headers.get("content-type")?.includes("text/event-stream")) {
    const data = body
      .split("\n")
      .find((line) => line.startsWith("data:"))
      ?.slice(5)
      .trim();
    assert.ok(data, body);
    return JSON.parse(data);
  }

  return JSON.parse(body);
}

test("serves public metadata from the Worker root", async () => {
  const response = await worker.fetch(
    new Request("https://savepinner-pinterest-url-mcp.example.workers.dev/"),
    {},
    executionContext(),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.endpoint, "/mcp");
  assert.equal(body.docs, "/docs/");
  assert.equal(body.homepage, "https://savepinner.com");
});

test("serves an indexable developer guide with the campaign link", async () => {
  const response = await worker.fetch(
    new Request("https://savepinner-pinterest-url-mcp.example.workers.dev/docs/"),
    {},
    executionContext(),
  );
  const body = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html;/);
  assert.match(body, /<meta name="robots" content="index, follow">/);
  assert.match(
    body,
    /<link rel="canonical" href="https:\/\/savepinner-pinterest-url-mcp\.chenxuanshimo\.workers\.dev\/docs\/">/,
  );
  assert.match(
    body,
    /<a href="https:\/\/savepinner\.com">Pinterest image downloader<\/a>/,
  );
  assert.doesNotMatch(body, /rel="nofollow"/);
  assert.doesNotMatch(body, /\/pinterest-downloader\//);
});

test("redirects the guide path to its canonical trailing-slash URL", async () => {
  const response = await worker.fetch(
    new Request("https://savepinner-pinterest-url-mcp.example.workers.dev/docs"),
    {},
    executionContext(),
  );

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/docs/",
  );
});

test("initializes and lists the three tools over Streamable HTTP", async () => {
  const initialized = await callMcp({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "savepinner-worker-test", version: "0.1.0" },
    },
  });
  assert.equal(initialized.result.serverInfo.name, "savepinner-mcp");

  const listed = await callMcp({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  });
  assert.deepEqual(
    listed.result.tools.map((tool) => tool.name).sort(),
    ["is_pinterest_url", "normalize_pinterest_url", "parse_pinterest_url"],
  );
});

test("normalizes a Pinterest URL over Streamable HTTP", async () => {
  const result = await callMcp({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "normalize_pinterest_url",
      arguments: {
        url: "https://de.pinterest.com/pin/987654321/?utm_source=share",
      },
    },
  });

  assert.deepEqual(result.result.structuredContent, {
    normalizedUrl: "https://www.pinterest.com/pin/987654321/",
  });
});
