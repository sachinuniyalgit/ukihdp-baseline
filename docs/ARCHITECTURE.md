# FieldFlow architecture

## Scope

FieldFlow is a generic multi-study field-research platform with one protected built-in study: the UKIHDP baseline assessment. New studies and versioned questionnaires are configuration, not new hard-coded application pages.

## Layers

1. **Identity and access:** Supabase Auth, complete user profiles, platform roles, active/inactive state, and study-specific assignments.
2. **Study catalogue:** local cache plus central `studies`, questionnaire versions, assignment scope, and import history.
3. **Questionnaire engine:** versioned sections/questions, options, skip rules, calculations, master-data links, repeat groups, and validation.
4. **Protected UKIHDP instrument:** household baseline Sections 1–10, household–FPO linkage, quality control, and separate institutional/FPO Section 11.
5. **Offline field layer:** production service worker, IndexedDB records, explicit sync states, reconnect processing, client-generated IDs, and revision conflict checks.
6. **Quality workflow:** submitted, under review, returned with reason, corrected/resubmitted, and approved with audit events.
7. **GIS:** Leaflet/OpenStreetMap, survey/study/concern layers, marker clustering, operational filters, and privacy-safe popups.
8. **Intelligence:** study-filtered operational summaries, approved-data indicators, quality flags, and automatic PDF/DOCX reports.

## Data relationships

`Study → Questionnaire Version → Survey Submission → Versioned Payload → Review Events`

`Study → User Assignment → Role + Geographic Scope + Sample Group + Active Period`

`Study → Survey GPS / Study Location / Project Location / Concern Location → GIS Layers`

Questionnaire versions and submitted payloads are immutable historical references. Publishing a replacement questionnaire changes the active version for new surveys without deleting old responses.

## Privacy rule

Personally identifiable respondent data is collected only where authorized and must never be exposed in GIS popups, portfolio dashboards, analytical charts, or management reports. Household coordinates require the same restricted access as the source survey.

## Deployment boundary

The repository is portable Next.js/React code. Supabase provides central authentication and PostgreSQL/RLS. Leaflet uses OpenStreetMap-compatible tiles. The production web host can be changed without changing the data model.
