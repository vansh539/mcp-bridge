import { parseSpec } from '../src/parsers/openapi.js';
import { jsonSchemaToZod } from '../src/generators/server.js';
import { generate } from '../src/index.js';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';

// ─── Minimal inline spec for testing ─────────────────────────────────────────

const petstore: object = {
  openapi: '3.0.0',
  info: { title: 'Petstore', version: '1.0.0' },
  servers: [{ url: 'https://petstore.example.com/v1' }],
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        summary: 'List all pets',
        tags: ['pets'],
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', maximum: 100 },
          },
        ],
        responses: {
          '200': { description: 'A list of pets' },
        },
      },
      post: {
        operationId: 'createPet',
        summary: 'Create a pet',
        tags: ['pets'],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: { type: 'string' },
                  tag: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Created' },
        },
      },
    },
    '/pets/{petId}': {
      get: {
        operationId: 'getPet',
        summary: 'Get a pet by ID',
        tags: ['pets'],
        parameters: [
          {
            name: 'petId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'A pet' },
          '404': { description: 'Not found' },
        },
      },
    },
  },
};

// ─── parseSpec ────────────────────────────────────────────────────────────────

describe('parseSpec', () => {
  it('parses a minimal OpenAPI 3.x spec', async () => {
    const parsed = await parseSpec(petstore);
    expect(parsed.openApiVersion).toBe('3');
    expect(parsed.info.title).toBe('Petstore');
    expect(parsed.baseUrl).toBe('https://petstore.example.com/v1');
    expect(parsed.endpoints).toHaveLength(3);
  });

  it('assigns operationIds when missing', async () => {
    const spec = {
      openapi: '3.0.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {
        '/users/{id}': {
          get: {
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const parsed = await parseSpec(spec);
    expect(parsed.endpoints[0].operationId).toBeTruthy();
    expect(typeof parsed.endpoints[0].operationId).toBe('string');
  });

  it('extracts parameters correctly', async () => {
    const parsed = await parseSpec(petstore);
    const listPets = parsed.endpoints.find((e) => e.operationId === 'listPets')!;
    expect(listPets.parameters).toHaveLength(1);
    expect(listPets.parameters[0].name).toBe('limit');
    expect(listPets.parameters[0].in).toBe('query');
    expect(listPets.parameters[0].required).toBe(false);
  });

  it('extracts requestBody correctly', async () => {
    const parsed = await parseSpec(petstore);
    const createPet = parsed.endpoints.find((e) => e.operationId === 'createPet')!;
    expect(createPet.requestBody).toBeDefined();
    expect(createPet.requestBody!.required).toBe(true);
  });

  it('extracts path parameters as required', async () => {
    const parsed = await parseSpec(petstore);
    const getPet = parsed.endpoints.find((e) => e.operationId === 'getPet')!;
    const petIdParam = getPet.parameters.find((p) => p.name === 'petId')!;
    expect(petIdParam.required).toBe(true);
  });

  it('parses Swagger 2.0 specs', async () => {
    const swaggerSpec = {
      swagger: '2.0',
      info: { title: 'Old API', version: '1.0' },
      host: 'api.example.com',
      basePath: '/v1',
      schemes: ['https'],
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            tags: ['users'],
            parameters: [],
            responses: { '200': { description: 'ok' } },
          },
        },
      },
    };
    const parsed = await parseSpec(swaggerSpec);
    expect(parsed.openApiVersion).toBe('2');
    expect(parsed.baseUrl).toBe('https://api.example.com/v1');
    expect(parsed.endpoints[0].operationId).toBe('getUsers');
  });
});

// ─── jsonSchemaToZod ──────────────────────────────────────────────────────────

describe('jsonSchemaToZod', () => {
  it('converts string', () => {
    expect(jsonSchemaToZod({ type: 'string' })).toBe('z.string()');
  });

  it('converts integer', () => {
    expect(jsonSchemaToZod({ type: 'integer' })).toBe('z.number().int()');
  });

  it('converts number with bounds', () => {
    expect(jsonSchemaToZod({ type: 'number', minimum: 0, maximum: 100 })).toBe(
      'z.number().min(0).max(100)'
    );
  });

  it('converts boolean', () => {
    expect(jsonSchemaToZod({ type: 'boolean' })).toBe('z.boolean()');
  });

  it('converts array of strings', () => {
    expect(jsonSchemaToZod({ type: 'array', items: { type: 'string' } })).toBe(
      'z.array(z.string())'
    );
  });

  it('converts enum', () => {
    expect(jsonSchemaToZod({ type: 'string', enum: ['a', 'b', 'c'] })).toBe(
      'z.enum(["a", "b", "c"])'
    );
  });

  it('converts simple object', () => {
    const result = jsonSchemaToZod({
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string' },
        age: { type: 'integer' },
      },
    });
    expect(result).toContain('"name": z.string()');
    expect(result).toContain('"age": z.number().int().optional()');
  });

  it('converts string with format: email', () => {
    expect(jsonSchemaToZod({ type: 'string', format: 'email' })).toBe(
      'z.string().email()'
    );
  });

  it('converts string with format: uuid', () => {
    expect(jsonSchemaToZod({ type: 'string', format: 'uuid' })).toBe(
      'z.string().uuid()'
    );
  });

  it('returns z.unknown() for unknown types', () => {
    expect(jsonSchemaToZod({ type: 'exotic-type' as 'string' })).toBe('z.unknown()');
  });
});

// ─── generate (integration) ───────────────────────────────────────────────────

describe('generate', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mcp-bridge-test-'));
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it('generates an MCP server from an inline spec', async () => {
    const result = await generate({
      spec: petstore,
      output: tmpDir,
      name: 'test-petstore',
      typescript: true,
    });

    expect(result.toolCount).toBe(3);
    expect(result.toolNames).toContain('listPets');
    expect(result.toolNames).toContain('createPet');
    expect(result.toolNames).toContain('getPet');
    expect(result.outputDir).toBe(tmpDir);
  });

  it('writes expected files to output directory', async () => {
    await generate({ spec: petstore, output: tmpDir });

    const files = await fs.readdir(tmpDir);
    expect(files).toContain('index.ts');
    expect(files).toContain('package.json');
    expect(files).toContain('tsconfig.json');
    expect(files).toContain('README.md');

    const tools = await fs.readdir(path.join(tmpDir, 'tools'));
    expect(tools).toContain('listPets.ts');
    expect(tools).toContain('createPet.ts');
    expect(tools).toContain('getPet.ts');
  });

  it('applies tag filters', async () => {
    const result = await generate({
      spec: petstore,
      output: tmpDir,
      filter: { tags: ['pets'] },
    });
    expect(result.toolCount).toBe(3); // all endpoints have 'pets' tag
  });

  it('applies method filters', async () => {
    const result = await generate({
      spec: petstore,
      output: tmpDir,
      filter: { methods: ['GET'] },
    });
    expect(result.toolCount).toBe(2); // listPets + getPet
  });

  it('throws when no endpoints match filters', async () => {
    await expect(
      generate({
        spec: petstore,
        output: tmpDir,
        filter: { tags: ['nonexistent-tag'] },
      })
    ).rejects.toThrow('No endpoints matched');
  });

  it('generates JavaScript output when typescript: false', async () => {
    await generate({ spec: petstore, output: tmpDir, typescript: false });
    const files = await fs.readdir(tmpDir);
    expect(files).toContain('index.js');
    expect(files).not.toContain('tsconfig.json');
  });

  it('generates .env.example when auth is configured', async () => {
    await generate({
      spec: petstore,
      output: tmpDir,
      auth: { type: 'bearer', env: 'MY_TOKEN' },
    });
    const files = await fs.readdir(tmpDir);
    expect(files).toContain('.env.example');
    const envExample = await fs.readFile(path.join(tmpDir, '.env.example'), 'utf-8');
    expect(envExample).toContain('MY_TOKEN');
  });
});
