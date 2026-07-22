# UKIHDP Baseline Assessment Platform

Foundation for a mobile-first research survey and data-management application. This stage includes the responsive interface, three-role architecture, a configurable 11-section survey outline, local offline draft storage, a PWA shell, and a Supabase-ready database migration.

The final questionnaire has intentionally not been implemented yet.

## Local preview

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

## Verification

```bash
pnpm lint
pnpm build
```

## Repository structure

- `src/config/questionnaire-outline.ts` - the 11-section outline only.
- `src/lib/survey/types.ts` - configurable form-engine contracts.
- `src/lib/offline-drafts.ts` - browser-based field draft storage and sync queue.
- `public/sw.js` - production PWA application-shell cache.
- `supabase/migrations/0001_foundation.sql` - database-ready schema.
- `docs/ARCHITECTURE.md` - scope and staged roadmap.

## Not yet connected

- Supabase project and real credentials.
- GitHub remote repository.
- Final question text, options, skip logic, and indicator mapping.
- GIS, dashboards, review screens, and automatic reports.

No real respondent or household data is included.
