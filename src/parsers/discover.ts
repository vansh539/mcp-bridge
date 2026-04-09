// src/parsers/discover.ts
import axios from 'axios';

interface DiscoverOptions {
  url: string;
  depth?: number;
}

const SPEC_PATHS = [
  '/openapi.json',
  '/openapi.yaml',
  '/swagger.json',
  '/swagger.yaml',
  '/api-docs',
  '/api/openapi.json',
  '/api/swagger.json',
  '/v1/openapi.json',
  '/v2/openapi.json',
  '/v3/openapi.json',
  '/docs/openapi.json',
  '/.well-known/openapi.json',
];

/**
 * Try to auto-discover an OpenAPI spec from a running server.
 * Probes well-known paths and returns the spec object or URL.
 */
export async function discover(options: DiscoverOptions): Promise<string> {
  const { url } = options;
  const base = url.replace(/\/$/, '');

  for (const specPath of SPEC_PATHS) {
    const candidate = `${base}${specPath}`;
    try {
      const response = await axios.get(candidate, {
        timeout: 5_000,
        headers: { Accept: 'application/json, application/yaml, text/yaml, */*' },
        validateStatus: (s) => s === 200,
      });

      const contentType = response.headers['content-type'] || '';
      const data = response.data;

      // Check if it looks like an OpenAPI spec
      const isSpec =
        (typeof data === 'object' && (data.openapi || data.swagger)) ||
        (typeof data === 'string' && (data.includes('openapi:') || data.includes('swagger:')));

      if (isSpec) {
        console.error(`[mcp-bridge] Found spec at ${candidate}`);
        return candidate;
      }
    } catch {
      // Not found at this path, continue
    }
  }

  throw new Error(
    `Could not auto-discover an OpenAPI spec at ${base}.\n` +
      `Tried: ${SPEC_PATHS.join(', ')}\n\n` +
      `Please provide the spec URL directly with --spec.`
  );
}
