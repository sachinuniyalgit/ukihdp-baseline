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
- Admin master data: `http://localhost:3000/admin/master-data`

## Verification

```bash
pnpm lint
pnpm build
```

## Repository structure

- `src/config/questionnaire-outline.ts` - the 11-section outline only.
- `src/config/questionnaires.ts` - full household and FPO questionnaire configurations.
- `src/components/survey/survey-form.tsx` - configurable field-form renderer.
- `src/components/survey/focus-crop-modules.tsx` - annual cycle and perennial orchard focus-crop workflow.
- `src/config/crop-master.ts` - initial approved focus-crop classifications.
- `src/lib/admin-master-data.ts` - locally configurable study definitions and audit history.
- `src/lib/survey/types.ts` - configurable form-engine contracts.
- `src/lib/offline-drafts.ts` - browser-based field draft storage and sync queue.
- `public/sw.js` - production PWA application-shell cache.
- `supabase/migrations/0001_foundation.sql` - database-ready schema.
- `docs/ARCHITECTURE.md` - scope and staged roadmap.

## Not yet connected

- Supabase project and real credentials.
- Full non-focus crop and crop-variety masters.
- Approved youth age range, Nali conversion factor, and final indicator traceability matrix.
- GIS results, reviewer screens, analytical dashboards, and automatic reports.

The Admin screen intentionally leaves the youth range and Nali conversion factors pending until the project confirms them. It never invents crop varieties or benchmark yields. Before production use, Supabase authentication and Admin-only authorization must protect master-data changes; the current screen is a local configuration preview.

No real respondent or household data is included.

The configured geographic master includes 4 districts, 16 FPOs, CBBOs, block aliases, focus crops, and the supplied village lists.

Section 3 now uses a short all-crop roster and automatically opens detailed modules only for crops that match the selected FPO. Annual crops retain separate crop-cycle records; perennial crops use an orchard profile. Sections 4-6 store their answers in records linked to the generated Focus Crop ID.
