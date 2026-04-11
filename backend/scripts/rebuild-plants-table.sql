-- =====================================================
-- 重建 plants 表 - 精简版本
-- 本脚本完成以下步骤：
-- 1. 删除现有 plants 表及其约束
-- 2. 创建新的精简 plants 表（13 个字段）
-- 3. 清空 plant_distributions 表
-- 4. 验证关键索引
-- =====================================================

-- 步骤 1: 检查并删除外键约束
-- （plant_distributions 表有外键引用 plants）
SET FOREIGN_KEY_CHECKS = 0;

-- 清空 plant_distributions 表（保留结构）
TRUNCATE TABLE plant_distributions;

-- 删除现有 plants 表
DROP TABLE IF EXISTS plants;

SET FOREIGN_KEY_CHECKS = 1;

-- 步骤 2: 创建新的精简 plants 表
CREATE TABLE `plants` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT 'Primary Key',
  `taxon_id` int NOT NULL COMMENT '关联分类表（属/种级）',
  `chinese_name` varchar(100) NOT NULL DEFAULT '' COMMENT '中文名',
  `scientific_name` varchar(200) DEFAULT NULL COMMENT '学名',
  `cover_image` varchar(255) DEFAULT NULL COMMENT '封面图',
  `short_desc` varchar(500) DEFAULT NULL COMMENT '简短描述',
  
  -- WCVP 关联字段（用于连接分布数据）
  `wcvp_plant_name_id` varchar(50) DEFAULT NULL COMMENT 'WCVP 物种 ID',
  `wcvp_taxon_rank` varchar(30) DEFAULT NULL COMMENT '分类等级（species）',
  `wcvp_taxon_status` varchar(30) DEFAULT NULL COMMENT '接受名状态',
  `wcvp_family` varchar(100) DEFAULT NULL COMMENT '科名',
  `wcvp_genus` varchar(100) DEFAULT NULL COMMENT '属名',
  
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scientific` (`scientific_name`),
  KEY `idx_taxon` (`taxon_id`),
  KEY `idx_name` (`chinese_name`),
  KEY `idx_wcvp_id` (`wcvp_plant_name_id`),
  CONSTRAINT `fk_plants_taxon` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='植物物种表（精简版）';

-- 步骤 3: 验证 plant_distributions 表结构（应该已经存在）
-- 如果 plant_distributions 不存在或需要调整，可在此处创建或修改

-- 步骤 4: 验证 taxa 表存在
-- 确保稍后的关联关系正确

-- 完成状态日志
SELECT '✓ Plants 表重建完成（精简版本，13字段）' AS status;
SELECT COUNT(*) AS plants_count FROM plants;
SELECT COUNT(*) AS distributions_count FROM plant_distributions;
