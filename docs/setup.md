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
npm run db:up      # PostgreSQL + Redis (Redis is not used by any code yet)
npm run dev:stats  # http://localhost:4000/health
```

## Project ID and project root (for connector users)

The connector creates a random anonymous project ID the first time it runs and stores it in `<project folder>/.lens/project-id.json` (ADR 0003).

- Add `.lens/` to the `.gitignore` of **your own** project, or the ID file may be committed and shared by the whole team. (The LENS repo already ignores it.)
- The project folder is `LENS_PROJECT_ROOT` if set, otherwise the working directory of the connector process. If your agent starts the connector from another folder, set `LENS_PROJECT_ROOT`.
- Both tools only read files inside the project folder.
- Set `LENS_PROJECT_ID` to use a fixed ID instead (8-64 letters, digits, `_` or `-`). Never use a project or company name: the ID is sent to the statistics API.
- Anonymity is not absolute: the same project always sends the same ID.
