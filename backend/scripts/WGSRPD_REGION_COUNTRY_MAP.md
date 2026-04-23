# WGSRPD to ISO3 Alignment Import

The protected-area linkage uses `wgsrpd_region_country_map` as a lightweight cross-source alignment table. It maps WCVP/WGSRPD Level-3 area codes to one or more ISO3 country codes, then joins those ISO3 codes to `protected_areas.iso3` / `protected_areas.parent_iso3`.

Default import:

```bash
npm run data:import:wgsrpd-map -- --dry-run
npm run data:import:wgsrpd-map
```

Custom JSON/CSV import:

```bash
npm run data:import:wgsrpd-map -- --file=./data-source/wgsrpd-region-map.csv
npm run data:import -- --target=wgsrpd_region_country_map --file=./data-source/wgsrpd-region-map.json
```

The dedicated script creates the table if missing and is safe to run repeatedly because the upsert key is `(area_code_l3, iso3)`.
