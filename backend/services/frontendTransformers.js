const IUCN_LABELS = {
  EX: '灭绝 (EX)',
  EW: '野外灭绝 (EW)',
  CR: '极危 (CR)',
  EN: '濒危 (EN)',
  VU: '易危 (VU)',
  NT: '近危 (NT)',
  LC: '无危 (LC)',
  DD: '数据缺乏 (DD)'
};

function pickChineseOrScientific(taxon) {
  if (!taxon) return null;
  return taxon.chinese_name || taxon.common_name || taxon.scientific_name || null;
}

function formatTaxonLabel(taxon) {
  if (!taxon) return null;
  const primary = pickChineseOrScientific(taxon);
  if (!primary) return null;
  if (!taxon.scientific_name || primary === taxon.scientific_name) {
    return primary;
  }
  return `${primary} (${taxon.scientific_name})`;
}

function mapPlantCard(plant) {
  const familyScientificName = plant.wcvp_family || plant.family_scientific_name || '';
  const familyDisplayName = plant.family_display_name || plant.family_chinese_name || familyScientificName || '';

  return {
    id: String(plant.id),
    chinese_name: plant.chinese_name || plant.scientific_name || '',
    scientific_name: plant.scientific_name || '',
    family: familyDisplayName,
    family_scientific_name: familyScientificName || null,
    cover_image: plant.cover_image || null,
    short_desc: plant.short_desc || '',
    category: plant.category || null
  };
}

function formatIucnCategory(category) {
  if (!category) return null;
  return IUCN_LABELS[category] || category;
}

function normalizeQuizQuestion(question, includeCorrectAnswer = false) {
  const options = [...(question.options || [])].sort((a, b) => Number(a.id) - Number(b.id));
  const correctIndex = options.findIndex((option) => Boolean(option.is_correct));

  return {
    id: Number(question.id),
    question: question.stem,
    options: options.map((option) => option.text),
    option_ids: options.map((option) => Number(option.id)),
    ...(includeCorrectAnswer && correctIndex >= 0 ? { correct_answer: correctIndex } : {}),
    analysis: question.explanation || ''
  };
}

module.exports = {
  IUCN_LABELS,
  mapPlantCard,
  formatIucnCategory,
  formatTaxonLabel,
  normalizeQuizQuestion
};
