# Imitatio

A notebook for studying how Ancient Greek and Latin sentences are built. Paste a
passage, get notes on its grammar, syntax and discourse, save the structure as a
reusable pattern, and generate new text that follows it.

Frontend only: no server. LLM calls go from the browser to OpenRouter (Gemini
models) with your own key, and everything is stored locally in IndexedDB.

The full product specification is in [`docs/SPEC.md`](docs/SPEC.md).

## Stack

React 19 · TypeScript · Vite · Tailwind CSS 4 · React Router · Dexie (IndexedDB) ·
Gentium Plus (bundled)

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Typecheck (`tsc --noEmit`) |
| `npm test` | Run unit tests (Node test runner via `tsx`) |

## Layout

```
src/
  app/          routes, layout
  features/     analyze, pattern, notebook, generate, settings
  lib/          llm, db, greek, export
  components/   shared UI
  types/        data model (spec §6, §7)
tests/
```

## Status

| Milestone | State |
|---|---|
| M0 Scaffold | Done |
| M1 Settings and LLM client | Done; live call with a real key still to confirm |
| M2 Analyse | Done; live analysis with a real key still to confirm |
| M3 Notebook | Next |
| M4 Generate | |
| M5 Input and polish | |
