# FieldFlow Survey Management Platform

FieldFlow is a mobile-first, multi-study research data-management application. The built-in study is the detailed UKIHDP household and FPO baseline assessment; its finalized questionnaire is preserved while the surrounding platform supports reusable studies, user assignments, offline fieldwork, quality review, GIS, analytics, and automatic reports.

No real respondent or household data is included in this repository.

## Implemented workspaces

- Role-specific dashboards for Administrator, Researcher/Study Manager, Supervisor, Reviewer, and Enumerator.
- Protected UKIHDP household/FPO questionnaire with 222 configured fields plus repeating household and crop groups.
- District → Block → FPO → Village project master data for 4 districts and 16 FPOs.
- Multi-study catalogue, study command centre, XLSX/CSV questionnaire import, validation, publication, and version replacement.
- Offline IndexedDB drafts, pending-sync states, conflict-aware upload, reconnect synchronization, and production PWA shell.
- Reviewer flow: Draft → Submitted → Under Review → Returned/Approved.
- Real Leaflet/OpenStreetMap GIS with privacy-safe survey popups, clustering, filters, study/project sites, concern locations, and layer controls.
- Verified-data analytics for collection status, treatment/control coverage, districts, focus crops, key indicators, and quality flags.
- Automatic standard report preview and PDF/DOCX export using stored data—no quantitative re-entry.
- User profile, role, activation, password-reset, and study-assignment administration.

## Local preview

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

- Dashboard: `/`
- Sign in/account request: `/login`
- Studies: `/studies`
- Household/FPO questionnaire: `/survey/new`
- Local drafts and sync queue: `/drafts`
- Reviewer queue: `/review`
- GIS monitoring: `/gis`
- Results and analytics: `/analytics`
- Automatic reports: `/reports`
- User management: `/admin/users`
- Master data: `/admin/master-data`

### Local role testing

The login page can display one-click test accounts for all five roles when `NEXT_PUBLIC_ENABLE_TEST_LOGIN=true` is set in the ignored `.env.development.local` file. This feature is restricted to the Next.js development environment; a production build cannot activate it.

These identities use local browser state only. They cannot read, synchronize, approve, or change production Supabase data. Use real approved Supabase accounts for end-to-end central workflow testing.

## Supabase setup

1. Create a Supabase project.
2. Run all SQL files in `supabase/migrations` in numerical order. The extended role enum is intentionally committed in migration `0006` before the multi-study schema and policies in `0007`.
3. Copy `.env.example` to `.env.local` and add the public project URL and publishable key. Never use the service-role key in browser configuration.
4. Restart the application and open `/login`.
5. If no Administrator exists, use the one-time Administrator setup. Later users request a role and remain inactive until an Administrator approves them and assigns studies/locations.

## Field workflow

1. Enumerator opens an assigned published study while online at least once.
2. The production PWA caches the field application shell and stable assets.
3. Questionnaire answers save automatically to IndexedDB, including while offline.
4. Closing or reloading the app does not delete the local draft; it can be reopened from **My Drafts**.
5. Completing a survey places it in the pending-sync queue.
6. Reconnection triggers an authenticated, duplicate-safe upload using the client-generated survey ID and server revision.
7. Reviewer/Supervisor checks data quality, returns corrections, or approves the record.
8. Only verified data feeds approved-result indicators and reports.

## Questionnaire import workbook

Download the template from **Studies → New study**. It supports:

- `STUDY`
- `SECTIONS`
- `QUESTIONS`
- `OPTIONS`
- `SKIP_LOGIC`
- `CALCULATIONS`
- `MASTER_DATA_LINKS`

Imports are parsed locally, validated for duplicate IDs, invalid types, missing references, circular skip logic, calculations, and master-data links, then previewed before publication. New versions preserve historical server questionnaire versions and responses.

## Verification

```bash
pnpm lint
pnpm build
```

The implementation has also been browser-tested at desktop and mobile sizes for all five role dashboards, questionnaire rendering, access restrictions, GIS layers, PDF/DOCX exports, IndexedDB draft persistence, and production offline-shell reopening.

## Key files

- `src/config/questionnaires.ts` — protected UKIHDP household and FPO definitions.
- `src/config/project-master.ts` — districts, blocks, 16 FPOs, CBBOs, focus crops, and villages.
- `src/components/survey/` — built-in and imported questionnaire renderers.
- `src/components/studies/` — study catalogue, command centre, creation, import, and version editing.
- `src/lib/offline-drafts.ts` and `src/lib/survey-sync.ts` — device storage and synchronization.
- `src/components/gis/` — real GIS workspace and privacy-safe mapping.
- `src/components/insights/` — analytics and automatic reports.
- `public/sw.js` — production offline application shell and stable-asset caching.
- `supabase/migrations/` — authentication, RLS, multi-study, profile, assignment, GIS, and questionnaire schema.

## Confirm before field deployment

- Apply migrations `0006` and `0007` to the production Supabase project.
- Confirm the approved youth age range and official Nali conversion factor.
- Complete crop/variety masters, indicator traceability, and validated benchmark-yield sources.
- Pilot on the actual Android phones in offline/poor-network locations.
- Approve privacy, consent, backup, retention, incident-response, and account-assignment procedures.
- Configure production hosting/domain and run an authenticated end-to-end pilot before collecting real household data.
