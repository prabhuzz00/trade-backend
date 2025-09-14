const db = require("../db");

// Get site setting by key
exports.getSiteSetting = (req, res) => {
  const key = req.query.key;
  if (!key) return res.status(400).json({ success: false, message: "Missing key" });
  db.query("SELECT value FROM site_settings WHERE `key` = ? LIMIT 1", [key], (err, results) => {
    if (err) return res.status(500).json({ success: false, message: "DB error" });
    if (!results.length) return res.json({ success: false, message: "Not found" });
    res.json({ success: true, value: results[0].value });
  });
};

// Update site setting by key
exports.updateSiteSetting = (req, res) => {
  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ success: false, message: "Missing key or value" });
  db.query(
    "INSERT INTO site_settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)",
    [key, value],
    (err) => {
      if (err) return res.status(500).json({ success: false, message: "DB error" });
      res.json({ success: true });
    }
  );
};