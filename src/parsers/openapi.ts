import $RefParser from 'json-schema-ref-parser';
import axios from 'axios';
import yaml from 'js-yaml';
import fs from 'fs/promises';
import path from 'path';

export interface ParsedEndpoint {
  operationId: string;
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  parameters: ParsedParameter[];
  requestBody?: ParsedRequestBody;
  responses: Record<string, ParsedResponse>;
  security?: SecurityRequirement[];
}

export interface ParsedParameter {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie';
  required: boolean;
  description?: string;
  schema: JSONSchema;
}

export interface ParsedRequestBody {
  required: boolean;
  description?: string;
  schema: JSONSchema;
  contentType: string;
}

export interface ParsedResponse {
  description: string;
  schema?: JSONSchema;
}

export interface ParsedSpec {
  info: {
    title: string;
    version: string;
    description?: string;
  };
  baseUrl: string;
  endpoints: ParsedEndpoint[];
  components: {
    schemas: Record<string, JSONSchema>;
    securitySchemes: Record<string, SecurityScheme>;
  };
  security?: SecurityRequirement[];
  openApiVersion: '2' | '3';
}

export type JSONSchema = Record<string, unknown>;
export type SecurityRequirement = Record<string, string[]>;
export interface SecurityScheme {
  type: string;
  scheme?: string;
  name?: string;
  in?: string;
  flows?: unknown;
}

let _opIdCounter = 0;

function sanitizeOperationId(method: string, path: string): string {
  _opIdCounter++;
  const parts = path
    .replace(/\{([^}]+)\}/g, 'By$1')
    .split('/')
    .filter(Boolean);
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join('');
  return `${method.toLowerCase()}${pascal || `Operation${_opIdCounter}`}`;
}

/**
 * Parse an OpenAPI 2.x or 3.x spec from a URL, file path, or object.
 */
export async function parseSpec(
  input: string | object
): Promise<ParsedSpec> {
  let raw: Record<string, unknown>;

  if (typeof input === 'object') {
    raw = input as Record<string, unknown>;
  } else if (input.startsWith('http://') || input.startsWith('https://')) {
    const response = await axios.get(input, {
      headers: { Accept: 'application/json, application/yaml, text/yaml' },
      timeout: 15_000,
    });
    const contentType = response.headers['content-type'] || '';
    if (typeof response.data === 'string') {
      raw = yaml.load(response.data) as Record<string, unknown>;
    } else {
      raw = response.data;
    }
  } else {
    const content = await fs.readFile(path.resolve(input), 'utf-8');
    raw = yaml.load(content) as Record<string, unknown>;
  }

  // Dereference all $refs
  const derefed = await $RefParser.dereference(raw as never) as Record<string, unknown>;

  const isV3 = 'openapi' in derefed && String(derefed.openapi).startsWith('3');
  const isV2 = 'swagger' in derefed;

  if (!isV3 && !isV2) {
    throw new Error(
      'Unrecognized spec format. Expected OpenAPI 3.x or Swagger 2.0.'
    );
  }

  return isV3 ? parseV3(derefed) : parseV2(derefed);
}

// ─── OpenAPI 3.x ─────────────────────────────────────────────────────────────

function parseV3(spec: Record<string, unknown>): ParsedSpec {
  const info = spec.info as Record<string, string>;
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>;
  const components = (spec.components || {}) as Record<string, Record<string, unknown>>;

  // Resolve base URL from servers array
  const servers = (spec.servers || []) as Array<{ url: string }>;
  let baseUrl = servers[0]?.url || '/';
  if (baseUrl.startsWith('/')) {
    baseUrl = `https://api.example.com${baseUrl}`;
  }

  const endpoints: ParsedEndpoint[] = [];

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of methods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const operationId =
        (operation.operationId as string) ||
        sanitizeOperationId(method, pathStr);

      const pathParams = (pathItem.parameters || []) as ParsedParameter[];
      const opParams = (operation.parameters || []) as ParsedParameter[];
      const parameters = [...pathParams, ...opParams].map((p: any) => ({
        name: p.name,
        in: p.in,
        required: p.required || p.in === 'path',
        description: p.description,
        schema: p.schema || { type: 'string' },
      }));

      let requestBody: ParsedRequestBody | undefined;
      const rb = operation.requestBody as Record<string, unknown> | undefined;
      if (rb) {
        const content = rb.content as Record<string, { schema: JSONSchema }>;
        const contentType = Object.keys(content)[0] || 'application/json';
        requestBody = {
          required: (rb.required as boolean) || false,
          description: rb.description as string | undefined,
          schema: content[contentType]?.schema || {},
          contentType,
        };
      }

      const responses: Record<string, ParsedResponse> = {};
      const rawResponses = (operation.responses || {}) as Record<
        string,
        Record<string, unknown>
      >;
      for (const [status, resp] of Object.entries(rawResponses)) {
        const content = resp.content as
          | Record<string, { schema: JSONSchema }>
          | undefined;
        const jsonContent = content?.['application/json'];
        responses[status] = {
          description: (resp.description as string) || '',
          schema: jsonContent?.schema,
        };
      }

      endpoints.push({
        operationId,
        method,
        path: pathStr,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        tags: (operation.tags as string[]) || [],
        parameters,
        requestBody,
        responses,
        security: operation.security as SecurityRequirement[] | undefined,
      });
    }
  }

  return {
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    baseUrl,
    endpoints,
    components: {
      schemas: (components.schemas || {}) as Record<string, JSONSchema>,
      securitySchemes: (components.securitySchemes || {}) as Record<
        string,
        SecurityScheme
      >,
    },
    security: spec.security as SecurityRequirement[] | undefined,
    openApiVersion: '3',
  };
}

// ─── Swagger 2.0 ─────────────────────────────────────────────────────────────

function parseV2(spec: Record<string, unknown>): ParsedSpec {
  const info = spec.info as Record<string, string>;
  const paths = (spec.paths || {}) as Record<string, Record<string, unknown>>;
  const definitions = (spec.definitions || {}) as Record<string, JSONSchema>;

  const scheme = ((spec.schemes as string[]) || ['https'])[0];
  const host = (spec.host as string) || 'localhost';
  const basePath = (spec.basePath as string) || '/';
  const baseUrl = `${scheme}://${host}${basePath}`;

  const endpoints: ParsedEndpoint[] = [];

  for (const [pathStr, pathItem] of Object.entries(paths)) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

    for (const method of methods) {
      const operation = pathItem[method] as Record<string, unknown> | undefined;
      if (!operation) continue;

      const operationId =
        (operation.operationId as string) ||
        sanitizeOperationId(method, pathStr);

      const allParams = (operation.parameters || []) as Array<
        Record<string, unknown>
      >;

      const parameters: ParsedParameter[] = allParams
        .filter((p) => p.in !== 'body')
        .map((p) => ({
          name: p.name as string,
          in: p.in as 'path' | 'query' | 'header' | 'cookie',
          required: (p.required as boolean) || p.in === 'path',
          description: p.description as string | undefined,
          schema: (p.schema as JSONSchema) || { type: (p.type as string) || 'string' },
        }));

      const bodyParam = allParams.find((p) => p.in === 'body');
      const requestBody: ParsedRequestBody | undefined = bodyParam
        ? {
            required: (bodyParam.required as boolean) || false,
            description: bodyParam.description as string | undefined,
            schema: (bodyParam.schema as JSONSchema) || {},
            contentType: 'application/json',
          }
        : undefined;

      const rawResponses = (operation.responses || {}) as Record<
        string,
        Record<string, unknown>
      >;
      const responses: Record<string, ParsedResponse> = {};
      for (const [status, resp] of Object.entries(rawResponses)) {
        responses[status] = {
          description: (resp.description as string) || '',
          schema: resp.schema as JSONSchema | undefined,
        };
      }

      endpoints.push({
        operationId,
        method,
        path: pathStr,
        summary: operation.summary as string | undefined,
        description: operation.description as string | undefined,
        tags: (operation.tags as string[]) || [],
        parameters,
        requestBody,
        responses,
        security: operation.security as SecurityRequirement[] | undefined,
      });
    }
  }

  return {
    info: {
      title: info.title,
      version: info.version,
      description: info.description,
    },
    baseUrl,
    endpoints,
    components: {
      schemas: definitions,
      securitySchemes: {},
    },
    security: spec.security as SecurityRequirement[] | undefined,
    openApiVersion: '2',
  };
}
