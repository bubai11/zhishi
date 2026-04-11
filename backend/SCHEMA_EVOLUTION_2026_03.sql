SET NAMES utf8mb4;

-- 1) taxa 扩展
ALTER TABLE taxa
MODIFY COLUMN taxon_rank ENUM('kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species') NOT NULL COMMENT '分类等级';

ALTER TABLE taxa
ADD COLUMN IF NOT EXISTS common_name VARCHAR(200) COMMENT '常用名/别名' AFTER scientific_name,
ADD COLUMN IF NOT EXISTS description TEXT COMMENT '分类描述' AFTER chinese_name,
ADD COLUMN IF NOT EXISTS key_features TEXT COMMENT '关键特征' AFTER description,
ADD COLUMN IF NOT EXISTS created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE taxa
ADD INDEX IF NOT EXISTS idx_rank (taxon_rank),
ADD INDEX IF NOT EXISTS idx_parent_rank (parent_id, taxon_rank);

-- 2) threatened species & alerts
CREATE TABLE IF NOT EXISTS threatened_species (
  id INT NOT NULL AUTO_INCREMENT,
  plant_id INT NULL,
  taxon_id INT NULL,
  scientific_name VARCHAR(200) NOT NULL,
  chinese_name VARCHAR(100),
  red_list_category ENUM('EX', 'EW', 'CR', 'EN', 'VU', 'NT', 'LC', 'DD') NOT NULL,
  criteria VARCHAR(50),
  population_trend ENUM('increasing', 'decreasing', 'stable', 'unknown') DEFAULT 'unknown',
  assessment_date DATE,
  last_assessed DATE,
  threats TEXT,
  conservation_actions TEXT,
  habitat TEXT,
  range_description TEXT,
  iucn_id VARCHAR(50),
  iucn_url VARCHAR(255),
  data_source VARCHAR(100) DEFAULT 'IUCN',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_scientific_name (scientific_name),
  INDEX idx_category (red_list_category),
  INDEX idx_assessment (assessment_date),
  INDEX idx_plant (plant_id),
  INDEX idx_taxon (taxon_id),
  CONSTRAINT fk_threatened_species_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE SET NULL,
  CONSTRAINT fk_threatened_species_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS redlist_alerts (
  id INT NOT NULL AUTO_INCREMENT,
  alert_month DATE NOT NULL,
  threatened_species_id INT NOT NULL,
  plant_id INT NULL,
  scientific_name VARCHAR(200) NOT NULL,
  old_category VARCHAR(20),
  new_category VARCHAR(20) NOT NULL,
  change_type ENUM('new_assessment', 'downgraded', 'upgraded', 'new_addition') NOT NULL,
  alert_reason TEXT,
  alert_level ENUM('high', 'medium', 'low') DEFAULT 'medium',
  is_read TINYINT(1) DEFAULT 0,
  is_dismissed TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_month (alert_month),
  INDEX idx_category (new_category),
  INDEX idx_unread (is_read, alert_month),
  CONSTRAINT fk_redlist_alerts_threatened FOREIGN KEY (threatened_species_id) REFERENCES threatened_species(id) ON DELETE CASCADE,
  CONSTRAINT fk_redlist_alerts_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3) plant distributions & WGSRPD
DROP TABLE IF EXISTS plant_distributions;

CREATE TABLE IF NOT EXISTS plant_distributions (
  id INT NOT NULL AUTO_INCREMENT,
  plant_id INT NULL,
  taxon_id INT NULL,
  wcvp_plant_name_id VARCHAR(50),
  scientific_name VARCHAR(200),
  area_code_l1 VARCHAR(10),
  area_code_l2 VARCHAR(10),
  area_code_l3 VARCHAR(10) NOT NULL,
  area_name VARCHAR(100),
  continent VARCHAR(50),
  country_code VARCHAR(10),
  occurrence_status ENUM('native', 'introduced', 'extinct', 'doubtful') DEFAULT 'native',
  introduced TINYINT(1) DEFAULT 0,
  extinct TINYINT(1) DEFAULT 0,
  latitude DECIMAL(10, 6),
  longitude DECIMAL(11, 6),
  data_source VARCHAR(50) DEFAULT 'WCVP',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_plant (plant_id),
  INDEX idx_taxon (taxon_id),
  INDEX idx_area (area_code_l3),
  INDEX idx_continent (continent),
  INDEX idx_status (occurrence_status),
  CONSTRAINT fk_plant_distributions_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE,
  CONSTRAINT fk_plant_distributions_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS wgsrpd_regions;

CREATE TABLE IF NOT EXISTS wgsrpd_regions (
  area_code_l1 VARCHAR(10),
  area_name_l1 VARCHAR(100),
  area_code_l2 VARCHAR(10),
  area_name_l2 VARCHAR(100),
  area_code_l3 VARCHAR(10) PRIMARY KEY,
  area_name_l3 VARCHAR(100),
  continent VARCHAR(50),
  latitude DECIMAL(10, 6),
  longitude DECIMAL(11, 6),
  country_code VARCHAR(10),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4) taxonomy statistics & features
CREATE TABLE IF NOT EXISTS taxonomy_statistics (
  id INT NOT NULL AUTO_INCREMENT,
  taxon_id INT NOT NULL,
  total_species INT DEFAULT 0,
  total_genera INT DEFAULT 0,
  total_families INT DEFAULT 0,
  child_taxa_count INT DEFAULT 0,
  known_ratio DECIMAL(10, 8) DEFAULT 0,
  global_rank VARCHAR(50),
  endemic_species INT DEFAULT 0,
  threatened_species INT DEFAULT 0,
  statistics_year YEAR DEFAULT '2025',
  data_source VARCHAR(100),
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_taxon_year (taxon_id, statistics_year),
  INDEX idx_taxon (taxon_id),
  INDEX idx_ratio (known_ratio),
  CONSTRAINT fk_taxonomy_statistics_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS taxonomy_features (
  id INT NOT NULL AUTO_INCREMENT,
  taxon_id INT NOT NULL,
  feature_type ENUM('morphology', 'physiology', 'ecology', 'distribution', 'usage', 'conservation') NOT NULL,
  feature_text TEXT,
  summary VARCHAR(500),
  icon VARCHAR(100),
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_taxon_type (taxon_id, feature_type),
  INDEX idx_taxon (taxon_id),
  CONSTRAINT fk_taxonomy_features_taxon FOREIGN KEY (taxon_id) REFERENCES taxa(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5) plant ecology
CREATE TABLE IF NOT EXISTS plant_ecology (
  id INT NOT NULL AUTO_INCREMENT,
  plant_id INT NOT NULL,
  drought_tolerance INT DEFAULT 50,
  cold_tolerance INT DEFAULT 50,
  shade_tolerance INT DEFAULT 50,
  disease_resistance INT DEFAULT 50,
  growth_rate INT DEFAULT 50,
  lifespan INT DEFAULT 50,
  ecological_adaptability INT DEFAULT 50,
  soil_requirement INT DEFAULT 50,
  water_requirement INT DEFAULT 50,
  data_source VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_plant (plant_id),
  CONSTRAINT fk_plant_ecology_plant FOREIGN KEY (plant_id) REFERENCES plants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
