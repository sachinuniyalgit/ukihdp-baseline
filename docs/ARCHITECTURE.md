# UKIHDP foundation architecture

## Current scope

This repository contains the implemented household and FPO questionnaire foundation. It contains no real respondent or household records.

## Main layers

- **Responsive application shell:** field, review, analysis, GIS, and reporting workspaces.
- **Configurable questionnaire model:** versioned sections and questions instead of hard-coded form pages.
- **Offline field store:** IndexedDB-backed drafts with an explicit queue status for later synchronization.
- **PWA shell:** installable manifest and production service worker for basic application-shell availability.
- **Focus-crop engine:** short all-crop roster, automatic FPO matching, annual crop cycles, perennial orchard profiles, calculations, and linked Sections 4-6.
- **Controlled master data:** configurable youth definition, Nali conversion, crops, varieties, FPO mappings, and audit history.
- **Database migrations:** Supabase/PostgreSQL-ready roles, questionnaire, submission, response, sync, crop-master, crop-cycle, and linked-response tables.

## Planned modules

1. Connect Supabase authentication and assignment rules for Admin, Reviewer, and Enumerator.
2. Connect the current draft/queue UI to server-side submit, review, return, correct, and approve operations.
3. Implement conflict-safe synchronization against server revisions.
4. Build privacy-protected GIS and GPS survey monitoring.
5. Build verified-data dashboards and treatment/control analysis.
6. Add export and automated standard reports.

## Data rule

The verified database is the single source of truth. Personally identifiable information must not appear in public maps, analytical charts, or reports.
