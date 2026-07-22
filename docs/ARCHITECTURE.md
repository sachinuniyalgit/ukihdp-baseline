# UKIHDP foundation architecture

## Current scope

This repository contains the application foundation only. It deliberately does not contain the final question wording or real project records.

## Main layers

- **Responsive application shell:** field, review, analysis, GIS, and reporting workspaces.
- **Configurable questionnaire model:** versioned sections and questions instead of hard-coded form pages.
- **Offline field store:** IndexedDB-backed drafts with an explicit queue status for later synchronization.
- **PWA shell:** installable manifest and production service worker for basic application-shell availability.
- **Database migration:** Supabase/PostgreSQL-ready roles, questionnaire, submission, response, and sync tables.

## Planned modules

1. Exact household questionnaire for Sections 1-10.
2. Separate Section 11 FPO institutional instrument.
3. Authentication and assignment rules for Admin, Reviewer, and Enumerator.
4. Draft, submit, review, return, correct, and approve workflow.
5. Conflict-safe offline synchronization.
6. Privacy-protected GIS and GPS survey monitoring.
7. Verified-data dashboards and treatment/control analysis.
8. Export and automated standard reports.

## Data rule

The verified database is the single source of truth. Personally identifiable information must not appear in public maps, analytical charts, or reports.
