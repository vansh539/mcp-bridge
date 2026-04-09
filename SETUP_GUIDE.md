# 🚀 Setup Guide — How to Launch mcp-bridge on GitHub

Follow these steps exactly and you'll have a live, polished repo ready to go viral.

---

## Step 1: Personalize the repo

Find and replace `yourusername` with your actual GitHub username in:
- `README.md` (multiple places)
- `package.json` (`repository.url`, `homepage`, `bugs.url`)
- `CONTRIBUTING.md`
- `.github/workflows/ci.yml`
- `src/generators/server.ts` (the generated comment)
- `src/generators/tools.ts` (the generated comment)
- `src/generators/readme.ts` (the generated footer)
- `.github/workflows/sync-mcp.yml`

Also update:
- `package.json`: set your name and email in `author`
- `LICENSE`: replace `Your Name` with your real name

---

## Step 2: Create the GitHub repo

```bash
# 1. Create a new repo on github.com named exactly: mcp-bridge
#    - Set it to Public
#    - Do NOT initialize with README (we have our own)

# 2. Push your code
cd mcp-bridge
git init
git add .
git commit -m "feat: initial release of mcp-bridge"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/mcp-bridge.git
git push -u origin main
```

---

## Step 3: Configure the GitHub repo settings

In your repo settings on GitHub:

**General → Social Preview:**
- Upload `docs/banner.svg` (or a screenshot) as the social preview image

**Topics (must-add for discoverability):**
```
mcp model-context-protocol openapi swagger claude llm ai codegen typescript developer-tools api rest
```

**About section:**
```
Turn any REST API into an MCP server in 30 seconds. Paste an OpenAPI spec, get a working MCP server for Claude, Cursor, Windsurf, and any MCP-compatible AI.
```

**Website:** Your npm package URL once published: `https://www.npmjs.com/package/mcp-bridge`

---

## Step 4: Publish to npm

```bash
npm login   # if not already logged in

# Make sure your package name is available
npm view mcp-bridge   # if it exists, use a scoped name like @yourusername/mcp-bridge

npm publish
```

Once published, update the README badge URLs to use real npm links.

---

## Step 5: Make it work (install deps and verify build)

```bash
npm install
npm run build
node dist/cli.js --version
node dist/cli.js list --spec https://petstore.swagger.io/v2/swagger.json
```

You should see a list of Petstore endpoints. If that works, the tool is functional.

---

## Step 6: Create a demo GIF

This is the **most important step** for going viral. A 30-second terminal GIF showing:

1. `npx mcp-bridge generate --spec https://petstore.swagger.io/v2/swagger.json`
2. The output flying by (tools being generated)
3. The success message: "✓ Generated 18 MCP tools"
4. `ls mcp-server/tools/` showing all the files
5. Claude Desktop opening and the tools appearing

**Tool to record:** Use [Asciinema](https://asciinema.org/) + [agg](https://github.com/asciinema/agg) to convert to GIF, or [Terminalizer](https://github.com/faressoft/terminalizer).

Place the GIF at `docs/demo.gif` and add to README:
```markdown
![demo](docs/demo.gif)
```

---

## Step 7: Share everywhere

Post to these places on the **same day**:

### Reddit
- **r/MachineLearning** — "I built a tool that turns any REST API into an MCP server"
- **r/LocalLLaMA** — Focus on the Claude/Cursor integration angle
- **r/programming** — Lead with the developer productivity angle
- **r/webdev** — "Your API can now be used by AI agents automatically"

### Hacker News
Post as "Show HN: mcp-bridge – Turn any OpenAPI spec into an MCP server (30 seconds, zero config)"

### Twitter/X
Tag: `@AnthropicAI`, `@cursor_ai`, `@codeium`
Hashtags: `#MCP #Claude #OpenAI #DevTools #OpenSource`

### Dev.to / Hashnode
Write a 500-word post: "How I built a tool to instantly connect ANY REST API to Claude"

### Discord Communities
- Anthropic's Discord
- Cursor Discord
- AI Engineers Discord

---

## Step 8: Keep momentum

- Reply to every comment and issue within 24 hours
- Post updates as you ship features (GraphQL support, web UI, etc.)
- Add a `CHANGELOG.md` and post it on Twitter each release
- Reach out to AI newsletter authors (The Rundown AI, tldr;AI, etc.)

---

## What makes this go viral

The timing is perfect. MCP was released by Anthropic in late 2024 and is now the standard for connecting AI to tools. Every developer with an API wants their API to work with Claude — but building an MCP server is annoying and tedious. This solves that in one command.

**The hook:** "One command. Your entire API. Available to Claude."

Good luck! 🌟
