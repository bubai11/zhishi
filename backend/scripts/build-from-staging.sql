-- 快速构建 taxa 和 plants 表
-- 假定 stg_wcvp_names 已有数据，或直接从 CSV 加载

-- Phase 1: 建立 taxa 层级
-- 1a. 插入科
INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
SELECT DISTINCT 'family', NULL, family, NOW(), NOW()
FROM stg_wcvp_names
WHERE family IS NOT NULL AND family <> ''
  AND LOWER(taxon_rank) = 'species'
  AND LOWER(taxon_status) = 'accepted'
LIMIT 1000000;

-- 1b. 插入属
INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
SELECT DISTINCT 'genus', f.id, sg.genus, NOW(), NOW()
FROM (
  SELECT DISTINCT family, genus
  FROM stg_wcvp_names
  WHERE genus IS NOT NULL AND genus <> ''
    AND family IS NOT NULL AND family <> ''
    AND LOWER(taxon_rank) = 'species'
    AND LOWER(taxon_status) = 'accepted'
) sg
INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = sg.family;

-- 1c. 插入种
INSERT IGNORE INTO taxa (taxon_rank, parent_id, scientific_name, created_at, updated_at)
SELECT DISTINCT 'species', g.id, ss.taxon_name, NOW(), NOW()
FROM (
  SELECT DISTINCT family, genus, taxon_name
  FROM stg_wcvp_names
  WHERE taxon_name IS NOT NULL AND taxon_name <> ''
    AND genus IS NOT NULL AND genus <> ''
    AND family IS NOT NULL AND family <> ''
    AND LOWER(taxon_rank) = 'species'
    AND LOWER(taxon_status) = 'accepted'
) ss
INNER JOIN taxa f ON f.taxon_rank = 'family' AND f.scientific_name = ss.family
INNER JOIN taxa g ON g.taxon_rank = 'genus' AND g.scientific_name = ss.genus AND g.parent_id = f.id;

-- Phase 2: 插入 plants
INSERT INTO plants (
  taxon_id, chinese_name, scientific_name,
  wcvp_plant_name_id, wcvp_taxon_rank, wcvp_taxon_status,
  wcvp_family, wcvp_genus, created_at, updated_at
)
SELECT
  t.id,
  s.taxon_name,  -- 暂用学名，后续被 fetch-chinese-names.js 覆盖
  s.taxon_name,
  s.plant_name_id,
  s.taxon_rank,
  s.taxon_status,
  s.family,
  s.genus,
  NOW(),
  NOW()
FROM stg_wcvp_names s
INNER JOIN taxa t ON t.taxon_rank = 'species' AND t.scientific_name = s.taxon_name
WHERE LOWER(s.taxon_rank) = 'species'
  AND LOWER(s.taxon_status) = 'accepted'
  AND s.plant_name_id IS NOT NULL
GROUP BY s.plant_name_id;

-- Phase 3: 插入分布数据（如果有的话）
INSERT INTO plant_distributions (
  plant_id, taxon_id, wcvp_plant_name_id, scientific_name,
  area_code_l1, area_code_l2, area_code_l3, area_name,
  continent, occurrence_status, introduced, extinct, data_source
)
SELECT
  p.id,
  p.taxon_id,
  d.plant_name_id,
  p.scientific_name,
  d.continent_code_l1,
  d.region_code_l2,
  d.area_code_l3,
  d.area_name_l3,
  d.continent,
  CASE 
    WHEN d.location_doubtful = 1 THEN 'doubtful'
    WHEN d.extinct = 1 THEN 'extinct'
    WHEN d.introduced = 1 THEN 'introduced'
    ELSE 'native'
  END,
  d.introduced,
  d.extinct,
  'WCVP'
FROM stg_wcvp_distribution d
INNER JOIN plants p ON p.wcvp_plant_name_id = d.plant_name_id
WHERE d.area_code_l3 IS NOT NULL AND d.area_code_l3 <> '';

-- 验证结果
SELECT
  (SELECT COUNT(*) FROM taxa WHERE taxon_rank='family') AS families,
  (SELECT COUNT(*) FROM taxa WHERE taxon_rank='genus') AS genera,
  (SELECT COUNT(*) FROM taxa WHERE taxon_rank='species') AS species_taxa,
  (SELECT COUNT(*) FROM plants) AS plants_total,
  (SELECT COUNT(*) FROM plant_distributions) AS distributions_total;
