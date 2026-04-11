# Chinese Name Remote Enrichment Execution

Date: 2026-03-29

## Purpose

- Continue the second step of Chinese name enrichment.
- Persist implementation notes and execution results to Markdown so the work remains traceable across CLI sessions.

## Scope For This Run

1. Extend the Chinese name service with remote enrichment sources.
2. Run a remote-enabled batch update.
3. Record coverage before and after.

## Files Touched In This Phase

- `backend/services/chineseNameService.js`
- `backend/scripts/batch-update-chinese-names.js`
- `backend/scripts/migrate-chinese-name-infra.js`
- `backend/TRANSLATION_REMOTE_EXECUTION_2026-03-29.md`

## Notes

- This file will be updated again after the remote batch finishes.

## Before Remote Run

```json
{
  "total": 362739,
  "matched": 957,
  "unmatched": 361782,
  "bySource": [
    { "translation_source": "rule", "count": 789 },
    { "translation_source": "legacy", "count": 108 },
    { "translation_source": "manual", "count": 60 }
  ]
}
```

## Remote Source Verification

### Direct GBIF and iPlant probes

Test species:

- `Magnolia denudata`
- `Ginkgo biloba`
- `Camellia sinensis`
- `Oryza sativa`
- `Rosa chinensis`
- `Helianthus annuus`

Observed result:

- `GBIF`: all probes returned `null`
- `iPlant`: all probes returned `null`

Conclusion:

- Network access works under escalated execution.
- These two direct remote paths currently do not provide usable Chinese names for the tested sample in this environment.

## Template Enrichment Attempts

Initial `cn-pending-template.csv` status:

```json
{
  "rows": 2000,
  "withCn": 79,
  "bySource": {
    "MANUAL": 39,
    "TODO": 1921,
    "WIKIDATA": 40
  }
}
```

### Wikidata strict fill

Command outcome:

- scanned: `20`
- added: `0`

### GBIF strict fill

Command outcome:

- scanned: `20`
- added: `0`

Conclusion:

- The strict template-based remote enrichment path is operational but produced `0` net additions in the sampled batch.

## Existing FOC/GBIF Fetch Script Test

Command:

- `node backend/scripts/fetch-chinese-names.js` with `CN_FETCH_LIMIT=20`

Observed result:

- local dictionary loaded: `116`
- remote batch size: `20`
- hits from dictionary: `0`
- hits from FOC: `0`
- hits from GBIF: `0`

Coverage snapshot reported by the script:

| metric | value |
|---|---:|
| total_species_target | 362739 |
| plants_with_chinese | 957 |
| taxa_with_chinese | 3870 |

## Interpretation

- The infrastructure for Chinese-name localization is now in place.
- Local/manual/rule layers are working and already persisted to database fields plus cache.
- Remote second-stage enrichment is technically runnable, but the currently configured external sources have very low yield for the tested unmatched sample.
- The main blocker is no longer missing implementation. The blocker is low-quality or low-coverage remote naming sources for the current unmatched corpus.

## Recommended Next Actions

1. Expand the local/manual mapping corpus in `backend/data/cn-pending-template.csv` and `backend/data/core_plants_dict.js`.
2. Prioritize high-value unmatched species instead of scanning in raw id order.
3. Add a new stronger remote source, preferably Wikidata-by-taxon-name with broader reconciliation, POWO-linked Chinese sources, or a curated Flora of China mapping list.
4. Keep all subsequent execution logs and summary stats appended to Markdown files in-repo.
