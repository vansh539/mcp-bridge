# Contributing to mcp-bridge

Thanks for your interest in contributing! This project is at an early stage, and we welcome all contributions.

## Quick Start

```bash
git clone https://github.com/yourusername/mcp-bridge
cd mcp-bridge
npm install
npm run dev
```

## Running Tests

```bash
npm test
npm run test:watch   # re-run on file changes
```

## Project Structure

```
src/
├── cli.ts              # CLI entry point (Commander.js)
├── index.ts            # Public API (generate function)
├── config.ts           # .mcp-bridge.yml loader
├── watch.ts            # Watch mode
├── parsers/
│   ├── openapi.ts      # OpenAPI 2/3 parser + $ref resolver
│   └── discover.ts     # Auto-discovery from running server
└── generators/
    ├── server.ts        # Main MCP server file generator
    ├── tools.ts         # Individual tool file generator
    ├── schemas.ts       # Zod schema generator
    ├── auth.ts          # Auth handler generator
    ├── packageJson.ts   # package.json generator
    └── readme.ts        # README generator
```

## Good First Issues

- Add support for `multipart/form-data` request bodies
- Improve error messages for malformed specs
- Add more auth type examples to the docs
- Write tests for the OpenAPI parser edge cases
- Add support for `$ref`-heavy specs

## Pull Request Guidelines

1. Open an issue first for large changes
2. Write tests for new functionality
3. Keep PRs focused on a single feature or fix
4. Update docs if you're adding user-facing behavior

## Reporting Bugs

Please use the GitHub Issues tab and include:
- Your OS and Node.js version
- The spec URL or file (if possible)
- The exact error message
- What you expected to happen

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
