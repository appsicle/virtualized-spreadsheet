# Spreadsheet (React + TypeScript + Vite)

Fast, virtualized spreadsheet prototype with a minimal formula engine, dependency graph, and robust editing UX.

**Run It**
- Prerequisites: Node.js 18+ and npm 9+
- Install deps: `npm install`
- Start dev server: `npm run dev` (opens on http://localhost:5173)
- Build for production: `npm run build`
- Preview the build: `npm run preview`
- Lint: `npm run lint`
- Format: `npm run format`

Vite alias `@` points to `src/` (see `vite.config.ts`).

**Core Decisions**
- Architecture: feature‑first. Spreadsheet logic is encapsulated in `src/features/sheet`.
  - UI: `src/features/sheet/components` (Grid, Header menus, Formula/Status/Toolbar)
  - State: `src/features/sheet/store.tsx`, `src/features/sheet/context.ts`, `src/features/sheet/hooks.ts`
  - Formula engine: `src/features/sheet/utils` (parser, tokenizer, evaluator, graph, refs)
  - Constants: `src/features/sheet/constants.ts` (`CELL_W`, `CELL_H`, `HEADER_W`, `HEADER_H`)

- Dependency graph + recompute:
  - Each formula evaluation returns its referenced cells (deps). We update edges with `setDeps` and recompute affected nodes in topological order.
  - Files: `src/features/sheet/utils/dependencyGraph.ts` and `src/features/sheet/store.tsx`.

- Error semantics:
  - `#DIV/0!`, `#VALUE!` returned from evaluator (`src/features/sheet/utils/evaluator.ts`).
  - `#CYCLE` on topological cycles (`topoOrder` returns a cyclic set).
  - `#REF!` for structural deletes (row/column). We rebase ASTs so refs/ranges that hit a deleted axis become error nodes. Files: `src/features/sheet/utils/rebase.ts`, `src/features/sheet/utils/evaluator.ts`.
  - Clearing a referenced cell (Backspace/Delete on a value) is not structural; formulas recompute with blanks coerced to 0.

- Virtualization:
  - Uses TanStack Virtual for rows/columns. Hooks compute visible cells and absolute positioning. Files: `src/features/sheet/components/Grid/hooks/*`.

- Editing model:
  - Local editing buffer via `EditingProvider` to keep Formula Bar and Cell input in sync. Files: `src/features/sheet/editing.tsx`.
  - Grid handles keyboard nav, range selection, ref/range insertion during formula edits.

- Persistence:
  - Minimal localStorage snapshot of `input` strings under key `spreadsheet:v1`. File: `src/features/sheet/store.tsx`.

**File Map (Selected)**
- App entry: `src/App.tsx` (wires `SheetProvider` and `EditingProvider`)
- Feature barrel: `src/features/sheet/index.ts`
- Grid: `src/features/sheet/components/Grid/Grid.tsx`
- Virtual cells: `src/features/sheet/components/Grid/VirtualCells.tsx`
- Cell components: `src/features/sheet/components/Grid/Cell/*`
- Selection utils: `src/features/sheet/components/Grid/Cell/utils/*`
- Graph ops: `src/features/sheet/utils/dependencyGraph.ts`
- Parser/tokenizer: `src/features/sheet/utils/{parser,tokenizer}.ts`
- Evaluator: `src/features/sheet/utils/evaluator.ts`
- Rebase on delete: `src/features/sheet/utils/rebase.ts`
- A1 helpers: `src/features/sheet/utils/refs.ts`

**Conventions**
- Keep UI components pure; side effects and state changes flow through store actions.
- Prefer granular hooks (`useSelection`, `useCells`, `useDims`, `useGraph`) to minimize re‑renders.
- Co-locate domain logic inside feature folders. Shared, generic UI would live under `src/components/ui` (not yet needed here).

**Scripts**
- `dev`: start Vite dev server
- `build`: type-check + bundling (rolldown-vite under the hood)
- `preview`: serve the production bundle locally
- `lint`, `format`, `format:check`: repo hygiene

**Notes**
- This repo removed dev‑only instrumentation from `index.html` (no remote scripts by default).
- Path alias `@/*` is configured in both `vite.config.ts` and `tsconfig.app.json`.
