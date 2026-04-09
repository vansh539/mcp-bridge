// src/generators/schemas.ts
import type { ParsedSpec } from '../parsers/openapi.js';
import { jsonSchemaToZod } from './server.js';

export async function generateSchemas(
  spec: ParsedSpec,
  options: { typescript: boolean }
): Promise<string> {
  const { schemas } = spec.components;
  const entries = Object.entries(schemas);

  if (entries.length === 0) {
    return `import { z } from 'zod';\n\nexport const schemas = {};\n`;
  }

  const schemaLines = entries.map(([name, schema]) => {
    try {
      const zodExpr = jsonSchemaToZod(schema as Record<string, unknown>);
      return `export const ${sanitizeName(name)}Schema = ${zodExpr};`;
    } catch {
      return `// Could not generate schema for ${name}`;
    }
  });

  return `import { z } from 'zod';\n\n${schemaLines.join('\n\n')}\n`;
}

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_');
}
