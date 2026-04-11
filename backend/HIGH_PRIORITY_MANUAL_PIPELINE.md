# High Priority Manual Completion Pipeline

Last updated: 2026-03-29

## Purpose

- Turn `backend/data/cn-review-high.csv` into a stable manual review work queue.
- Merge approved manual Chinese names back into `backend/data/cn-pending-template.csv`.
- Keep every queue-preparation and merge step traceable in Markdown files inside `backend/`.

## Working Files

- Pending template: `backend/data/cn-pending-template.csv`
- High priority review queue: `backend/data/cn-review-high.csv`
- Run log: `backend/HIGH_PRIORITY_MANUAL_PIPELINE_YYYY-MM-DD.md`

## Queue Columns

`cn-review-high.csv` now includes these manual review columns:

- `chinese_name`
- `review_status`
- `review_note`
- `reviewer`
- `reviewed_at`
- `apply_to_pending`

Recommended values:

- `review_status=APPROVED`
- `apply_to_pending=Y`

## Workflow

### 1. Prepare the queue

```bash
npm run cn:review-high:prepare
```

This rebuilds `cn-review-high.csv` from `cn-pending-template.csv` while preserving any existing manual review fields already entered in the review queue.

### 2. Manually fill the review queue

For each high-priority species:

- fill `chinese_name` with the approved Chinese name
- set `review_status`
- set `apply_to_pending=Y` if the result should be merged back
- optionally fill `review_note`, `reviewer`, and `reviewed_at`

### 3. Merge approved rows back into the pending template

```bash
npm run cn:review-high:merge
```

This updates `backend/data/cn-pending-template.csv` with approved Chinese names and marks the note field with `MANUAL_REVIEW_HIGH_OK` plus reviewer metadata when present.

### 4. Import into database-prep tables

```bash
npm run cn:import-template
```

This writes the approved Chinese names from the updated pending template into `plants` and `taxa`.

## Markdown Persistence

Every `prepare` and `merge` run appends a new section to:

- `backend/HIGH_PRIORITY_MANUAL_PIPELINE_YYYY-MM-DD.md`

That file is the session bridge for future work and should be kept in-repo alongside:

- `backend/TRANSLATION_STATUS_SUMMARY.md`
- `backend/TRANSLATION_REMOTE_EXECUTION_2026-03-29.md`

## Current Position

- Remote enrichment is implemented but low-yield.
- The new priority path is manual review on the highest-value unmatched species.
- The pending template remains the single import source for database preparation.
