# Developer setup

Requirements: Node.js 22 (see `.nvmrc`), npm 10+, Git. Docker is only needed for the statistics backend.

```bash
git clone <repo-url> && cd lens
nvm use            # or install Node 22 manually (Windows: nvm-windows)
npm install
npm run check      # lint + format + build + tests
```

Run the connector over stdio (for an MCP client or the MCP Inspector):

```bash
npm run dev:connector
npx @modelcontextprotocol/inspector npx tsx packages/connector/src/main.ts
```

Run the statistics API:

```bash
cp .env.example .env
npm run db:up      # PostgreSQL + Redis (optional in Sprint 1)
npm run dev:stats  # http://localhost:4000/health
```
