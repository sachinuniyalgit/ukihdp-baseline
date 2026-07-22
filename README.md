# UKIHDP Baseline Assessment Platform

Mobile-first household and FPO baseline data-collection application. It includes the finalized questionnaire structure, offline drafts, installable PWA support, secure role foundations, conflict-aware synchronization, and a reviewer approval workflow.

No real respondent or household data is included.

## Local preview

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

- Dashboard: `/`
- Sign in: `/login`
- Household/FPO questionnaire: `/survey/new`
- Local drafts and sync queue: `/drafts`
- Reviewer queue: `/review`
- Admin master data: `/admin/master-data`

Without Supabase credentials the application intentionally uses local preview mode. Questionnaire drafts and the PWA work on the device; central login, synchronization, and review activate after the setup below.

## Supabase setup

1. Create a Supabase project.
2. Run the SQL migrations in numerical order:
   - `supabase/migrations/0001_foundation.sql`
   - `supabase/migrations/0002_crop_master_and_relations.sql`
   - `supabase/migrations/0003_auth_sync_and_rls.sql`
   - `supabase/migrations/0004_secure_admin_bootstrap.sql`
3. Copy `.env.example` to `.env.local` and insert the project's public URL and publishable key. Older projects can still use `NEXT_PUBLIC_SUPABASE_ANON_KEY` as a fallback.
4. Restart the application and open `/login`.
5. Use the one-time **Create first Administrator** form. If email confirmation is enabled, confirm the Supabase email and then sign in.

The first authenticated owner can claim the Administrator role only while no active Administrator exists. The database closes this bootstrap path permanently after the first claim. Later users receive the Enumerator role in an inactive state until an Administrator authorizes them. Row-level security prevents enumerators from viewing other enumerators' submissions and restricts review actions to Reviewer/Admin accounts.

Never put the Supabase service-role key in `.env.local` or browser code.

## Current workflow

1. Enumerator fills the mobile questionnaire online or offline.
2. Answers save automatically to IndexedDB on the device.
3. Submit places the survey in the local synchronization queue.
4. When authenticated internet access is available, the app uploads the complete versioned payload.
5. A Reviewer/Admin starts review, returns it with a correction note, or approves it.
6. Returned status reaches the enumerator's local drafts; the record can be corrected and resubmitted.
7. Server revisions prevent an older local copy from silently overwriting newer central data.

## Verification

```bash
pnpm lint
pnpm build
```

## Key files

- `src/config/questionnaires.ts` — household and FPO questionnaire definitions.
- `src/components/survey/survey-form.tsx` — configurable field-form renderer and draft recovery.
- `src/components/survey/focus-crop-modules.tsx` — annual crop-cycle and perennial orchard workflows.
- `src/config/project-master.ts` — 4 districts, 16 FPOs, CBBOs, focus crops, blocks, and supplied villages.
- `src/lib/offline-drafts.ts` — IndexedDB field storage.
- `src/lib/survey-sync.ts` — authenticated sync, revision checks, and status refresh.
- `src/components/auth/` — session, role, and route protection.
- `src/components/operations/` — drafts/sync and review workspaces.
- `public/sw.js` — offline application-shell service worker.
- `supabase/migrations/` — schema, crop relationships, authentication trigger, and RLS policies.
- `docs/ARCHITECTURE.md` — architecture and remaining modules.

## Confirm before field deployment

- Approved youth age range.
- Official Nali conversion factor.
- Complete non-focus crop and crop-variety masters.
- Final indicator traceability matrix and validated benchmark-yield sources.
- Field pilot on the actual Android devices and browsers.
- Privacy, consent, backup, retention, and account-assignment procedures.

GIS dashboards, verified-data analytics, exports, and automatic reports remain separate future modules. The current update deliberately establishes the secure collection-to-review foundation first.
