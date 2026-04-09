import path from 'path';
import fs from 'fs/promises';
import { parseSpec } from './parsers/openapi.js';
import { generateMCPServer } from './generators/server.js';
import { generateTools } from './generators/tools.js';
import { generateSchemas } from './generators/schemas.js';
import { generateAuth } from './generators/auth.js';
import { generatePackageJson } from './generators/packageJson.js';
import { generateReadme } from './generators/readme.js';

export interface GenerateOptions {
  /** Path or URL to OpenAPI/Swagger spec, or a parsed spec object */
  spec: string | object;
  /** Output directory */
  output?: string;
  /** Server name */
  name?: string;
  /** Filter endpoints */
  filter?: {
    tags?: string[];
    excludeTags?: string[];
    methods?: string[];
    paths?: string[];
  };
  /** Auth configuration */
  auth?: {
    type: 'none' | 'bearer' | 'api-key' | 'basic' | 'oauth2';
    env?: string;
    header?: string;
  };
  /** Generate TypeScript (default: true) */
  typescript?: boolean;
  /** Progress callback */
  onProgress?: (message: string) => void;
}

export interface GenerateResult {
  /** Absolute path to the generated output directory */
  outputDir: string;
  /** Number of MCP tools generated */
  toolCount: number;
  /** Names of generated tools */
  toolNames: string[];
}

/**
 * Generate an MCP server from an OpenAPI/Swagger spec.
 *
 * @example
 * ```typescript
 * import { generate } from 'mcp-bridge';
 *
 * const result = await generate({
 *   spec: 'https://petstore.swagger.io/v2/swagger.json',
 *   output: './mcp-server',
 *   auth: { type: 'bearer', env: 'API_TOKEN' },
 * });
 *
 * console.log(`Generated ${result.toolCount} MCP tools`);
 * ```
 */
export async function generate(options: GenerateOptions): Promise<GenerateResult> {
  const {
    spec,
    output = './mcp-server',
    name = 'my-api',
    filter = {},
    auth = { type: 'none' },
    typescript = true,
    onProgress,
  } = options;

  const progress = (msg: string) => onProgress?.(msg);
  const outputDir = path.resolve(output);
  const ext = typescript ? 'ts' : 'js';

  // 1. Parse the spec
  progress('Parsing OpenAPI spec...');
  const parsed = await parseSpec(spec);

  // 2. Apply filters
  progress('Applying filters...');
  let endpoints = parsed.endpoints;

  if (filter.tags && filter.tags.length > 0) {
    endpoints = endpoints.filter((ep) =>
      ep.tags?.some((tag) => filter.tags!.includes(tag))
    );
  }

  if (filter.excludeTags && filter.excludeTags.length > 0) {
    endpoints = endpoints.filter(
      (ep) => !ep.tags?.some((tag) => filter.excludeTags!.includes(tag))
    );
  }

  if (filter.methods && filter.methods.length > 0) {
    endpoints = endpoints.filter((ep) =>
      filter.methods!.includes(ep.method.toUpperCase())
    );
  }

  if (filter.paths && filter.paths.length > 0) {
    endpoints = endpoints.filter((ep) =>
      filter.paths!.some((p) => ep.path.startsWith(p))
    );
  }

  if (endpoints.length === 0) {
    throw new Error(
      'No endpoints matched your filters. Try relaxing the --filter or --methods options.'
    );
  }

  // 3. Create output directory structure
  progress('Creating output directory...');
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(path.join(outputDir, 'tools'), { recursive: true });
  await fs.mkdir(path.join(outputDir, 'schemas'), { recursive: true });

  // 4. Generate Zod schemas
  progress(`Generating schemas for ${endpoints.length} endpoints...`);
  const schemas = await generateSchemas(parsed, { typescript });
  await fs.writeFile(
    path.join(outputDir, 'schemas', `index.${ext}`),
    schemas
  );

  // 5. Generate individual tool files
  progress('Generating MCP tools...');
  const toolNames: string[] = [];
  for (const endpoint of endpoints) {
    const tool = await generateTools(endpoint, parsed, { typescript, auth });
    const toolFile = path.join(outputDir, 'tools', `${endpoint.operationId}.${ext}`);
    await fs.writeFile(toolFile, tool.code);
    toolNames.push(tool.name);
  }

  // 6. Generate auth handler
  progress('Generating auth handler...');
  const authCode = await generateAuth(auth, { typescript });
  await fs.writeFile(path.join(outputDir, `auth.${ext}`), authCode);

  // 7. Generate main server file
  progress('Generating MCP server entry point...');
  const serverCode = await generateMCPServer({
    name,
    endpoints,
    parsed,
    auth,
    typescript,
    toolNames,
  });
  await fs.writeFile(path.join(outputDir, `index.${ext}`), serverCode);

  // 8. Generate package.json
  progress('Generating package.json...');
  const packageJson = generatePackageJson({ name, typescript });
  await fs.writeFile(
    path.join(outputDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // 9. Generate tsconfig (if TypeScript)
  if (typescript) {
    const tsconfig = {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'bundler',
        outDir: './dist',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        declaration: true,
      },
      include: ['*.ts', 'tools/**/*.ts', 'schemas/**/*.ts'],
    };
    await fs.writeFile(
      path.join(outputDir, 'tsconfig.json'),
      JSON.stringify(tsconfig, null, 2)
    );
  }

  // 10. Generate README
  progress('Generating README...');
  const readme = generateReadme({
    name,
    baseUrl: parsed.baseUrl,
    toolCount: endpoints.length,
    toolNames,
    auth,
  });
  await fs.writeFile(path.join(outputDir, 'README.md'), readme);

  // 11. Generate .env.example
  if (auth.type !== 'none') {
    const envExample = `# Auth token for ${parsed.info.title}\n${auth.env || 'API_TOKEN'}=your_token_here\n`;
    await fs.writeFile(path.join(outputDir, '.env.example'), envExample);
  }

  return {
    outputDir,
    toolCount: endpoints.length,
    toolNames,
  };
}

export { parseSpec } from './parsers/openapi.js';
export type { ParsedSpec, ParsedEndpoint } from './parsers/openapi.js';
