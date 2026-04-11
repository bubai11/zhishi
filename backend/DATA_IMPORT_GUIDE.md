# Data Import Guide

## Available Commands

- `npm run import:wcvp`
  Imports WCVP names and distributions into staging tables and application tables.
- `npm run build:wgsrpd:level3`
  Converts `data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel3.txt` into `data-source/wgsrpd-master/level3.csv`.
- `npm run import:iucn -- --dry-run`
  Loads IUCN 2025-1 taxon and distribution files into staging tables and prints a summary without writing `threatened_species`.
- `npm run import:iucn`
  Loads IUCN 2025-1 files and upserts `threatened_species`.
- `npm run import:wdpa -- --dry-run`
  Parses the WDPA March 2026 public CSV and validates row handling without writing records.
- `npm run import:wdpa`
  Imports the WDPA March 2026 public CSV into `protected_areas`.

## Suggested Order

1. Run `npm run migrate:schema:2026-03`
2. Run `npm run import:wcvp`
3. Run `npm run build:wgsrpd:level3`
4. Run `npm run import:iucn -- --dry-run`
5. Run `npm run import:iucn`
6. Run `npm run import:wdpa -- --dry-run`
7. Run `npm run import:wdpa`

## Source Paths

- WCVP: `data-source/wcvp/`
- WGSRPD: `data-source/wgsrpd-master/`
- IUCN: `data-source/iucn-2025-1/`
- WDPA: `data-source/WDPA_WDOECM_Mar2026_Public_all_csv/`

## Notes

- The IUCN importer filters to accepted plant taxa and only keeps rows with a mapped Red List category.
- `threatened_species.scientific_name` is populated with the canonical scientific name so it can join more reliably with existing WCVP-derived plant records.
- `range_description` is aggregated from IUCN distribution localities.
- The WDPA importer normalizes `Not Applicable` and `Not Reported` to `NULL` and loads the public CSV into `protected_areas`.
