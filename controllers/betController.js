const db = require("../db");

exports.placeBet = (req, res) => {
  const userId = req.session.user_id;
  const { amount, side, period } = req.body;

  if (!userId || !amount || !side || !period) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  db.query(
    "SELECT balance FROM users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err || results.length === 0) {
        return res
          .status(500)
          .json({ success: false, message: "User not found" });
      }

      const currentBalance = results[0].balance;
      if (currentBalance < amount) {
        return res.json({ success: false, message: "Insufficient balance" });
      }

      db.query(
        "UPDATE users SET balance = balance - ? WHERE id = ?",
        [amount, userId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false });

          db.query(
            "INSERT INTO bets (user_id, period, amount, side) VALUES (?, ?, ?, ?)",
            [userId, period, amount, side],
            (err3) => {
              if (err3) return res.status(500).json({ success: false });
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
};
