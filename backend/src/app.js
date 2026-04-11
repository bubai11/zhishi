const express = require('express');
const cors = require('cors');
const { sequelize } = require('../models');
const models = require('../models');

// 路由
const userRoutes = require('../routes/user');
const plantsRoutes = require('../routes/plants');
const taxaRoutes = require('../routes/taxa');
const favoritesRoutes = require('../routes/favorites');
const browseEventsRoutes = require('../routes/browseEvents');
const quizzesRoutes = require('../routes/quizzes');
const mediaAssetsRoutes = require('../routes/mediaAssets');
const searchRoutes = require('../routes/search');
const taxonomyRoutes = require('../routes/taxonomy');
const redlistRoutes = require('../routes/redlist');
const wcvpAnalyticsRoutes = require('../routes/wcvpAnalytics');
const protectedAreasRoutes = require('../routes/protectedAreas');
const adminRoutes = require('../routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

// API 路由
app.use('/api/user', userRoutes);
app.use('/api/plants', plantsRoutes);
app.use('/api/taxa', taxaRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/browse-events', browseEventsRoutes);
app.use('/api/quizzes', quizzesRoutes);
app.use('/api/media-assets', mediaAssetsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/taxonomy', taxonomyRoutes);
app.use('/api/redlist', redlistRoutes);
app.use('/api/wcvp-analytics', wcvpAnalyticsRoutes);
app.use('/api/protected-areas', protectedAreasRoutes);
app.use('/api/admin', adminRoutes);

const PORT = process.env.PORT || 3001;

sequelize.authenticate().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Database connection failed:', err);
});
