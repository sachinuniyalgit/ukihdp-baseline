# UKIHDP Baseline Assessment Platform

Mobile-first research survey and data-management application. The attached master questionnaire is implemented as a configurable household survey and a separate FPO institutional assessment, with local offline draft storage, a PWA shell, and a Supabase-ready database migration.

## Local preview

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in a browser.

- Dashboard: `http://localhost:3000`
- Questionnaire: `http://localhost:3000/survey/new`

## Verification

```bash
pnpm lint
pnpm build
```

## Repository structure

- `src/config/questionnaire-outline.ts` - the 11-section outline only.
- `src/config/questionnaires.ts` - full household and FPO questionnaire configurations.
- `src/components/survey/survey-form.tsx` - configurable field-form renderer.
- `src/lib/survey/types.ts` - configurable form-engine contracts.
- `src/lib/offline-drafts.ts` - browser-based field draft storage and sync queue.
- `public/sw.js` - production PWA application-shell cache.
- `supabase/migrations/0001_foundation.sql` - database-ready schema.
- `docs/ARCHITECTURE.md` - scope and staged roadmap.

## Not yet connected

- Supabase project and real credentials.
- GitHub remote repository.
- Approved District-Block-FPO-Village master data.
- Approved focus-crop and crop-variety masters.
- Approved youth age range, Nali conversion factor, and final indicator traceability matrix.
- GIS results, reviewer screens, analytical dashboards, and automatic reports.

No real respondent or household data is included.
