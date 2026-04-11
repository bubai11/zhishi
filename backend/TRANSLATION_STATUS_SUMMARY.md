# Translation Status Summary

Last updated: 2026-03-29

## What Has Been Implemented

- Added `plants.translation_source`
- Added `plants.translation_confidence`
- Created `chinese_name_cache`
- Added local dictionaries:
  - `backend/data/core_plants_dict.js`
  - `backend/data/genus_mapping.js`
- Added localization service:
  - `backend/services/chineseNameService.js`
- Added batch and migration scripts:
  - `backend/scripts/migrate-chinese-name-infra.js`
  - `backend/scripts/batch-update-chinese-names.js`
  - `backend/scripts/high-priority-manual-pipeline.js`
- Added admin endpoints:
  - `GET /api/admin/translation/stats`
  - `GET /api/admin/translation/unmatched`
  - `POST /api/admin/translation/update`

## Current Database Coverage

| metric | value |
|---|---:|
| total species | 362739 |
| matched chinese names | 957 |
| unmatched species | 361782 |

## Source Distribution

| source | count |
|---|---:|
| rule | 789 |
| legacy | 108 |
| manual | 60 |

## Remote Enrichment Status

- Direct `GBIF` lookups: tested, no usable hits in current sample
- Direct `iPlant` lookups: tested, no usable hits in current sample
- `Wikidata strict` template fill: tested, `0` additions in sample
- `GBIF strict` template fill: tested, `0` additions in sample
- Existing `fetch-chinese-names.js` remote run: tested, `0` hits in sample

## Important Conclusion

The system no longer lacks a Chinese-name localization framework. The remaining problem is data-source coverage and prioritization, not missing implementation.

## High-Priority Manual Completion

- Added a repeatable high-priority manual queue based on:
  - `backend/data/cn-pending-template.csv`
  - `backend/data/cn-review-high.csv`
- The queue now supports manual review columns:
  - `chinese_name`
  - `review_status`
  - `review_note`
  - `reviewer`
  - `reviewed_at`
  - `apply_to_pending`
- Each prepare/merge run appends to a daily Markdown log:
  - `backend/HIGH_PRIORITY_MANUAL_PIPELINE_YYYY-MM-DD.md`
- Current prepared queue snapshot on `2026-03-29`:
  - `11` high-priority species pending manual completion

## iPlant Enrichment

- Added iPlant enrichment migration and batch entrypoints:
  - `npm run migrate:iplant-enrichment`
  - `npm run iplant:enrich`
- Added persistent storage for iPlant-derived data:
  - `plant_external_sources`
  - `plant_synonyms`
  - `plant_detail.data_source`
  - `plant_detail.source_url`
  - `plant_detail.fetched_at`
- Current iPlant enrichment snapshot on `2026-03-29`:
  - `81` successful external-source rows
  - `276` missing external-source rows
  - `81` plant_detail rows tagged with `data_source='iplant'`
  - `470` iPlant synonym/alias rows
- Current direct `plants.translation_source='iplant'` count:
  - `14`
- Added accepted-name fallback for iPlant revised names:
  - example: `Magnolia denudata -> Yulania denudata -> 玉兰`
- Added adaptive priority ordering for iPlant enrichment:
  - Chinese-related epithets are prioritized
  - historically high-yield genera are prioritized
  - historically low-yield / repeatedly missing genera are deprioritized

## Current Assessment

- iPlant is now suitable as a structured detail/source enrichment provider.
- It is not yet a high-yield direct replacement for all Chinese-name coverage because many pages either lack Chinese names or only provide sparse species metadata.
- The most effective strategy remains:
  - manual/review-high for priority Chinese names
  - iPlant enrichment for source provenance, aliases, synonyms, and available detail text
  - rule/manual/local dictionaries for broad Chinese-name coverage

## Continuation Entry Points

- Infrastructure migration:
  - `npm run migrate:chinese-names`
- Local/manual/rule batch:
  - `npm run cn:update`
- High-priority manual queue prepare:
  - `npm run cn:review-high:prepare`
- High-priority manual queue merge:
  - `npm run cn:review-high:merge`
- Import reviewed template into DB-prep tables:
  - `npm run cn:import-template`
- iPlant enrichment migration:
  - `npm run migrate:iplant-enrichment`
- iPlant enrichment batch:
  - `npm run iplant:enrich`
- Remote execution notes:
  - `backend/TRANSLATION_REMOTE_EXECUTION_2026-03-29.md`
- Manual pipeline guide:
  - `backend/HIGH_PRIORITY_MANUAL_PIPELINE.md`
- iPlant batch report:
  - `backend/IPLANT_BATCH_REPORT_2026-03-29.md`
- iPlant enrichment report:
  - `backend/IPLANT_ENRICHMENT_REPORT_2026-03-29.md`

## Session Persistence Note

Do not rely on CLI conversation memory across sessions. Continue from the Markdown files in this repository, especially:

- `backend/TRANSLATION_STATUS_SUMMARY.md`
- `backend/TRANSLATION_REMOTE_EXECUTION_2026-03-29.md`
- `DATA_INTEGRITY_REPORT.md`
