import assert from "node:assert/strict";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createSavePinnerServer } from "../dist/index.js";

async function withClient(run) {
  const server = createSavePinnerServer();
  const client = new Client({ name: "savepinner-mcp-test", version: "0.1.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

test("lists the three read-only Pinterest URL tools", async () => {
  await withClient(async (client) => {
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      [
        "is_pinterest_url",
        "normalize_pinterest_url",
        "parse_pinterest_url",
      ],
    );

    for (const tool of result.tools) {
      assert.equal(tool.annotations?.readOnlyHint, true);
      assert.equal(tool.annotations?.destructiveHint, false);
    }
  });
});

test("parses a Pin URL through MCP", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "parse_pinterest_url",
      arguments: {
        url: "https://de.pinterest.com/pin/987654321/?utm_source=share",
      },
    });

    assert.equal(result.isError, undefined);
    assert.equal(result.structuredContent?.kind, "pin");
    assert.equal(result.structuredContent?.pinId, "987654321");
    assert.equal(
      result.structuredContent?.normalizedUrl,
      "https://www.pinterest.com/pin/987654321/",
    );
  });
});

test("normalizes a Pinterest URL through MCP", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "normalize_pinterest_url",
      arguments: {
        url: "https://pinterest.co.uk/savepinner/media-tools/?utm_source=test",
      },
    });

    assert.deepEqual(result.structuredContent, {
      normalizedUrl: "https://www.pinterest.com/savepinner/media-tools/",
    });
  });
});

test("validates supported and lookalike URLs", async () => {
  await withClient(async (client) => {
    const supported = await client.callTool({
      name: "is_pinterest_url",
      arguments: { url: "https://pin.it/AbC123" },
    });
    const lookalike = await client.callTool({
      name: "is_pinterest_url",
      arguments: { url: "https://pinterest.com.example.org/pin/123" },
    });

    assert.deepEqual(supported.structuredContent, { isPinterestUrl: true });
    assert.deepEqual(lookalike.structuredContent, { isPinterestUrl: false });
  });
});

test("returns an MCP tool error for an unsupported URL", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "parse_pinterest_url",
      arguments: { url: "https://example.com/pin/123" },
    });

    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Pinterest/i);
  });
});
