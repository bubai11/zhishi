-- 第一阶段方案A：目标植物数据补全（按提供清单）
-- 注：清单实际为 49 种

DROP TEMPORARY TABLE IF EXISTS `tmp_target_plants`;
CREATE TEMPORARY TABLE `tmp_target_plants` (
  `scientific_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `chinese_name` varchar(120) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `family` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `family_cn` varchar(80) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL
);

INSERT INTO `tmp_target_plants` (`scientific_name`, `chinese_name`, `family`, `family_cn`) VALUES
('Prunus mume', '梅花', 'Rosaceae', '蔷薇科'),
('Prunus persica', '桃', 'Rosaceae', '蔷薇科'),
('Prunus serrulata', '樱花', 'Rosaceae', '蔷薇科'),
('Rosa rugosa', '玫瑰', 'Rosaceae', '蔷薇科'),
('Fragaria × ananassa', '草莓', 'Rosaceae', '蔷薇科'),
('Malus pumila', '苹果', 'Rosaceae', '蔷薇科'),
('Pyrus pyrifolia', '梨', 'Rosaceae', '蔷薇科'),
('Oryza sativa', '水稻', 'Poaceae', '禾本科'),
('Triticum aestivum', '小麦', 'Poaceae', '禾本科'),
('Zea mays', '玉米', 'Poaceae', '禾本科'),
('Phyllostachys edulis', '毛竹', 'Poaceae', '禾本科'),
('Saccharum officinarum', '甘蔗', 'Poaceae', '禾本科'),
('Pinus massoniana', '马尾松', 'Pinaceae', '松科'),
('Picea asperata', '云杉', 'Pinaceae', '松科'),
('Abies fabri', '冷杉', 'Pinaceae', '松科'),
('Larix gmelinii', '落叶松', 'Pinaceae', '松科'),
('Cedrus deodara', '雪松', 'Pinaceae', '松科'),
('Magnolia denudata', '玉兰', 'Magnoliaceae', '木兰科'),
('Magnolia liliflora', '紫玉兰', 'Magnoliaceae', '木兰科'),
('Michelia figo', '含笑', 'Magnoliaceae', '木兰科'),
('Liriodendron chinense', '鹅掌楸', 'Magnoliaceae', '木兰科'),
('Lilium brownii', '百合', 'Liliaceae', '百合科'),
('Hemerocallis fulva', '萱草', 'Liliaceae', '百合科'),
('Hosta plantaginea', '玉簪', 'Liliaceae', '百合科'),
('Ophiopogon japonicus', '麦冬', 'Liliaceae', '百合科'),
('Glycine max', '大豆', 'Fabaceae', '豆科'),
('Phaseolus vulgaris', '菜豆', 'Fabaceae', '豆科'),
('Arachis hypogaea', '花生', 'Fabaceae', '豆科'),
('Albizia julibrissin', '合欢', 'Fabaceae', '豆科'),
('Sophora japonica', '槐树', 'Fabaceae', '豆科'),
('Chrysanthemum × morifolium', '菊花', 'Asteraceae', '菊科'),
('Taraxacum mongolicum', '蒲公英', 'Asteraceae', '菊科'),
('Helianthus annuus', '向日葵', 'Asteraceae', '菊科'),
('Artemisia annua', '黄花蒿', 'Asteraceae', '菊科'),
('Cymbidium goeringii', '春兰', 'Orchidaceae', '兰科'),
('Dendrobium nobile', '石斛', 'Orchidaceae', '兰科'),
('Phalaenopsis aphrodite', '蝴蝶兰', 'Orchidaceae', '兰科'),
('Paeonia lactiflora', '芍药', 'Ranunculaceae', '毛茛科'),
('Paeonia suffruticosa', '牡丹', 'Ranunculaceae', '毛茛科'),
('Coptis chinensis', '黄连', 'Ranunculaceae', '毛茛科'),
('Aconitum carmichaelii', '乌头', 'Ranunculaceae', '毛茛科'),
('Brassica rapa', '白菜', 'Brassicaceae', '十字花科'),
('Brassica oleracea', '甘蓝', 'Brassicaceae', '十字花科'),
('Raphanus sativus', '萝卜', 'Brassicaceae', '十字花科'),
('Arabidopsis thaliana', '拟南芥', 'Brassicaceae', '十字花科'),
('Daucus carota', '胡萝卜', 'Apiaceae', '伞形科'),
('Apium graveolens', '芹菜', 'Apiaceae', '伞形科'),
('Coriandrum sativum', '香菜', 'Apiaceae', '伞形科'),
('Angelica sinensis', '当归', 'Apiaceae', '伞形科');

INSERT INTO `taxa` (`taxon_rank`, `parent_id`, `scientific_name`, `chinese_name`)
SELECT DISTINCT 'family', NULL, t.family, t.family_cn
FROM `tmp_target_plants` t
WHERE NOT EXISTS (
  SELECT 1 FROM `taxa` f
  WHERE f.`taxon_rank` = 'family' AND f.`scientific_name` = t.`family`
);

INSERT INTO `taxa` (`taxon_rank`, `parent_id`, `scientific_name`, `chinese_name`)
SELECT 'species', f.id, t.scientific_name, t.chinese_name
FROM `tmp_target_plants` t
JOIN (
  SELECT `scientific_name`, MIN(`id`) AS id
  FROM `taxa`
  WHERE `taxon_rank` = 'family'
  GROUP BY `scientific_name`
) f ON f.`scientific_name` = t.`family`
WHERE NOT EXISTS (
  SELECT 1 FROM `taxa` s
  WHERE s.`taxon_rank` = 'species' AND s.`scientific_name` = t.`scientific_name`
);

INSERT INTO `plants` (`taxon_id`, `chinese_name`, `scientific_name`, `cover_image`, `short_desc`)
SELECT s.id,
       t.chinese_name,
       t.scientific_name,
       CONCAT('https://via.placeholder.com/300x200?text=', REPLACE(t.scientific_name, ' ', '%20')),
       CONCAT(t.chinese_name, '属于', t.family_cn, '，为第一阶段目标植物。')
FROM `tmp_target_plants` t
JOIN (
  SELECT `scientific_name`, MIN(`id`) AS id
  FROM `taxa`
  WHERE `taxon_rank` = 'species'
  GROUP BY `scientific_name`
) s ON s.`scientific_name` = t.`scientific_name`
WHERE NOT EXISTS (
  SELECT 1 FROM `plants` p
  WHERE p.`scientific_name` = t.`scientific_name`
);

INSERT INTO `plant_detail` (`plant_id`, `intro`, `morphology`, `lifecycle`, `habitat`, `distribution`, `uses`, `extra`)
SELECT p.id,
       CONCAT(t.chinese_name, '（', t.scientific_name, '）属于', t.family_cn, '，是项目第一阶段收录的目标植物。'),
       '形态特征待补充（阶段A占位描述）',
       '生命周期待补充（阶段A占位描述）',
       '生境信息待补充（阶段A占位描述）',
       '分布信息待补充（阶段A占位描述）',
       '用途信息待补充（阶段A占位描述）',
       JSON_OBJECT('source', 'phase-a-target-list', 'family', t.family, 'status', 'draft')
FROM `plants` p
JOIN `tmp_target_plants` t ON t.`scientific_name` = p.`scientific_name`
LEFT JOIN `plant_detail` d ON d.`plant_id` = p.`id`
WHERE d.`plant_id` IS NULL;

SELECT COUNT(*) AS target_species_in_taxa
FROM `taxa` s
JOIN `tmp_target_plants` t ON t.`scientific_name` = s.`scientific_name`
WHERE s.`taxon_rank` = 'species';

SELECT COUNT(*) AS target_plants_in_plants
FROM `plants` p
JOIN `tmp_target_plants` t ON t.`scientific_name` = p.`scientific_name`;

SELECT COUNT(DISTINCT t.family) AS target_family_count
FROM `taxa` f
JOIN `tmp_target_plants` t ON t.`family` = f.`scientific_name`
WHERE f.`taxon_rank` = 'family';

DROP TEMPORARY TABLE IF EXISTS `tmp_target_plants`;
