const mysql = require('mysql2/promise');
const sequelizeConfig = require('../config/config').development;

const dbConfig = {
  host: sequelizeConfig.host,
  user: sequelizeConfig.username,
  password: sequelizeConfig.password,
  database: process.env.WCVP_DB_NAME || sequelizeConfig.database
};

async function main() {
  const conn = await mysql.createConnection(dbConfig);

  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS redlist_alert_user_state (
        id INT NOT NULL AUTO_INCREMENT,
        user_id INT NOT NULL,
        alert_id INT NOT NULL,
        is_read TINYINT(1) DEFAULT 0,
        is_dismissed TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uk_user_alert (user_id, alert_id),
        INDEX idx_user_unread (user_id, is_read, is_dismissed),
        INDEX idx_alert (alert_id),
        CONSTRAINT fk_redlist_alert_user_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_redlist_alert_user_state_alert FOREIGN KEY (alert_id) REFERENCES redlist_alerts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log('[db] redlist_alert_user_state ensured');
  } finally {
    await conn.end();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('[db] failed to migrate redlist alert user state:', error);
    process.exitCode = 1;
  });
}
