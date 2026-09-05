import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import {
  isPinterestUrl,
  normalizePinterestUrl,
  parsePinterestUrl,
} from "pinterest-url-normalizer";
import * as z from "zod/v4";

const urlInputSchema = z.object({
  url: z.string().min(1).describe("A complete Pinterest or pin.it URL"),
});

const toolAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error";

  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

export function createSavePinnerWorkerServer(): McpServer {
  const server = new McpServer({
    name: "savepinner-mcp",
    version: "0.1.1",
  });

  server.registerTool(
    "parse_pinterest_url",
    {
      title: "Parse Pinterest URL",
      description:
        "Parse a Pinterest URL and return its kind, canonical URL, host, and type-specific identifiers.",
      inputSchema: urlInputSchema,
      outputSchema: z.object({
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
      }),
      annotations: toolAnnotations,
    },
    async ({ url }) => {
      try {
        const parsed = parsePinterestUrl(url);
        return {
          content: [{ type: "text", text: JSON.stringify(parsed, null, 2) }],
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
      outputSchema: z.object({ normalizedUrl: z.string().url() }),
      annotations: toolAnnotations,
    },
    async ({ url }) => {
      try {
        const structuredContent = { normalizedUrl: normalizePinterestUrl(url) };
        return {
          content: [{ type: "text", text: structuredContent.normalizedUrl }],
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
        "Return whether a value is a supported Pinterest URL without making an outbound network request.",
      inputSchema: urlInputSchema,
      outputSchema: z.object({ isPinterestUrl: z.boolean() }),
      annotations: toolAnnotations,
    },
    async ({ url }) => {
      const structuredContent = { isPinterestUrl: isPinterestUrl(url) };
      return {
        content: [{ type: "text", text: String(structuredContent.isPinterestUrl) }],
        structuredContent,
      };
    },
  );

  return server;
}

const mcpHandler = createMcpHandler(createSavePinnerWorkerServer);

const docsUrl =
  "https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/docs/";

const docsHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Pinterest URL Validation Guide | SavePinner MCP</title>
    <meta name="description" content="A practical guide to parsing, validating, and normalizing Pinterest URLs safely in applications and AI tools.">
    <meta name="robots" content="index, follow">
    <link rel="canonical" href="${docsUrl}">
    <style>
      :root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; color: #17202a; background: #f6f7f9; line-height: 1.65; }
      main { max-width: 760px; margin: 0 auto; padding: 64px 24px 80px; }
      article { background: #fff; border: 1px solid #e2e6ea; border-radius: 16px; padding: 32px; }
      h1, h2 { line-height: 1.2; color: #111827; }
      h1 { font-size: clamp(2rem, 6vw, 3rem); margin: 0 0 16px; }
      h2 { margin-top: 40px; }
      .eyebrow { color: #b42318; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
      .lead { font-size: 1.15rem; color: #4b5563; }
      code { background: #f1f3f5; border-radius: 4px; padding: .12em .35em; }
      pre { overflow-x: auto; background: #111827; color: #f9fafb; border-radius: 10px; padding: 18px; }
      pre code { background: transparent; padding: 0; }
      a { color: #9f1239; text-underline-offset: 3px; }
      .note { border-left: 4px solid #b42318; background: #fff5f5; padding: 12px 16px; }
      footer { margin-top: 32px; color: #6b7280; font-size: .95rem; }
    </style>
  </head>
  <body>
    <main>
      <article>
        <p class="eyebrow">SavePinner MCP developer guide</p>
        <h1>Validate Pinterest URLs before your application uses them</h1>
        <p class="lead">Pinterest links arrive in several forms: full Pin URLs, localized hosts, profile and board URLs, and shortened <code>pin.it</code> links. Treating every URL that contains the word “pinterest” as valid creates routing bugs and can turn a media workflow into an unsafe open redirect.</p>

        <h2>Use an exact host allowlist</h2>
        <p>Parse the value with the platform URL parser, require HTTPS, and compare the normalized hostname with an explicit allowlist. A suffix or substring check is insufficient because names such as <code>pinterest.com.example.org</code> and <code>notpinterest.com</code> are controlled by unrelated operators. For full URLs, accept Pinterest country hosts only when the registered domain remains <code>pinterest.com</code>. Treat <code>pin.it</code> as a separate short-link host.</p>
        <pre><code>const candidate = new URL(input);
if (candidate.protocol !== "https:") throw new Error("HTTPS required");

const host = candidate.hostname.toLowerCase();
const isFullPinterest = host === "pinterest.com" || host.endsWith(".pinterest.com");
const isShortPinterest = host === "pin.it";
if (!isFullPinterest &amp;&amp; !isShortPinterest) throw new Error("Unsupported host");</code></pre>

        <h2>Classify the path before extracting identifiers</h2>
        <p>A Pin URL normally uses <code>/pin/{numeric-id}/</code>, but profiles, boards, and idea pages have different path shapes. Split the decoded pathname into non-empty segments, classify the resource, and then apply rules for that resource. Never treat the first sequence of digits anywhere in a URL as a Pin identifier. Query parameters can contain tracking values that look like IDs.</p>
        <p>Normalization should remove fragments and known tracking parameters, standardize the host, and produce a predictable trailing slash. Keep the original value in diagnostic output so an operator can trace how the canonical form was produced.</p>

        <h2>Resolve short links with strict redirect rules</h2>
        <p>A <code>pin.it</code> URL cannot be converted safely by string replacement. A service that needs the final Pin must make a network request, reject redirects to hosts outside the allowlist, cap the number of hops, and apply short timeouts. Validate every redirect destination before following it. The SavePinner MCP tools deliberately make no outbound requests, so they classify short links without resolving them.</p>
        <div class="note"><strong>Boundary:</strong> URL validation confirms structure and ownership of the hostname. It does not prove that a Pin exists, that a media file is public, or that the person requesting it has permission to use it.</div>

        <h2>Keep media-host validation separate</h2>
        <p>After an application retrieves Pin metadata, validate media URLs with a second allowlist and a separate policy. Do not reuse Pinterest page-host rules for image or video delivery hosts. Enforce response size limits, content types, redirect limits, and request timeouts before proxying or downloading a file. This separation makes the trust boundary visible and easier to test.</p>

        <h2>Test adversarial and ordinary inputs</h2>
        <p>A useful test table includes a canonical Pin, a localized Pinterest host, tracking parameters, a <code>pin.it</code> short link, a profile, a board, malformed text, an HTTP URL, a deceptive suffix, and credentials embedded before the hostname. Assert both acceptance and the exact normalized result. Property tests can add random casing, fragments, and query parameters without replacing the small set of readable regression cases.</p>

        <h2>Use the public MCP endpoint</h2>
        <p>SavePinner MCP exposes three read-only tools: <code>parse_pinterest_url</code>, <code>normalize_pinterest_url</code>, and <code>is_pinterest_url</code>. Connect a Streamable HTTP client to <code>https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/mcp</code>. The endpoint requires no authentication, stores no request state, and performs no media download.</p>
        <p>For people who need to inspect media exposed by a public Pin in a browser, use the <a href="https://savepinner.com">Pinterest image downloader</a>. Always respect the creator’s rights and the terms that apply to the content.</p>

        <footer>Open-source implementation and test cases are available in the <a href="https://github.com/jiankn/savepinner-mcp">SavePinner MCP repository</a>.</footer>
      </article>
    </main>
  </body>
</html>`;

function docsResponse(): Response {
  return new Response(docsHtml, {
    headers: {
      "cache-control": "public, max-age=3600",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
      "content-type": "text/html; charset=utf-8",
      "referrer-policy": "strict-origin-when-cross-origin",
      "x-content-type-options": "nosniff",
    },
  });
}

function discoveryResponse(pathname: string): Response | undefined {
  if (pathname === "/robots.txt") {
    return new Response(
      `User-agent: *\nAllow: /\nSitemap: https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/sitemap.xml\n`,
      { headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  if (pathname === "/sitemap.xml") {
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url>\n    <loc>${docsUrl}</loc>\n    <lastmod>2026-09-05</lastmod>\n  </url>\n</urlset>\n`,
      { headers: { "content-type": "application/xml; charset=utf-8" } },
    );
  }

  return undefined;
}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    const discoveryDocument = discoveryResponse(url.pathname);
    if (discoveryDocument) {
      return Promise.resolve(discoveryDocument);
    }

    if (url.pathname === "/docs") {
      return Promise.resolve(Response.redirect(docsUrl, 308));
    }

    if (url.pathname === "/docs/") {
      return Promise.resolve(docsResponse());
    }

    if (url.pathname === "/" || url.pathname === "/health") {
      return Promise.resolve(
        Response.json({
          name: "SavePinner Pinterest URL Tools",
          status: "ok",
          endpoint: "/mcp",
          docs: "/docs/",
          homepage: "https://savepinner.com",
          repository: "https://github.com/jiankn/savepinner-mcp",
        }),
      );
    }

    return mcpHandler(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
