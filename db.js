// db.js
const mysql = require("mysql2");

const db = mysql.createConnection({
  host: "localhost",
  user: "trader",
  password: "StrongPassword123",
  database: "trading_db",
});

// const db = mysql.createConnection({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "trading_db",
// });

db.connect((err) => {
  if (err) throw err;
  console.log("✅ MySQL connected");
});

module.exports = db;
