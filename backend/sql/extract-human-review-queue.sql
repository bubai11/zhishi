WITH candidate_base AS (
  SELECT
    p.id AS plant_id,
    p.scientific_name,
    p.wcvp_family AS family,
    p.wcvp_genus AS genus,
    s.source_url,
    CASE
      WHEN LOWER(p.scientific_name) REGEXP ' (chinensis|sinensis|yunnanensis|formosana|tibetica|sichuan[a-z]*|guizhou[a-z]*)$' THEN 100
      ELSE 0
    END AS score_epithet,
    CASE
      WHEN p.wcvp_family IN ('Rubiaceae', 'Phyllanthaceae', 'Sapotaceae', 'Magnoliaceae', 'Theaceae', 'Lamiaceae', 'Rosaceae', 'Orchidaceae')
        OR p.wcvp_genus IN ('Isodon', 'Anoectochilus', 'Lasianthus', 'Leptopus', 'Aporosa', 'Mycetia', 'Neanotis', 'Prunus', 'Magnolia', 'Yulania', 'Camellia', 'Rhododendron')
      THEN 60
      ELSE 0
    END AS score_family_genus,
    CASE
      WHEN p.wcvp_genus IN ('Isodon', 'Anoectochilus', 'Lasianthus', 'Leptopus', 'Aporosa', 'Mycetia', 'Neanotis', 'Prunus', 'Magnolia', 'Yulania', 'Camellia', 'Rhododendron', 'Ixora')
      THEN 30
      ELSE 0
    END AS score_natural_distribution
  FROM plant_external_sources s
  INNER JOIN plants p
    ON p.id = s.plant_id
  WHERE s.provider = 'iplant'
    AND s.fetch_status = 'missing'
    AND p.scientific_name IS NOT NULL
    AND p.scientific_name <> ''
),
scored AS (
  SELECT
    plant_id,
    scientific_name,
    family,
    genus,
    source_url,
    score_epithet,
    score_family_genus,
    score_natural_distribution,
    score_epithet + score_family_genus + score_natural_distribution AS priority_score,
    CONCAT_WS('; ',
      CASE
        WHEN score_epithet > 0 THEN 'china-related epithet'
      END,
      CASE
        WHEN score_family_genus > 0 THEN 'family/genus in known China-distribution list'
      END,
      CASE
        WHEN score_natural_distribution > 0 THEN 'genus likely has natural distribution in China'
      END
    ) AS review_reason
  FROM candidate_base
)
SELECT
  scientific_name,
  family,
  genus,
  review_reason,
  '' AS chinese_name,
  'pending' AS review_status,
  '' AS reviewer,
  '' AS reviewed_at,
  priority_score,
  source_url
FROM scored
WHERE priority_score > 0
ORDER BY priority_score DESC, scientific_name ASC
LIMIT 40;
