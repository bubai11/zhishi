-- taxonomy 模块建表脚本
-- MySQL 8.0+

CREATE TABLE IF NOT EXISTS taxonomy_statistics (
    id INT PRIMARY KEY AUTO_INCREMENT,
    taxon_id INT NOT NULL,
    total_species INT DEFAULT 0 COMMENT '该分类下的物种总数',
    child_taxa_count INT DEFAULT 0 COMMENT '子分类数量',
    known_ratio DECIMAL(5,4) DEFAULT 0 COMMENT '占已知植物比例',
    global_rank VARCHAR(20) COMMENT '全球排名/地位',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_taxonomy_statistics_taxon_id FOREIGN KEY (taxon_id) REFERENCES taxa(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS taxonomy_features (
    id INT PRIMARY KEY AUTO_INCREMENT,
    taxon_id INT NOT NULL,
    feature_type VARCHAR(50) COMMENT '特征类型: 形态/生理/生态等',
    feature_text TEXT COMMENT '特征描述',
    CONSTRAINT fk_taxonomy_features_taxon_id FOREIGN KEY (taxon_id) REFERENCES taxa(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_taxonomy_statistics_taxon_id ON taxonomy_statistics(taxon_id);
CREATE INDEX idx_taxonomy_features_taxon_id ON taxonomy_features(taxon_id);
