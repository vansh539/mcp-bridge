// src/watch.ts
import chokidar from 'chokidar';
import { generate } from './index.js';

interface WatchOptions {
  spec: string;
  output: string;
  onChange: (toolCount: number) => void;
}

export async function watchSpec(options: WatchOptions): Promise<void> {
  const { spec, output, onChange } = options;

  const run = async () => {
    try {
      const result = await generate({ spec, output });
      onChange(result.toolCount);
    } catch (err: any) {
      console.error(`[mcp-bridge] Re-generate failed: ${err.message}`);
    }
  };

  // Run once immediately
  await run();

  // Watch for changes
  chokidar.watch(spec, { ignoreInitial: true }).on('change', run);

  // Keep process alive
  await new Promise(() => {});
}
