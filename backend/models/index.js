const { Sequelize } = require('sequelize');
const config = require('../config/config').development;

const sequelize = new Sequelize(config.database, config.username, config.password, config);

// 先导出 sequelize，避免模型文件在循环加载时拿到 undefined
module.exports = { sequelize };

// 导入所有模型
const User = require('./user');
const Taxa = require('./taxa');
const Plants = require('./plants');
const PlantDetail = require('./plant_detail');
const MediaAssets = require('./media_assets');
const PlantMedia = require('./plant_media');
const BrowseEvents = require('./browse_events');
const Favorites = require('./favorites');
const PlantObservations = require('./plant_observations');
const PlantPopularityDaily = require('./plant_popularity_daily');
const Quizzes = require('./quizzes');
const Questions = require('./questions');
const QuestionOptions = require('./question_options');
const QuizAttempts = require('./quiz_attempts');
const AttemptAnswers = require('./attempt_answers');
const TaxonomyStatistics = require('./taxonomy_statistics');
const TaxonomyFeatures = require('./taxonomy_features');
const ThreatenedSpecies = require('./threatened_species');
const RedlistAlerts = require('./redlist_alerts');
const RedlistAlertUserState = require('./redlist_alert_user_state');
const PlantDistributions = require('./plant_distributions');
const WgsrpdRegions = require('./wgsrpd_regions');
const WgsrpdRegionCountryMap = require('./wgsrpd_region_country_map');
const PlantEcology = require('./plant_ecology');
const ProtectedAreas = require('./protected_areas');
const PlantExternalSources = require('./plant_external_sources');
const PlantSynonyms = require('./plant_synonyms');
const UserAchievements = require('./user_achievements');

Object.assign(module.exports, {
  User,
  Taxa,
  Plants,
  PlantDetail,
  MediaAssets,
  PlantMedia,
  BrowseEvents,
  Favorites,
  PlantObservations,
  PlantPopularityDaily,
  Quizzes,
  Questions,
  QuestionOptions,
  QuizAttempts,
  AttemptAnswers,
  TaxonomyStatistics,
  TaxonomyFeatures,
  ThreatenedSpecies,
  RedlistAlerts,
  RedlistAlertUserState,
  PlantDistributions,
  WgsrpdRegions,
  WgsrpdRegionCountryMap,
  PlantEcology,
  ProtectedAreas,
  PlantExternalSources,
  PlantSynonyms,
  UserAchievements
});

const setupAssociations = require('./associations');

if (!sequelize.__associationsInitialized) {
  setupAssociations(module.exports);
  sequelize.__associationsInitialized = true;
}
