// src/config.ts
import fs from 'fs/promises';
import path from 'path';
import yaml from 'js-yaml';

export interface BridgeConfig {
  spec?: string;
  output?: string;
  name?: string;
  filter?: { tags?: string[]; excludeTags?: string[]; methods?: string[] };
  auth?: { type: string; env?: string; header?: string };
  typescript?: boolean;
  watch?: boolean;
}

export async function loadConfig(configPath?: string): Promise<BridgeConfig> {
  const candidates = configPath
    ? [configPath]
    : ['.mcp-bridge.yml', '.mcp-bridge.yaml', '.mcp-bridge.json'];

  for (const candidate of candidates) {
    try {
      const content = await fs.readFile(path.resolve(candidate), 'utf-8');
      if (candidate.endsWith('.json')) {
        return JSON.parse(content);
      }
      return yaml.load(content) as BridgeConfig;
    } catch {
      // File not found — try next
    }
  }

  return {};
}
