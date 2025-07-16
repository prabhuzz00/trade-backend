const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "trader",
  password: "StrongPassword123",
  database: "trading_db",
});

module.exports = pool;
