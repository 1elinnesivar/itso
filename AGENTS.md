# Repository Guidelines

## Project Structure & Module Organization

This repository contains a Turkish, multi-user furniture membership tracker. Next.js App Router pages live in `app/`; reusable UI and feature components are in `components/`; Supabase clients, validation, Excel mapping, and table helpers belong in `lib/`. Shared TypeScript models are in `types/`, database migrations in `supabase/migrations/`, and tests in `tests/`.

`mobilya-takip.xlsx` is confidential source data. It is intentionally ignored and must never be committed, copied into fixtures, or exposed in logs.

## Build, Test, and Development Commands

```powershell
npm install          # install dependencies
npm run dev          # start Next.js locally
npm run typecheck    # check strict TypeScript
npm test             # run Vitest unit tests
npm run build        # create the production build
```

Copy `.env.example` to `.env.local` and supply the Supabase URL and publishable key before running the app. Apply SQL migrations with the Supabase CLI or Dashboard before signing in.

## Coding Style & Naming Conventions

Use TypeScript with two-space indentation and trailing commas. Components use PascalCase; functions, hooks, and variables use camelCase; database fields and SQL functions use snake_case. Prefer `@/` imports. Keep server-only secrets outside `NEXT_PUBLIC_*`; the service-role key must never appear in browser code.

Use shadcn/ui primitives from `components/ui/` and Tailwind utilities for styling. Preserve Turkish labels and use `normalizeText` for locale-aware searching. Store multiline notes and phone values with LF (`\n`) line endings.

## Testing Guidelines

Place unit tests in `tests/*.test.ts`. Cover Excel header mapping, Turkish normalization, filters, role boundaries, and version-conflict behavior. Database changes require RLS tests for admin, editor, viewer, and anonymous sessions. Never use production personal data in tests.

## Commit & Pull Request Guidelines

Use short imperative commits such as `feat: add contact owner filter` or `db: enforce optimistic locking`. Pull requests must describe behavior and schema changes, list validation commands, and include screenshots for UI changes with all personal data redacted. Call out new environment variables and migration order explicitly.

## Security

Keep the GitHub repository private. Do not commit `.env*`, workbooks, exports, or Excel lock files. All database writes must pass through role-checked RPCs, RLS must remain enabled, and audit records must be admin-readable only.
