module.exports = (models) => {
  const {
    User, Taxa, Plants, PlantDetail, MediaAssets, PlantMedia,
    BrowseEvents, Favorites, PlantObservations, PlantPopularityDaily,
    Quizzes, Questions, QuestionOptions, QuizAttempts, AttemptAnswers,
    TaxonomyStatistics, TaxonomyFeatures,
    ThreatenedSpecies, RedlistAlerts, RedlistAlertUserState, PlantDistributions, WgsrpdRegions, PlantEcology
    , PlantExternalSources, PlantSynonyms, UserAchievements
  } = models;

  Taxa.hasMany(Taxa, { as: 'children', foreignKey: 'parent_id' });
  Taxa.belongsTo(Taxa, { as: 'parent', foreignKey: 'parent_id' });
  Taxa.hasOne(TaxonomyStatistics, { foreignKey: 'taxon_id', as: 'statistics' });
  TaxonomyStatistics.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });
  Taxa.hasMany(TaxonomyFeatures, { foreignKey: 'taxon_id', as: 'features' });
  TaxonomyFeatures.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });

  Plants.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });
  Taxa.hasMany(Plants, { foreignKey: 'taxon_id', as: 'plants' });
  Plants.hasOne(PlantDetail, { foreignKey: 'plant_id', as: 'detail' });
  PlantDetail.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Plants.hasMany(PlantMedia, { foreignKey: 'plant_id', as: 'mediaList' });
  Plants.hasMany(BrowseEvents, { foreignKey: 'plant_id', as: 'browseEvents' });
  Plants.hasMany(Favorites, { foreignKey: 'plant_id', as: 'favorites' });
  Plants.hasMany(PlantObservations, { foreignKey: 'plant_id', as: 'observations' });
  Plants.hasMany(PlantPopularityDaily, { foreignKey: 'plant_id', as: 'popularityDaily' });
  Plants.hasOne(PlantEcology, { foreignKey: 'plant_id', as: 'ecology' });
  PlantEcology.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Plants.hasMany(PlantExternalSources, { foreignKey: 'plant_id', as: 'externalSources' });
  PlantExternalSources.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Taxa.hasMany(PlantExternalSources, { foreignKey: 'taxon_id', as: 'externalSources' });
  PlantExternalSources.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });
  Plants.hasMany(PlantSynonyms, { foreignKey: 'plant_id', as: 'synonyms' });
  PlantSynonyms.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Taxa.hasMany(PlantSynonyms, { foreignKey: 'taxon_id', as: 'synonyms' });
  PlantSynonyms.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });

  User.hasMany(BrowseEvents, { foreignKey: 'user_id', as: 'browseEvents' });
  User.hasMany(Favorites, { foreignKey: 'user_id', as: 'favorites' });
  User.hasMany(QuizAttempts, { foreignKey: 'user_id', as: 'quizAttempts' });
  User.hasMany(UserAchievements, { foreignKey: 'user_id', as: 'achievements' });
  UserAchievements.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  MediaAssets.hasMany(PlantMedia, { foreignKey: 'media_asset_id', as: 'plantList' });
  PlantMedia.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  PlantMedia.belongsTo(MediaAssets, { foreignKey: 'media_asset_id', as: 'media' });

  BrowseEvents.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  BrowseEvents.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Favorites.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Favorites.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  PlantObservations.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  PlantPopularityDaily.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });

  Quizzes.hasMany(Questions, { foreignKey: 'quiz_id', as: 'questions' });
  Questions.belongsTo(Quizzes, { foreignKey: 'quiz_id', as: 'quiz' });
  Questions.hasMany(QuestionOptions, { foreignKey: 'question_id', as: 'options' });
  QuestionOptions.belongsTo(Questions, { foreignKey: 'question_id', as: 'question' });
  Quizzes.hasMany(QuizAttempts, { foreignKey: 'quiz_id', as: 'attempts' });
  QuizAttempts.belongsTo(Quizzes, { foreignKey: 'quiz_id', as: 'quiz' });
  QuizAttempts.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  QuizAttempts.hasMany(AttemptAnswers, { foreignKey: 'attempt_id', as: 'answers' });
  AttemptAnswers.belongsTo(QuizAttempts, { foreignKey: 'attempt_id', as: 'attempt' });
  AttemptAnswers.belongsTo(Questions, { foreignKey: 'question_id', as: 'question' });
  AttemptAnswers.belongsTo(QuestionOptions, { foreignKey: 'chosen_option_id', as: 'chosenOption' });

  Plants.hasMany(PlantDistributions, { foreignKey: 'plant_id', as: 'distributions' });
  PlantDistributions.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Taxa.hasMany(PlantDistributions, { foreignKey: 'taxon_id', as: 'distributionItems' });
  PlantDistributions.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });

  ThreatenedSpecies.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Plants.hasMany(ThreatenedSpecies, { foreignKey: 'plant_id', as: 'threatenedSpecies' });
  ThreatenedSpecies.belongsTo(Taxa, { foreignKey: 'taxon_id', as: 'taxon' });
  Taxa.hasMany(ThreatenedSpecies, { foreignKey: 'taxon_id', as: 'threatenedSpecies' });

  RedlistAlerts.belongsTo(ThreatenedSpecies, { foreignKey: 'threatened_species_id', as: 'threatenedSpecies' });
  ThreatenedSpecies.hasMany(RedlistAlerts, { foreignKey: 'threatened_species_id', as: 'alerts' });
  RedlistAlerts.belongsTo(Plants, { foreignKey: 'plant_id', as: 'plant' });
  Plants.hasMany(RedlistAlerts, { foreignKey: 'plant_id', as: 'redlistAlerts' });
  RedlistAlertUserState.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  User.hasMany(RedlistAlertUserState, { foreignKey: 'user_id', as: 'redlistAlertStates' });
  RedlistAlertUserState.belongsTo(RedlistAlerts, { foreignKey: 'alert_id', as: 'alert' });
  RedlistAlerts.hasMany(RedlistAlertUserState, { foreignKey: 'alert_id', as: 'userStates' });

  WgsrpdRegions.hasMany(PlantDistributions, {
    foreignKey: 'area_code_l3',
    sourceKey: 'area_code_l3',
    as: 'distributionItems'
  });
  PlantDistributions.belongsTo(WgsrpdRegions, {
    foreignKey: 'area_code_l3',
    targetKey: 'area_code_l3',
    as: 'region'
  });
};
