SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE plant_distributions;

DROP TABLE IF EXISTS plants;

SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE `plants` (
  `id` int NOT NULL AUTO_INCREMENT,
  `taxon_id` int NOT NULL,
  `chinese_name` varchar(100) NOT NULL DEFAULT '',
  `scientific_name` varchar(200) DEFAULT NULL,
  `cover_image` varchar(255) DEFAULT NULL,
  `short_desc` varchar(500) DEFAULT NULL,
  `wcvp_plant_name_id` varchar(50) DEFAULT NULL,
  `wcvp_taxon_rank` varchar(30) DEFAULT NULL,
  `wcvp_taxon_status` varchar(30) DEFAULT NULL,
  `wcvp_family` varchar(100) DEFAULT NULL,
  `wcvp_genus` varchar(100) DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_scientific` (`scientific_name`),
  KEY `idx_taxon` (`taxon_id`),
  KEY `idx_name` (`chinese_name`),
  KEY `idx_wcvp_id` (`wcvp_plant_name_id`),
  CONSTRAINT `fk_plants_taxon` FOREIGN KEY (`taxon_id`) REFERENCES `taxa` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SELECT 'Plants table rebuilt successfully' AS status;
SELECT COUNT(*) AS plants_count FROM plants;
SELECT COUNT(*) AS distributions_count FROM plant_distributions;
