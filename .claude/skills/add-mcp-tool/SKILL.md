---
name: add-mcp-tool
description: Step-by-step recipe for adding an MCP tool to the mcp/ server so the /chat endpoint's LLM can use it, including tests. Use whenever a task adds or changes an MCP tool.
---

# Add an MCP tool

The chat flow: web → `POST /chat` (api) → LLM picks a tool → API's MCP client calls `mcp/` over
Streamable HTTP with an internal JWT carrying the user id → tool runs a shared repository function.

1. **Input schema** — reuse or add a zod schema in `shared/src/schemas/`. Tool inputs must never contain a
   user id; the user comes from the verified internal token (`extra.authInfo`).
2. **Implement** — register the tool in `mcp/src/tools.ts` with `server.registerTool(name, { title,
description, inputSchema }, handler)`.
   - `description` is what the LLM reads: say when to use the tool and what each argument means
     (e.g. amounts are in major units like `12.50`).
   - The handler calls a repository from `@ft/shared/db` with the user id and returns
     `{ content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result }`.
   - Domain errors (e.g. unknown account) return `isError: true` with a readable message.
3. **Test** — add cases to `mcp/test/tools.test.ts` with the MCP SDK client helper:
   the tool is listed, the happy path writes / reads the right rows, and data of another user is not visible.
4. **Chat coverage** — if the tool introduces a new chat capability, add a scripted `FakeLlm` scenario in
   `api/test/chat.test.ts` proving the end-to-end path (API → MCP → DB).
5. **Verify** — `pnpm --filter @ft/mcp test && pnpm --filter @ft/api test`, then commit.
