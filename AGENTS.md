# Repository Guidelines

## Project Structure & Module Organization

- `client/`: React 19 management application using Vite, TypeScript, and Tailwind CSS. Source lives in `src/`, grouped into `pages`, `components`, `hooks`, `api`, and `locales`; static assets live in `public/`.
- `server/`: Express API with TypeScript, Prisma, and PostgreSQL. Keep routes, services, validation, and middleware in their respective `src/` directories. Database schema, migrations, and seeds live in `prisma/`.
- `website/`: independent Astro hotel showcase. Edit hotel content in `src/data/hotel.ts`, layout in `src/pages/index.astro`, styles in `src/styles/global.css`, and images in `public/`.
- `monitoring/`: observability configuration. Root `CAHIER_DE_TEST_*.md` files document manual reservation and invoice checks.

## Build, Test, and Development Commands

Run `npm ci` separately inside each package; there is no root npm workspace. On restricted Windows PowerShell installations, use `npm.cmd`.

- `client/`: `npm run dev` serves port 3000; `npm run build` builds assets; `npm run lint` runs ESLint (including the no-hardcoded-text i18n rule); `npm run typecheck` runs TypeScript checking.
- `server/`: `npm run dev` watches port 4000; `npm run build` generates Prisma types and compiles TypeScript; `npm run db:migrate` creates/applies development migrations.
- `website/`: `npm run dev` serves port 4321; `npm run build` generates `dist/`; `npm run preview` previews the build.
- Root: `make up` starts the Docker management stack. Website deployment is separate; see `website/README.md`.

## Coding Style & Naming Conventions

Use two-space indentation, TypeScript, semicolons, and surrounding quote conventions. Use PascalCase for React components, camelCase for functions, and `use` prefixes for hooks. Follow the client ESLint configuration; put management UI strings in translation files. Validate API input with Zod and centralize HTTP calls in `client/src/api/`.

## Testing Guidelines

No automated test runner, test naming convention, or coverage threshold is configured. Build affected packages, run client type checks when relevant, and follow applicable manual test documents. Check desktop/mobile layouts for visual changes. Record verification and limitations in the PR.

## Commit & Pull Request Guidelines

History uses `feat:`, `fix:`, `docs:`, `test:`, and `release:` prefixes with short English or French descriptions. Follow that pattern. PRs should explain behavior changes, link relevant issues, list verification, and include screenshots for UI changes. Mention migrations and configuration changes explicitly.

## Security & Configuration

Keep secrets in local environment files; never commit credentials. Match `FRONTEND_URL` to the management client origin. Keep public website integrations separate from authenticated management routes. `make clean` deletes database volumes; avoid it for routine cleanup.
