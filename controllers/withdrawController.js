const db = require("../db");

exports.submitWithdraw = (req, res) => {
  const userId = req.session.user_id;
  const { amount, accountNumber, ifscCode, accountHolder } = req.body;

  if (!userId)
    return res.status(401).json({ success: false, message: "Unauthorized" });
  if (!amount || !accountNumber || !ifscCode || !accountHolder) {
    return res.status(400).json({ success: false, message: "Missing fields" });
  }

  db.query(
    "SELECT balance FROM users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(500).json({ success: false });

      const balance = results[0].balance;
      if (balance < amount) {
        return res.json({ success: false, message: "Insufficient balance" });
      }

      // Deduct balance
      db.query(
        "UPDATE users SET balance = balance - ? WHERE id = ?",
        [amount, userId],
        (err2) => {
          if (err2) return res.status(500).json({ success: false });

          // Save withdrawal request
          db.query(
            "INSERT INTO withdraw_requests (user_id, amount, account_number, ifsc_code, account_holder) VALUES (?, ?, ?, ?, ?)",
            [
              userId,
              amount,
              accountNumber,
              ifscCode.toUpperCase(),
              accountHolder,
            ],
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

exports.getPendingWithdrawals = (req, res) => {
  db.query(
    `SELECT w.*, u.email 
     FROM withdraw_requests w 
     JOIN users u ON w.user_id = u.id 
     WHERE w.status = 'pending'
     ORDER BY w.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json(results);
    }
  );
};

exports.approveWithdraw = (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT * FROM withdraw_requests WHERE id = ?",
    [id],
    (err, rows) => {
      if (err || rows.length === 0)
        return res.status(404).json({ success: false });

      // In real systems: transfer the funds externally, then mark approved
      db.query(
        "UPDATE withdraw_requests SET status = 'approved' WHERE id = ?",
        [id],
        (err2) => {
          if (err2) return res.status(500).json({ success: false });
          res.json({ success: true });
        }
      );
    }
  );
};

exports.getMyWithdrawals = (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json([]);

  db.query(
    `SELECT id, amount, account_number, ifsc_code, account_holder, status, created_at
     FROM withdraw_requests
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId],
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
};

exports.rejectWithdraw = (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT * FROM withdraw_requests WHERE id = ?",
    [id],
    (err, rows) => {
      if (err || rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "Request not found" });
      }

      const request = rows[0];

      // 1. Refund the amount to the user's balance
      db.query(
        "UPDATE users SET balance = balance + ? WHERE id = ?",
        [request.amount, request.user_id],
        (err2) => {
          if (err2)
            return res
              .status(500)
              .json({ success: false, message: "Balance refund failed" });

          // 2. Mark the request as rejected
          db.query(
            "UPDATE withdraw_requests SET status = 'rejected' WHERE id = ?",
            [id],
            (err3) => {
              if (err3)
                return res
                  .status(500)
                  .json({ success: false, message: "Failed to update status" });
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
};
