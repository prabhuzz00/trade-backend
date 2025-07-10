const db = require("../db");

module.exports = function requireAuth(req, res, next) {
  if (!req.session.user_id) {
    return res.status(401).json({ success: false, message: "Unauthorized" });
  }

  db.query(
    "SELECT id, name, email, balance FROM users WHERE id = ?",
    [req.session.user_id],
    (err, results) => {
      if (err || results.length === 0) {
        return res
          .status(401)
          .json({ success: false, message: "User not found" });
      }

      req.user = results[0]; // Make full user available in controller
      next();
    }
  );
};
