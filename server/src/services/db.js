import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * MySQL Connection Pool
 *
 * Uses a pool (not a single connection) for:
 *  - Concurrent request handling without blocking
 *  - Automatic reconnection on stale connections
 *  - Configurable pool size via DB_POOL_SIZE env var
 */
const pool = mysql.createPool({
  host:              process.env.DB_HOST        || 'localhost',
  port:       parseInt(process.env.DB_PORT      || '3306', 10),
  database:          process.env.DB_NAME        || 'vulnerability_db',
  user:              process.env.DB_USER        || 'root',
  password:          process.env.DB_PASSWORD    || '',
  connectionLimit: parseInt(process.env.DB_POOL_SIZE || '10', 10),
  waitForConnections: true,
  queueLimit:         0,
  timezone:          'Z',
  decimalNumbers:     true
});

// Verify connectivity at startup — logs but does not crash the process
pool.getConnection()
  .then(conn => {
    console.log(`✅  MySQL connected → ${process.env.DB_NAME || 'vulnerability_db'} on ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '3306'}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('    → Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in server/.env');
  });

export default pool;
