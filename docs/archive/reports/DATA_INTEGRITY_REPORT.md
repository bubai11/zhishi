# 数据完整性报告

生成时间: 2026-03-29

## 1. 系统架构速览

根据项目根目录文档 `README.md` 和 `TECHNICAL_SUMMARY.md`，当前系统架构为：

- 前端：Vue 3 + Vite + Element Plus + ECharts + Three.js
- 后端：Node.js + Express + Sequelize
- 数据库：MySQL
- 数据组织方式：项目代码与原始数据分离，原始数据集中放在 `data-source/` 下，适合作为后续导入、清洗和映射的数据源目录

## 2. data-source 文件总览

- 文件总数：75
- 总体积：1217804512 Bytes，约 1161.39 MB

### 2.1 全量文件清单

| 文件路径 | 大小(Bytes) | 大小(MB) |
|---|---:|---:|
| data-source/wcvp/README_WCVP.xlsx | 17827 | 0.02 |
| data-source/wcvp/wcvp_distribution.csv | 141066449 | 134.53 |
| data-source/wcvp/wcvp_names.csv | 298218467 | 284.40 |
| data-source/wcvp_dwca/eml.xml | 53920 | 0.05 |
| data-source/wcvp_dwca/meta.xml | 3190 | 0.00 |
| data-source/wcvp_dwca/wcvp_distribution.csv | 64508242 | 61.52 |
| data-source/wcvp_dwca/wcvp_replacementNames.csv | 1759059 | 1.68 |
| data-source/wcvp_dwca/wcvp_taxon.csv | 503978109 | 480.63 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Recursos_en_Espanol/Metadatos_WDPA_WDOECM_ES.pdf | 266032 | 0.25 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Recursos_en_Espanol/Tabla_resumen_atributos_WDPA_ES.pdf | 224750 | 0.21 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Recursos_en_Espanol/WDPA_WDOECM_Manual_1_6_ES.pdf | 1405995 | 1.34 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Resources_in_English/Summary_table_WDPA_WDOECM_attributes.pdf | 69686 | 0.07 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Resources_in_English/WDPA_WDOECM_Manual_1_6.pdf | 2124375 | 2.03 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Resources_in_English/WDPA_WDOECM_Metadata_1_6.pdf | 250992 | 0.24 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ressources_en_Francais/Les_métadonnées_de_la_WDPA_et_WD_OECM.pdf | 236803 | 0.23 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ressources_en_Francais/Table_des_attributs_WDPA_et_WDOECM.pdf | 79144 | 0.08 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ressources_en_Francais/WDPA_WDOECM_Manual_1_6_FR.pdf | 1686554 | 1.61 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_sources_Mar2026.csv | 121287 | 0.12 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_WDOECM_Mar2026_Public_all_csv.csv | 155257738 | 148.07 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ресурсы_на_русском_языке/Summary_table_RUS.pdf | 103205 | 0.10 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ресурсы_на_русском_языке/WDPA_Metadata_1_5_RUS.pdf | 561415 | 0.54 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/Ресурсы_на_русском_языке/WDPA_WDOECM_Manual_1_6_RU.pdf | 1924309 | 1.84 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/الموارد_باللغة_العربية/Summary_table_WDPA_attributes_AR.pdf | 88788 | 0.08 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/الموارد_باللغة_العربية/WDPA_Manual_1.5_AR_FINAL.pdf | 3510700 | 3.35 |
| data-source/WDPA_WDOECM_Mar2026_Public_all_csv/الموارد_باللغة_العربية/WDPA_Metadata_1.5_AR.pdf | 305315 | 0.29 |
| data-source/wgsrpd-master/109-488-1-ED/1st Edition/geotdwg1.dtx | 4040 | 0.00 |
| data-source/wgsrpd-master/109-488-1-ED/1st Edition/geotdwg1.mdb | 229376 | 0.22 |
| data-source/wgsrpd-master/109-488-1-ED/1st Edition/index.html | 2473 | 0.00 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/geo2.htm | 3753 | 0.00 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/SecondEdGeog.htm | 5691 | 0.01 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblGazetteer.txt | 146363 | 0.14 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel1.txt | 183 | 0.00 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel2.txt | 1585 | 0.00 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel3.txt | 9933 | 0.01 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel4.txt | 17137 | 0.02 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/TDWG_geo2.pdf | 5390314 | 5.14 |
| data-source/wgsrpd-master/109-488-1-ED/2nd Edition/TDWG_Geography_ed2.mdb | 786432 | 0.75 |
| data-source/wgsrpd-master/geojson/level1.geojson | 1570614 | 1.50 |
| data-source/wgsrpd-master/geojson/level2.geojson | 1700122 | 1.62 |
| data-source/wgsrpd-master/geojson/level3.geojson | 1846370 | 1.76 |
| data-source/wgsrpd-master/level3.csv | 11569 | 0.01 |
| data-source/wgsrpd-master/geojson/level4.geojson | 2053779 | 1.96 |
| data-source/wgsrpd-master/level1/level1.dbf | 701 | 0.00 |
| data-source/wgsrpd-master/level1/level1.prj | 145 | 0.00 |
| data-source/wgsrpd-master/level1/level1.sbn | 228 | 0.00 |
| data-source/wgsrpd-master/level1/level1.sbx | 132 | 0.00 |
| data-source/wgsrpd-master/level1/level1.shp | 4769352 | 4.55 |
| data-source/wgsrpd-master/level1/level1.shp.xml | 21855 | 0.02 |
| data-source/wgsrpd-master/level1/level1.shx | 172 | 0.00 |
| data-source/wgsrpd-master/level1/master_meta_data.html | 21908 | 0.02 |
| data-source/wgsrpd-master/level2/level2.dbf | 7078 | 0.01 |
| data-source/wgsrpd-master/level2/level2.prj | 145 | 0.00 |
| data-source/wgsrpd-master/level2/level2.sbn | 636 | 0.00 |
| data-source/wgsrpd-master/level2/level2.sbx | 164 | 0.00 |
| data-source/wgsrpd-master/level2/level2.shp | 5495708 | 5.24 |
| data-source/wgsrpd-master/level2/level2.shp.xml | 22355 | 0.02 |
| data-source/wgsrpd-master/level2/level2.shx | 516 | 0.00 |
| data-source/wgsrpd-master/level2/master_meta_data.html | 21908 | 0.02 |
| data-source/wgsrpd-master/level3/level3.dbf | 36693 | 0.03 |
| data-source/wgsrpd-master/level3/level3.level4_Lev.atx | 24576 | 0.02 |
| data-source/wgsrpd-master/level3/level3.prj | 145 | 0.00 |
| data-source/wgsrpd-master/level3/level3.sbn | 3924 | 0.00 |
| data-source/wgsrpd-master/level3/level3.sbx | 484 | 0.00 |
| data-source/wgsrpd-master/level3/level3.shp | 7282396 | 6.95 |
| data-source/wgsrpd-master/level3/level3.shp.xml | 150218 | 0.14 |
| data-source/wgsrpd-master/level3/level3.shx | 3052 | 0.00 |
| data-source/wgsrpd-master/level3/master_meta_data.html | 21908 | 0.02 |
| data-source/wgsrpd-master/level4/level4.dbf | 133848 | 0.13 |
| data-source/wgsrpd-master/level4/level4.prj | 145 | 0.00 |
| data-source/wgsrpd-master/level4/level4.sbn | 6532 | 0.01 |
| data-source/wgsrpd-master/level4/level4.sbx | 668 | 0.00 |
| data-source/wgsrpd-master/level4/level4.shp | 8012912 | 7.64 |
| data-source/wgsrpd-master/level4/level4.shp.xml | 143890 | 0.14 |
| data-source/wgsrpd-master/level4/level4.shx | 4980 | 0.00 |
| data-source/wgsrpd-master/level4/master_meta_data.html | 21908 | 0.02 |
| data-source/wgsrpd-master/README.md | 2714 | 0.00 |
| data-source/iucn-2025-1/distribution.txt | 39301526 | 37.48 |
| data-source/iucn-2025-1/eml.xml | 5318 | 0.01 |
| data-source/iucn-2025-1/meta.xml | 2608 | 0.00 |
| data-source/iucn-2025-1/taxon.txt | 111317648 | 106.16 |
| data-source/iucn-2025-1/vernacularname.txt | 6110112 | 5.83 |

## 3. 核心数据需求检查

| 数据类型 | 需要的文件/内容 | 预期大小 | 当前情况 | 结论 |
|---|---|---:|---|---|
| WCVP 名录 | `wcvp_names.csv`, `wcvp_distributions.csv` | ~85MB | 已发现 `wcvp_names.csv` 284.40 MB，`wcvp_distribution.csv` 134.53 MB | 已存在，且规模充足 |
| WGSRPD 映射 | `level3.csv` 或 `wgsrpd_regions` 数据 | ~1MB | 已发现 `level3.csv` 0.01 MB，且同时保留 `tblLevel3.txt`、`geojson/level3.geojson` 及 `level3/` shapefile 组 | 已存在 |
| IUCN 濒危 | redlist 数据（植物部分） | ~200MB | 已发现 `iucn-2025-1/taxon.txt` 106.16 MB、`distribution.txt` 37.48 MB、`vernacularname.txt` 5.83 MB，且已完成入库 | 已存在，且已导入 |
| WDPA 保护区 | 保护区 CSV 文件 | ~500MB | 已发现主文件 `WDPA_WDOECM_Mar2026_Public_all_csv.csv` 148.07 MB，另有 `WDPA_sources_Mar2026.csv` 0.12 MB 和多语言说明文档，且已完成入库 | 已存在，且已导入 |

## 4. 已有文件清单

### 4.1 与核心需求直接相关的已有文件

| 数据类型 | 文件 | 大小(MB) | 说明 |
|---|---|---:|---|
| WCVP | `data-source/wcvp/wcvp_names.csv` | 284.40 | 植物名录主表 |
| WCVP | `data-source/wcvp/wcvp_distribution.csv` | 134.53 | 分布表 |
| WCVP DWCA | `data-source/wcvp_dwca/wcvp_taxon.csv` | 480.63 | Darwin Core 版主分类表 |
| WCVP DWCA | `data-source/wcvp_dwca/wcvp_distribution.csv` | 61.52 | Darwin Core 版分布表 |
| WGSRPD | `data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel3.txt` | 0.01 | Level 3 文本映射表 |
| WGSRPD | `data-source/wgsrpd-master/level3.csv` | 0.01 | 已生成标准 CSV 版本 |
| WGSRPD | `data-source/wgsrpd-master/geojson/level3.geojson` | 1.76 | Level 3 GeoJSON |
| WGSRPD | `data-source/wgsrpd-master/level3/level3.shp` 等 | 7.14 左右 | Level 3 shapefile 数据组 |
| IUCN | `data-source/iucn-2025-1/taxon.txt` | 106.16 | IUCN taxon 核心表 |
| IUCN | `data-source/iucn-2025-1/distribution.txt` | 37.48 | IUCN 分布与 threatStatus 扩展表 |
| IUCN | `data-source/iucn-2025-1/vernacularname.txt` | 5.83 | IUCN 俗名扩展表 |
| WDPA | `data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_WDOECM_Mar2026_Public_all_csv.csv` | 148.07 | 主保护区 CSV |
| WDPA | `data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_sources_Mar2026.csv` | 0.12 | 数据源补充表 |
| WDPA | `protected_areas` 表 | 319995 行 | 已导入数据库，按 `site_id` 去重/upsert |

## 5. 缺失文件清单

| 数据类型 | 缺失项 | 当前判断 |
|---|---|---|
| WCVP 名录 | 精确命名为 `wcvp_distributions.csv` 的复数命名文件 | 未发现，但已有 `wcvp_distribution.csv` 单数命名文件 |

## 6. 关键字段检查

### 6.1 已存在数据的关键字段

| 数据类型 | 抽样文件 | 是否可读 | 发现的关键字段 | 字段齐全性判断 |
|---|---|---|---|---|
| WCVP 名录 | `data-source/wcvp/wcvp_names.csv` | 是 | `plant_name_id`, `ipni_id`, `taxon_rank`, `taxon_status`, `family`, `genus`, `species`, `taxon_name`, `taxon_authors`, `accepted_plant_name_id`, `powo_id`, `reviewed` | 齐全，适合做分类名录主表 |
| WCVP 分布 | `data-source/wcvp/wcvp_distribution.csv` | 是 | `plant_locality_id`, `plant_name_id`, `continent_code_l1`, `continent`, `region_code_l2`, `region`, `area_code_l3`, `area`, `introduced`, `extinct`, `location_doubtful` | 齐全，具备与 WGSRPD Level 3 关联的核心字段 |
| WGSRPD 映射 | `data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel3.txt` | 是 | `L3 code`, `L3 area`, `L2 code`, `L3 ISOcode`, `Ed2status`, `Notes` | 对映射足够，但不是标准 CSV |
| WDPA 保护区 | `data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_WDOECM_Mar2026_Public_all_csv.csv` | 是 | `TYPE`, `SITE_ID`, `SITE_PID`, `SITE_TYPE`, `NAME_ENG`, `NAME`, `DESIG`, `DESIG_ENG`, `DESIG_TYPE`, `IUCN_CAT`, `STATUS`, `STATUS_YR`, `PRNT_ISO3`, `ISO3` | 核心识别字段齐全，适合后续筛选和关联 |
| IUCN 濒危 | `data-source/iucn-2025-1/taxon.txt` + `distribution.txt` | 是 | `scientificName`, `kingdom`, `family`, `genus`, `specificEpithet`, `taxonRank`, `taxonomicStatus`, `references`, `locality`, `occurrenceStatus`, `threatStatus`, `countryCode` | 齐全，且已成功映射并导入 `threatened_species` |

### 6.2 抽样得到的表头

| 文件 | 表头摘要 |
|---|---|
| `data-source/wcvp/wcvp_names.csv` | `plant_name_id|ipni_id|taxon_rank|taxon_status|family|genus|species|...|powo_id|reviewed` |
| `data-source/wcvp/wcvp_distribution.csv` | `plant_locality_id|plant_name_id|continent_code_l1|continent|region_code_l2|region|area_code_l3|area|introduced|extinct|location_doubtful` |
| `data-source/wgsrpd-master/109-488-1-ED/2nd Edition/tblLevel3.txt` | `L3 code*L3 area*L2 code*L3 ISOcode*Ed2status*Notes` |
| `data-source/WDPA_WDOECM_Mar2026_Public_all_csv/WDPA_WDOECM_Mar2026_Public_all_csv.csv` | `TYPE,SITE_ID,SITE_PID,SITE_TYPE,NAME_ENG,NAME,DESIG,DESIG_ENG,DESIG_TYPE,IUCN_CAT,...,ISO3,...` |

## 7. 建议补充方式

| 数据类型 | 建议补充方式 |
|---|---|
| IUCN 植物红色名录 | 已到位；后续仅需按新版本定期重跑 `npm run import:iucn` |
| WGSRPD 映射 CSV 化 | 已完成；后续如上游文件更新，只需重跑 `npm run build:wgsrpd:level3` |
| WCVP 命名统一 | 若后续脚本依赖复数命名，建议增加别名文件或在导入配置中兼容 `wcvp_distribution.csv` 与 `wcvp_distributions.csv` |
| WDPA 数据增强 | 已完成 CSV 入库；如果业务需要边界几何、全球全量或更高分辨率空间分析，应补充对应 shapefile/geodatabase 版本 |

## 8. 结论

- WCVP：已具备，且数据规模高于预期
- WGSRPD：已具备等价映射数据，且已补齐 `level3.csv`
- IUCN：已具备，并已成功导入 `threatened_species`
- WDPA：已具备主 CSV，并已成功导入 `protected_areas`；若后续要做空间边界分析，仍需补充几何版数据
