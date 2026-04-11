-- ===================================
-- 植物科普系统 - 第一阶段A固定项目数据
-- 要求：不使用临时表，写入 taxa / plants / plant_detail
-- 说明：本脚本按 50 种目标植物重建植物相关数据
-- ===================================

SET NAMES utf8mb4;

-- 先清理与植物相关的依赖数据，避免外键冲突
DELETE FROM `attempt_answers`;
DELETE FROM `quiz_attempts`;
DELETE FROM `favorites`;
DELETE FROM `browse_events`;
DELETE FROM `plant_media`;
DELETE FROM `plant_observations`;
DELETE FROM `plant_popularity_daily`;
DELETE FROM `plant_detail`;
DELETE FROM `plants`;
DELETE FROM `taxa` WHERE `taxon_rank` IN ('species', 'genus', 'family');

ALTER TABLE `taxa` AUTO_INCREMENT = 1;
ALTER TABLE `plants` AUTO_INCREMENT = 1;

-- 1) 插入 11 个 family
INSERT INTO `taxa` (`taxon_rank`, `parent_id`, `scientific_name`, `chinese_name`) VALUES
('family', NULL, 'Rosaceae', '蔷薇科'),
('family', NULL, 'Poaceae', '禾本科'),
('family', NULL, 'Pinaceae', '松科'),
('family', NULL, 'Magnoliaceae', '木兰科'),
('family', NULL, 'Liliaceae', '百合科'),
('family', NULL, 'Fabaceae', '豆科'),
('family', NULL, 'Asteraceae', '菊科'),
('family', NULL, 'Orchidaceae', '兰科'),
('family', NULL, 'Ranunculaceae', '毛茛科'),
('family', NULL, 'Brassicaceae', '十字花科'),
('family', NULL, 'Apiaceae', '伞形科');

-- 2) 插入 50 个 species
-- family id 约定：
-- 1 Rosaceae, 2 Poaceae, 3 Pinaceae, 4 Magnoliaceae, 5 Liliaceae,
-- 6 Fabaceae, 7 Asteraceae, 8 Orchidaceae, 9 Ranunculaceae, 10 Brassicaceae, 11 Apiaceae
INSERT INTO `taxa` (`taxon_rank`, `parent_id`, `scientific_name`, `chinese_name`) VALUES
('species', 1, 'Prunus mume', '梅花'),
('species', 1, 'Prunus persica', '桃'),
('species', 1, 'Prunus serrulata', '樱花'),
('species', 1, 'Rosa rugosa', '玫瑰'),
('species', 1, 'Fragaria × ananassa', '草莓'),
('species', 1, 'Malus pumila', '苹果'),
('species', 1, 'Pyrus pyrifolia', '梨'),

('species', 2, 'Oryza sativa', '水稻'),
('species', 2, 'Triticum aestivum', '小麦'),
('species', 2, 'Zea mays', '玉米'),
('species', 2, 'Phyllostachys edulis', '毛竹'),
('species', 2, 'Saccharum officinarum', '甘蔗'),

('species', 3, 'Pinus massoniana', '马尾松'),
('species', 3, 'Picea asperata', '云杉'),
('species', 3, 'Abies fabri', '冷杉'),
('species', 3, 'Larix gmelinii', '落叶松'),
('species', 3, 'Cedrus deodara', '雪松'),

('species', 4, 'Magnolia denudata', '玉兰'),
('species', 4, 'Magnolia liliflora', '紫玉兰'),
('species', 4, 'Michelia figo', '含笑'),
('species', 4, 'Liriodendron chinense', '鹅掌楸'),

('species', 5, 'Lilium brownii', '百合'),
('species', 5, 'Hemerocallis fulva', '萱草'),
('species', 5, 'Hosta plantaginea', '玉簪'),
('species', 5, 'Ophiopogon japonicus', '麦冬'),

('species', 6, 'Glycine max', '大豆'),
('species', 6, 'Phaseolus vulgaris', '菜豆'),
('species', 6, 'Arachis hypogaea', '花生'),
('species', 6, 'Albizia julibrissin', '合欢'),
('species', 6, 'Sophora japonica', '槐树'),

('species', 7, 'Chrysanthemum × morifolium', '菊花'),
('species', 7, 'Taraxacum mongolicum', '蒲公英'),
('species', 7, 'Helianthus annuus', '向日葵'),
('species', 7, 'Artemisia annua', '黄花蒿'),

('species', 8, 'Cymbidium goeringii', '春兰'),
('species', 8, 'Dendrobium nobile', '石斛'),
('species', 8, 'Phalaenopsis aphrodite', '蝴蝶兰'),

('species', 9, 'Paeonia lactiflora', '芍药'),
('species', 9, 'Paeonia suffruticosa', '牡丹'),
('species', 9, 'Coptis chinensis', '黄连'),
('species', 9, 'Aconitum carmichaelii', '乌头'),

('species', 10, 'Brassica rapa', '白菜'),
('species', 10, 'Brassica oleracea', '甘蓝'),
('species', 10, 'Raphanus sativus', '萝卜'),
('species', 10, 'Arabidopsis thaliana', '拟南芥'),

('species', 11, 'Daucus carota', '胡萝卜'),
('species', 11, 'Apium graveolens', '芹菜'),
('species', 11, 'Coriandrum sativum', '香菜'),
('species', 11, 'Angelica sinensis', '当归'),
('species', 11, 'Foeniculum vulgare', '小茴香');

-- 3) 插入 plants
INSERT INTO `plants` (`taxon_id`, `chinese_name`, `scientific_name`, `cover_image`, `short_desc`) VALUES
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Prunus mume' LIMIT 1), '梅花', 'Prunus mume', 'https://via.placeholder.com/300x200?text=Prunus%20mume', '蔷薇科落叶小乔木，早春开花。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Prunus persica' LIMIT 1), '桃', 'Prunus persica', 'https://via.placeholder.com/300x200?text=Prunus%20persica', '蔷薇科果树，春花夏果。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Prunus serrulata' LIMIT 1), '樱花', 'Prunus serrulata', 'https://via.placeholder.com/300x200?text=Prunus%20serrulata', '蔷薇科观赏树种，春季花量大。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Rosa rugosa' LIMIT 1), '玫瑰', 'Rosa rugosa', 'https://via.placeholder.com/300x200?text=Rosa%20rugosa', '蔷薇科灌木，观赏和香料植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Fragaria × ananassa' LIMIT 1), '草莓', 'Fragaria × ananassa', 'https://via.placeholder.com/300x200?text=Fragaria%20ananassa', '蔷薇科多年生草本，果实可食。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Malus pumila' LIMIT 1), '苹果', 'Malus pumila', 'https://via.placeholder.com/300x200?text=Malus%20pumila', '蔷薇科果树，温带广泛栽培。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Pyrus pyrifolia' LIMIT 1), '梨', 'Pyrus pyrifolia', 'https://via.placeholder.com/300x200?text=Pyrus%20pyrifolia', '蔷薇科果树，果实清甜多汁。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Oryza sativa' LIMIT 1), '水稻', 'Oryza sativa', 'https://via.placeholder.com/300x200?text=Oryza%20sativa', '禾本科重要粮食作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Triticum aestivum' LIMIT 1), '小麦', 'Triticum aestivum', 'https://via.placeholder.com/300x200?text=Triticum%20aestivum', '禾本科主要粮食作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Zea mays' LIMIT 1), '玉米', 'Zea mays', 'https://via.placeholder.com/300x200?text=Zea%20mays', '禾本科高产作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Phyllostachys edulis' LIMIT 1), '毛竹', 'Phyllostachys edulis', 'https://via.placeholder.com/300x200?text=Phyllostachys%20edulis', '禾本科竹亚科，常用于材用与食用。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Saccharum officinarum' LIMIT 1), '甘蔗', 'Saccharum officinarum', 'https://via.placeholder.com/300x200?text=Saccharum%20officinarum', '禾本科糖料作物。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Pinus massoniana' LIMIT 1), '马尾松', 'Pinus massoniana', 'https://via.placeholder.com/300x200?text=Pinus%20massoniana', '松科常绿针叶树。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Picea asperata' LIMIT 1), '云杉', 'Picea asperata', 'https://via.placeholder.com/300x200?text=Picea%20asperata', '松科高大乔木。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Abies fabri' LIMIT 1), '冷杉', 'Abies fabri', 'https://via.placeholder.com/300x200?text=Abies%20fabri', '松科针叶树，山地常见。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Larix gmelinii' LIMIT 1), '落叶松', 'Larix gmelinii', 'https://via.placeholder.com/300x200?text=Larix%20gmelinii', '松科落叶针叶树。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Cedrus deodara' LIMIT 1), '雪松', 'Cedrus deodara', 'https://via.placeholder.com/300x200?text=Cedrus%20deodara', '松科观赏与造林树种。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Magnolia denudata' LIMIT 1), '玉兰', 'Magnolia denudata', 'https://via.placeholder.com/300x200?text=Magnolia%20denudata', '木兰科早春开花观赏树。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Magnolia liliflora' LIMIT 1), '紫玉兰', 'Magnolia liliflora', 'https://via.placeholder.com/300x200?text=Magnolia%20liliflora', '木兰科花色紫红。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Michelia figo' LIMIT 1), '含笑', 'Michelia figo', 'https://via.placeholder.com/300x200?text=Michelia%20figo', '木兰科常绿灌木，花芳香。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Liriodendron chinense' LIMIT 1), '鹅掌楸', 'Liriodendron chinense', 'https://via.placeholder.com/300x200?text=Liriodendron%20chinense', '木兰科落叶乔木。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Lilium brownii' LIMIT 1), '百合', 'Lilium brownii', 'https://via.placeholder.com/300x200?text=Lilium%20brownii', '百合科球根花卉。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Hemerocallis fulva' LIMIT 1), '萱草', 'Hemerocallis fulva', 'https://via.placeholder.com/300x200?text=Hemerocallis%20fulva', '百合科（广义）多年生草本。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Hosta plantaginea' LIMIT 1), '玉簪', 'Hosta plantaginea', 'https://via.placeholder.com/300x200?text=Hosta%20plantaginea', '百合科（广义）观赏植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Ophiopogon japonicus' LIMIT 1), '麦冬', 'Ophiopogon japonicus', 'https://via.placeholder.com/300x200?text=Ophiopogon%20japonicus', '百合科（广义）药用与地被植物。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Glycine max' LIMIT 1), '大豆', 'Glycine max', 'https://via.placeholder.com/300x200?text=Glycine%20max', '豆科油料与蛋白作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Phaseolus vulgaris' LIMIT 1), '菜豆', 'Phaseolus vulgaris', 'https://via.placeholder.com/300x200?text=Phaseolus%20vulgaris', '豆科常见蔬菜作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Arachis hypogaea' LIMIT 1), '花生', 'Arachis hypogaea', 'https://via.placeholder.com/300x200?text=Arachis%20hypogaea', '豆科重要油料作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Albizia julibrissin' LIMIT 1), '合欢', 'Albizia julibrissin', 'https://via.placeholder.com/300x200?text=Albizia%20julibrissin', '豆科落叶乔木，夏季开花。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Sophora japonica' LIMIT 1), '槐树', 'Sophora japonica', 'https://via.placeholder.com/300x200?text=Sophora%20japonica', '豆科常见行道树。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Chrysanthemum × morifolium' LIMIT 1), '菊花', 'Chrysanthemum × morifolium', 'https://via.placeholder.com/300x200?text=Chrysanthemum%20morifolium', '菊科观赏与药用植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Taraxacum mongolicum' LIMIT 1), '蒲公英', 'Taraxacum mongolicum', 'https://via.placeholder.com/300x200?text=Taraxacum%20mongolicum', '菊科多年生草本。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Helianthus annuus' LIMIT 1), '向日葵', 'Helianthus annuus', 'https://via.placeholder.com/300x200?text=Helianthus%20annuus', '菊科一年生油料作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Artemisia annua' LIMIT 1), '黄花蒿', 'Artemisia annua', 'https://via.placeholder.com/300x200?text=Artemisia%20annua', '菊科药用植物。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Cymbidium goeringii' LIMIT 1), '春兰', 'Cymbidium goeringii', 'https://via.placeholder.com/300x200?text=Cymbidium%20goeringii', '兰科观赏植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Dendrobium nobile' LIMIT 1), '石斛', 'Dendrobium nobile', 'https://via.placeholder.com/300x200?text=Dendrobium%20nobile', '兰科药用植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Phalaenopsis aphrodite' LIMIT 1), '蝴蝶兰', 'Phalaenopsis aphrodite', 'https://via.placeholder.com/300x200?text=Phalaenopsis%20aphrodite', '兰科常见盆栽花卉。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Paeonia lactiflora' LIMIT 1), '芍药', 'Paeonia lactiflora', 'https://via.placeholder.com/300x200?text=Paeonia%20lactiflora', '毛茛科（传统分类）观赏植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Paeonia suffruticosa' LIMIT 1), '牡丹', 'Paeonia suffruticosa', 'https://via.placeholder.com/300x200?text=Paeonia%20suffruticosa', '毛茛科（传统分类）名贵花卉。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Coptis chinensis' LIMIT 1), '黄连', 'Coptis chinensis', 'https://via.placeholder.com/300x200?text=Coptis%20chinensis', '毛茛科药用植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Aconitum carmichaelii' LIMIT 1), '乌头', 'Aconitum carmichaelii', 'https://via.placeholder.com/300x200?text=Aconitum%20carmichaelii', '毛茛科药用植物（有毒）。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Brassica rapa' LIMIT 1), '白菜', 'Brassica rapa', 'https://via.placeholder.com/300x200?text=Brassica%20rapa', '十字花科蔬菜作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Brassica oleracea' LIMIT 1), '甘蓝', 'Brassica oleracea', 'https://via.placeholder.com/300x200?text=Brassica%20oleracea', '十字花科蔬菜作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Raphanus sativus' LIMIT 1), '萝卜', 'Raphanus sativus', 'https://via.placeholder.com/300x200?text=Raphanus%20sativus', '十字花科根菜。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Arabidopsis thaliana' LIMIT 1), '拟南芥', 'Arabidopsis thaliana', 'https://via.placeholder.com/300x200?text=Arabidopsis%20thaliana', '十字花科模式植物。'),

((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Daucus carota' LIMIT 1), '胡萝卜', 'Daucus carota', 'https://via.placeholder.com/300x200?text=Daucus%20carota', '伞形科根菜作物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Apium graveolens' LIMIT 1), '芹菜', 'Apium graveolens', 'https://via.placeholder.com/300x200?text=Apium%20graveolens', '伞形科蔬菜。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Coriandrum sativum' LIMIT 1), '香菜', 'Coriandrum sativum', 'https://via.placeholder.com/300x200?text=Coriandrum%20sativum', '伞形科调味植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Angelica sinensis' LIMIT 1), '当归', 'Angelica sinensis', 'https://via.placeholder.com/300x200?text=Angelica%20sinensis', '伞形科药用植物。'),
((SELECT `id` FROM `taxa` WHERE `taxon_rank`='species' AND `scientific_name`='Foeniculum vulgare' LIMIT 1), '小茴香', 'Foeniculum vulgare', 'https://via.placeholder.com/300x200?text=Foeniculum%20vulgare', '伞形科香辛植物。');

-- 4) 插入 plant_detail（按 family 自动生成结构化描述）
INSERT INTO `plant_detail` (`plant_id`, `intro`, `morphology`, `lifecycle`, `habitat`, `distribution`, `uses`, `extra`)
SELECT p.id,
       CONCAT(p.chinese_name, '（', p.scientific_name, '）为', f.chinese_name, '代表植物，资料整理自常见植物学与园艺学公开资料。'),
       CASE f.scientific_name
         WHEN 'Poaceae' THEN '多为草本，叶鞘抱茎，平行脉明显。'
         WHEN 'Pinaceae' THEN '木本针叶树，叶针形或条形，球果显著。'
         WHEN 'Asteraceae' THEN '头状花序常见，舌状花与管状花构成花序。'
         WHEN 'Orchidaceae' THEN '花结构特化，常具唇瓣与合蕊柱。'
         WHEN 'Apiaceae' THEN '伞形花序常见，部分种具明显香气。'
         ELSE '具本科典型形态特征。'
       END,
       '一年生或多年生为主，花果期因物种和气候条件而异。',
       '常见于农田、园林、山地林缘及人工栽培环境。',
       '在中国及温带、亚热带地区有广泛分布或引种栽培。',
       CASE f.scientific_name
         WHEN 'Poaceae' THEN '主要用于粮食、糖料、饲料和生态修复。'
         WHEN 'Fabaceae' THEN '用于食用、绿肥、园林及土壤改良。'
         WHEN 'Rosaceae' THEN '用于观赏、果品生产和园艺栽培。'
         WHEN 'Asteraceae' THEN '用于观赏、油料和部分药用开发。'
         WHEN 'Apiaceae' THEN '用于蔬菜、香辛料和药用资源。'
         ELSE '用于观赏、生态绿化或药食资源开发。'
       END,
       JSON_OBJECT('source', 'phase-a-fixed-list', 'family', f.scientific_name, 'version', 'A1')
FROM `plants` p
JOIN `taxa` s ON p.`taxon_id` = s.`id` AND s.`taxon_rank` = 'species'
JOIN `taxa` f ON s.`parent_id` = f.`id` AND f.`taxon_rank` = 'family';

-- 可选：重置测试账号
DELETE FROM `users`;
ALTER TABLE `users` AUTO_INCREMENT = 1;
INSERT INTO `users` (`username`, `password`, `email`, `avatar`) VALUES
('admin', '$2a$10$V2uiC5UGXOhH4h5BFkmaD.bvDlZ/2fSCQIEHUVHVDX9qyvofcsKQe', 'admin@example.com', 'https://via.placeholder.com/64'),
('user1', '$2a$10$2JYsZlE1Uk4axAQl99R3luJrIk.Xa9dHQgQ9BiP1mZZocs6zUNzPC', 'user1@example.com', 'https://via.placeholder.com/64'),
('user2', '$2a$10$t2lUoAyzbkY.0V0JRbWW6eUuXUlxWGdt9PXDpOxzEpwIENviXCYYC', 'user2@example.com', 'https://via.placeholder.com/64');

-- 验证
-- SELECT COUNT(*) AS family_count FROM taxa WHERE taxon_rank='family';
-- SELECT COUNT(*) AS species_count FROM taxa WHERE taxon_rank='species';
-- SELECT COUNT(*) AS plants_count FROM plants;
-- SELECT COUNT(*) AS detail_count FROM plant_detail;
