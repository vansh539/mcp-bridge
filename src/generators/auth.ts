import type { GenerateOptions } from '../index.js';

type AuthOptions = NonNullable<GenerateOptions['auth']>;

export async function generateAuth(
  auth: AuthOptions,
  options: { typescript: boolean }
): Promise<string> {
  const ts = options.typescript;

  if (auth.type === 'none') {
    return `// No auth configured for this API\nexport function getAuthHeaders()${ts ? ': Record<string, string>' : ''} {\n  return {};\n}\n`;
  }

  if (auth.type === 'bearer') {
    return `/**
 * Bearer token auth.
 * Set the ${auth.env || 'API_TOKEN'} environment variable.
 */
export function getAuthHeaders()${ts ? ': Record<string, string>' : ''} {
  const token = process.env.${auth.env || 'API_TOKEN'};
  if (!token) {
    throw new Error('Missing ${auth.env || 'API_TOKEN'} environment variable');
  }
  return { Authorization: \`Bearer \${token}\` };
}
`;
  }

  if (auth.type === 'api-key') {
    const header = auth.header || 'X-API-Key';
    return `/**
 * API Key auth.
 * Set the ${auth.env || 'API_TOKEN'} environment variable.
 */
export function getAuthHeaders()${ts ? ': Record<string, string>' : ''} {
  const key = process.env.${auth.env || 'API_TOKEN'};
  if (!key) {
    throw new Error('Missing ${auth.env || 'API_TOKEN'} environment variable');
  }
  return { '${header}': key };
}
`;
  }

  if (auth.type === 'basic') {
    return `/**
 * HTTP Basic auth.
 * Set API_USERNAME and API_PASSWORD environment variables.
 */
export function getAuthHeaders()${ts ? ': Record<string, string>' : ''} {
  const username = process.env.API_USERNAME || '';
  const password = process.env.API_PASSWORD || '';
  const encoded = Buffer.from(\`\${username}:\${password}\`).toString('base64');
  return { Authorization: \`Basic \${encoded}\` };
}
`;
  }

  return `export function getAuthHeaders()${ts ? ': Record<string, string>' : ''} { return {}; }\n`;
}
