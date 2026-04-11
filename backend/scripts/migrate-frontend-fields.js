const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [tableName, columnName]
  );
  return rows.length > 0;
}

async function hasTable(conn, tableName) {
  const [rows] = await conn.execute(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `,
    [tableName]
  );
  return rows.length > 0;
}

async function run() {
  const conn = await mysql.createConnection(dbConfig);
  try {
    if (!(await hasColumn(conn, 'plants', 'category'))) {
      await conn.execute("ALTER TABLE plants ADD COLUMN category VARCHAR(50) NULL COMMENT '分类标签，如 Tropical/Temperate/Arid'");
    }

    if (!(await hasColumn(conn, 'users', 'level'))) {
      await conn.execute("ALTER TABLE users ADD COLUMN level INT DEFAULT 1 COMMENT '用户等级'");
    }
    if (!(await hasColumn(conn, 'users', 'points'))) {
      await conn.execute("ALTER TABLE users ADD COLUMN points INT DEFAULT 0 COMMENT '积分'");
    }
    if (!(await hasColumn(conn, 'users', 'bio'))) {
      await conn.execute("ALTER TABLE users ADD COLUMN bio TEXT NULL COMMENT '个人简介'");
    }

    if (!(await hasTable(conn, 'user_achievements'))) {
      await conn.execute(`
        CREATE TABLE user_achievements (
          id INT NOT NULL AUTO_INCREMENT,
          user_id INT NOT NULL,
          name VARCHAR(100) NOT NULL,
          icon VARCHAR(20) NOT NULL,
          earned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          INDEX idx_user (user_id),
          CONSTRAINT fk_user_achievements_user
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    }

    if (!(await hasColumn(conn, 'plant_ecology', 'light_tolerance'))) {
      await conn.execute('ALTER TABLE plant_ecology ADD COLUMN light_tolerance INT DEFAULT 50');
    }
    if (!(await hasColumn(conn, 'plant_ecology', 'water_requirement'))) {
      await conn.execute('ALTER TABLE plant_ecology ADD COLUMN water_requirement INT DEFAULT 50');
    }
    if (!(await hasColumn(conn, 'plant_ecology', 'temperature_tolerance'))) {
      await conn.execute('ALTER TABLE plant_ecology ADD COLUMN temperature_tolerance INT DEFAULT 50');
    }
    if (!(await hasColumn(conn, 'plant_ecology', 'air_humidity'))) {
      await conn.execute('ALTER TABLE plant_ecology ADD COLUMN air_humidity INT DEFAULT 50');
    }

    console.log('frontend field migration completed');
  } finally {
    await conn.end();
  }
}

run().catch((error) => {
  console.error('migrate-frontend-fields failed:', error.message);
  process.exitCode = 1;
});
