#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { generate } from './index.js';
import { discover } from './parsers/discover.js';
import { loadConfig } from './config.js';
import { watchSpec } from './watch.js';

const program = new Command();

const banner = `
${chalk.cyan('┌─────────────────────────────────────┐')}
${chalk.cyan('│')}  ${chalk.bold.white('mcp-bridge')} ${chalk.dim('v' + process.env.npm_package_version)}              ${chalk.cyan('│')}
${chalk.cyan('│')}  ${chalk.dim('Turn any REST API into an MCP server')} ${chalk.cyan('│')}
${chalk.cyan('└─────────────────────────────────────┘')}
`;

program
  .name('mcp-bridge')
  .description('Turn any REST API into an MCP server in 30 seconds')
  .version(process.env.npm_package_version || '0.1.0');

// ─── generate command ────────────────────────────────────────────────────────

program
  .command('generate')
  .alias('gen')
  .description('Generate an MCP server from an OpenAPI/Swagger spec')
  .option('-s, --spec <path|url>', 'Path or URL to OpenAPI/Swagger spec')
  .option('-o, --out <dir>', 'Output directory', './mcp-server')
  .option('-n, --name <name>', 'Name for the MCP server', 'my-api')
  .option(
    '--filter <tags>',
    'Comma-separated list of tags to include (e.g. "users,products")'
  )
  .option(
    '--exclude <tags>',
    'Comma-separated list of tags to exclude'
  )
  .option(
    '--methods <methods>',
    'Comma-separated list of HTTP methods to include (e.g. "GET,POST")'
  )
  .option(
    '--auth <type>',
    'Auth type: none | bearer | api-key | oauth2',
    'none'
  )
  .option('--auth-env <var>', 'Environment variable name for the auth token')
  .option('--typescript', 'Generate TypeScript output', true)
  .option('--no-typescript', 'Generate JavaScript output')
  .option('-c, --config <path>', 'Path to .mcp-bridge.yml config file')
  .action(async (options) => {
    console.log(banner);

    // Merge with config file if present
    const config = await loadConfig(options.config);
    const merged = { ...config, ...options };

    if (!merged.spec) {
      console.error(chalk.red('✖ Error: --spec is required'));
      console.log(
        chalk.dim('  Example: npx mcp-bridge generate --spec ./openapi.yaml')
      );
      process.exit(1);
    }

    const spinner = ora({
      text: chalk.dim(`Parsing spec: ${merged.spec}`),
      color: 'cyan',
    }).start();

    try {
      const result = await generate({
        spec: merged.spec,
        output: merged.out,
        name: merged.name,
        filter: {
          tags: merged.filter?.split(',').map((t: string) => t.trim()),
          excludeTags: merged.exclude?.split(',').map((t: string) => t.trim()),
          methods: merged.methods?.split(',').map((m: string) => m.trim().toUpperCase()),
        },
        auth: {
          type: merged.auth,
          env: merged.authEnv || 'API_TOKEN',
        },
        typescript: merged.typescript,
        onProgress: (message: string) => {
          spinner.text = chalk.dim(message);
        },
      });

      spinner.succeed(chalk.green('MCP server generated successfully!'));
      console.log('');
      console.log(
        `  ${chalk.bold('Tools generated:')} ${chalk.cyan(result.toolCount)}`
      );
      console.log(`  ${chalk.bold('Output:')}          ${chalk.cyan(result.outputDir)}`);
      console.log('');
      console.log(chalk.dim('  Next steps:'));
      console.log(chalk.dim(`  1. cd ${result.outputDir}`));
      console.log(chalk.dim('  2. npm install'));
      console.log(chalk.dim('  3. Add to your claude_desktop_config.json'));
      console.log('');
      console.log(
        `  ${chalk.dim('See')} ${chalk.underline(result.outputDir + '/README.md')} ${chalk.dim('for setup instructions.')}`
      );
    } catch (err: any) {
      spinner.fail(chalk.red(`Failed: ${err.message}`));
      if (process.env.DEBUG) {
        console.error(err);
      } else {
        console.log(chalk.dim('  Run with DEBUG=1 for more details'));
      }
      process.exit(1);
    }
  });

// ─── discover command ────────────────────────────────────────────────────────

program
  .command('discover')
  .description('Auto-discover API endpoints from a running server (no spec needed)')
  .requiredOption('-u, --url <url>', 'Base URL of the API to discover')
  .option('-o, --out <dir>', 'Output directory', './mcp-server')
  .option('--depth <n>', 'Discovery depth', '2')
  .action(async (options) => {
    console.log(banner);
    const spinner = ora({ text: chalk.dim(`Discovering API at ${options.url}...`), color: 'cyan' }).start();

    try {
      const spec = await discover({ url: options.url, depth: parseInt(options.depth) });
      spinner.text = chalk.dim('Generating MCP server from discovered endpoints...');

      const result = await generate({
        spec,
        output: options.out,
        typescript: true,
      });

      spinner.succeed(chalk.green(`Discovered ${result.toolCount} endpoints and generated MCP server!`));
      console.log(`\n  ${chalk.bold('Output:')} ${chalk.cyan(result.outputDir)}\n`);
    } catch (err: any) {
      spinner.fail(chalk.red(`Discovery failed: ${err.message}`));
      process.exit(1);
    }
  });

// ─── watch command ───────────────────────────────────────────────────────────

program
  .command('watch')
  .description('Watch an OpenAPI spec and re-generate on changes')
  .requiredOption('-s, --spec <path>', 'Path to OpenAPI spec (local file only)')
  .option('-o, --out <dir>', 'Output directory', './mcp-server')
  .action(async (options) => {
    console.log(banner);
    console.log(chalk.cyan(`  Watching ${options.spec} for changes...`));
    console.log(chalk.dim('  Press Ctrl+C to stop\n'));

    await watchSpec({
      spec: options.spec,
      output: options.out,
      onChange: (toolCount: number) => {
        console.log(
          chalk.green(`  ✓ Regenerated ${toolCount} tools`) +
          chalk.dim(` at ${new Date().toLocaleTimeString()}`)
        );
      },
    });
  });

// ─── list command ────────────────────────────────────────────────────────────

program
  .command('list')
  .description('List all tools that would be generated from a spec')
  .requiredOption('-s, --spec <path|url>', 'Path or URL to OpenAPI/Swagger spec')
  .option('--filter <tags>', 'Filter by tags')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const spinner = ora({ text: 'Parsing spec...', color: 'cyan' }).start();
    try {
      const { parseSpec } = await import('./parsers/openapi.js');
      const parsed = await parseSpec(options.spec);
      spinner.stop();

      const tools = parsed.endpoints.map((ep) => ({
        name: ep.operationId,
        method: ep.method.toUpperCase(),
        path: ep.path,
        description: ep.summary || ep.description || '',
        tags: ep.tags,
      }));

      if (options.json) {
        console.log(JSON.stringify(tools, null, 2));
      } else {
        console.log('');
        console.log(chalk.bold(`  ${tools.length} tools would be generated:\n`));
        for (const tool of tools) {
          const methodColor =
            tool.method === 'GET' ? chalk.green :
            tool.method === 'POST' ? chalk.blue :
            tool.method === 'PUT' ? chalk.yellow :
            tool.method === 'DELETE' ? chalk.red : chalk.white;
          console.log(
            `  ${methodColor(tool.method.padEnd(7))} ${chalk.white(tool.name.padEnd(40))} ${chalk.dim(tool.path)}`
          );
        }
        console.log('');
      }
    } catch (err: any) {
      spinner.fail(chalk.red(err.message));
      process.exit(1);
    }
  });

program.parse();
