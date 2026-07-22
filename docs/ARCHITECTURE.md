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

## Implemented operational foundation

1. Supabase email/password authentication with Admin, Reviewer, and Enumerator access gates.
2. Local draft recovery, queued submission, automatic reconnect sync, and central status refresh.
3. Conflict-safe synchronization using client IDs and server revisions.
4. Reviewer transitions for submitted, under-review, returned, and approved records, with review-event history.
5. Database policies that isolate enumerator records and reserve management actions for Reviewer/Admin roles.

## Planned modules

1. Build privacy-protected GIS and GPS survey monitoring.
2. Build verified-data dashboards and treatment/control analysis.
3. Add export and automatic standard reports.
4. Add server-managed master-data editing and user-role administration screens.

## Data rule

The verified database is the single source of truth. Personally identifiable information must not appear in public maps, analytical charts, or reports.
