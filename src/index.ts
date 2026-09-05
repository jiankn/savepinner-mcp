#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  isPinterestUrl,
  normalizePinterestUrl,
  parsePinterestUrl,
} from "pinterest-url-normalizer";
import * as z from "zod/v4";

const urlInputSchema = {
  url: z.string().min(1).describe("A complete Pinterest or pin.it URL"),
};

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function createSavePinnerServer(): McpServer {
  const server = new McpServer(
    {
      name: "savepinner-mcp",
      version: "0.1.1",
    },
    {
      instructions:
        "Use these read-only tools to validate, classify, parse, and normalize Pinterest URLs. All processing is local and makes no network requests.",
    },
  );

  server.registerTool(
    "parse_pinterest_url",
    {
      title: "Parse Pinterest URL",
      description:
        "Parse a Pinterest URL and return its kind, canonical URL, host, and type-specific identifiers.",
      inputSchema: urlInputSchema,
      outputSchema: {
        kind: z.enum(["pin", "short", "profile", "board", "ideas"]),
        originalUrl: z.string().url(),
        normalizedUrl: z.string().url(),
        host: z.string(),
        pinId: z.string().optional(),
        shortcode: z.string().optional(),
        username: z.string().optional(),
        boardSlug: z.string().optional(),
        ideaSlug: z.string().optional(),
        ideaId: z.string().optional(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ url }) => {
      try {
        const parsed = parsePinterestUrl(url);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(parsed, null, 2),
            },
          ],
          structuredContent: { ...parsed },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "normalize_pinterest_url",
    {
      title: "Normalize Pinterest URL",
      description:
        "Convert a supported Pinterest URL to its canonical form and remove tracking parameters.",
      inputSchema: urlInputSchema,
      outputSchema: {
        normalizedUrl: z.string().url(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ url }) => {
      try {
        const structuredContent = {
          normalizedUrl: normalizePinterestUrl(url),
        };
        return {
          content: [
            {
              type: "text",
              text: structuredContent.normalizedUrl,
            },
          ],
          structuredContent,
        };
      } catch (error) {
        return toolError(error);
      }
    },
  );

  server.registerTool(
    "is_pinterest_url",
    {
      title: "Validate Pinterest URL",
      description:
        "Return whether a value is a supported Pinterest URL without making a network request.",
      inputSchema: urlInputSchema,
      outputSchema: {
        isPinterestUrl: z.boolean(),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ url }) => {
      const structuredContent = {
        isPinterestUrl: isPinterestUrl(url),
      };
      return {
        content: [
          {
            type: "text",
            text: String(structuredContent.isPinterestUrl),
          },
        ],
        structuredContent,
      };
    },
  );

  return server;
}

async function main(): Promise<void> {
  const server = createSavePinnerServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

const entryPath = process.argv[1];
if (entryPath && import.meta.url === pathToFileURL(entryPath).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
