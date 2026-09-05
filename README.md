# SavePinner MCP

An MCP server for parsing, validating, classifying, and normalizing Pinterest URLs. It supports local stdio and public Streamable HTTP. The tools make no outbound network requests and do not download media.

## Tools

| Tool | Purpose |
| --- | --- |
| `parse_pinterest_url` | Return the URL kind, canonical URL, host, and type-specific identifiers. |
| `normalize_pinterest_url` | Convert a supported URL to canonical form and remove tracking parameters. |
| `is_pinterest_url` | Check whether a value is a supported Pinterest URL. |

Supported URL kinds include Pin, `pin.it`, profile, board, and Ideas URLs across Pinterest country domains.

## Run

Node.js 18 or newer is required.

```bash
npx -y savepinner-mcp
```

## Client configuration

Add the server to an MCP client that supports local `stdio` servers:

```json
{
  "mcpServers": {
    "savepinner": {
      "command": "npx",
      "args": ["-y", "savepinner-mcp"]
    }
  }
}
```

## Remote MCP

Connect any Streamable HTTP client to the public endpoint:

```text
https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/mcp
```

The endpoint is read-only and does not require authentication.

The public [Pinterest URL validation guide](https://savepinner-pinterest-url-mcp.chenxuanshimo.workers.dev/docs/) explains the validation and normalization boundaries used by the tools.

## Docker

Build and run the server as a local stdio container:

```bash
docker build -t savepinner-mcp .
docker run --rm -i savepinner-mcp
```

The runtime image executes as the unprivileged `node` user and does not require secrets, volumes, or network access.

## Example

Calling `parse_pinterest_url` with:

```text
https://de.pinterest.com/pin/987654321/?utm_source=share
```

returns:

```json
{
  "kind": "pin",
  "originalUrl": "https://de.pinterest.com/pin/987654321/?utm_source=share",
  "normalizedUrl": "https://www.pinterest.com/pin/987654321/",
  "host": "de.pinterest.com",
  "pinId": "987654321"
}
```

## Privacy and safety

- URL processing is local to the running server.
- The tools do not make outbound network requests.
- The server does not download media.
- Hostnames are checked against an exact Pinterest domain allow list.
- Lookalike domains and non-HTTPS URLs are rejected.

The URL parser is provided by [`pinterest-url-normalizer`](https://www.npmjs.com/package/pinterest-url-normalizer).

This project is maintained by the team behind the [Pinterest image downloader](https://savepinner.com), a browser tool for inspecting media exposed by public Pinterest Pin URLs.

Pinterest is a trademark of Pinterest, Inc. This project is independent and is not affiliated with or endorsed by Pinterest.

## Development

```bash
npm install
npm test
npm run worker:check
```

## License

MIT
