const db = require("../db");

exports.submitRecharge = (req, res) => {
  const userId = req.session.user_id;
  const { amount, utr } = req.body;

  if (!userId)
    return res.status(401).json({ success: false, message: "Unauthorized" });
  if (!amount || !utr)
    return res
      .status(400)
      .json({ success: false, message: "Missing amount or UTR" });

  db.query(
    "INSERT INTO recharge_requests (user_id, amount, utr) VALUES (?, ?, ?)",
    [userId, amount, utr],
    (err) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Database error" });
      res.json({ success: true });
    }
  );
};

exports.getPendingRecharges = (req, res) => {
  // You may add admin authentication here
  db.query(
    `SELECT r.*, u.email 
     FROM recharge_requests r 
     JOIN users u ON r.user_id = u.id 
     WHERE r.status = 'pending'
     ORDER BY r.created_at DESC`,
    (err, results) => {
      if (err) return res.status(500).json({ success: false });
      res.json(results);
    }
  );
};

// exports.approveRecharge = (req, res) => {
//   const { id } = req.params;

//   // 1. Get the recharge request
//   db.query(
//     "SELECT * FROM recharge_requests WHERE id = ?",
//     [id],
//     (err, result) => {
//       if (err || result.length === 0)
//         return res.status(404).json({ message: "Request not found" });

//       const recharge = result[0];

//       // 2. Approve this recharge
//       db.query(
//         "UPDATE recharge_requests SET status = 'approved' WHERE id = ?",
//         [id],
//         (err2) => {
//           if (err2) return res.status(500).json({ message: "Update failed" });

//           // 3. Add amount to user
//           db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [
//             recharge.amount,
//             recharge.user_id,
//           ]);

//           // 4. Check if it's first successful recharge
//           db.query(
//             "SELECT COUNT(*) as count FROM recharge_requests WHERE user_id = ? AND status = 'approved'",
//             [recharge.user_id],
//             (err3, countResult) => {
//               if (err3) return res.json({ success: true });

//               if (countResult[0].count === 1) {
//                 // First successful recharge, check referral
//                 db.query(
//                   "SELECT referred_by FROM users WHERE id = ?",
//                   [recharge.user_id],
//                   (err4, userResult) => {
//                     if (!err4 && userResult[0]?.referred_by) {
//                       // ✅ Add bonus to referrer
//                       db.query(
//                         "UPDATE users SET balance = balance + 20 WHERE id = ?",
//                         [userResult[0].referred_by]
//                       );
//                     }
//                   }
//                 );
//               }

//               return res.json({ success: true });
//             }
//           );
//         }
//       );
//     }
//   );
// };

exports.approveRecharge = (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT * FROM recharge_requests WHERE id = ?",
    [id],
    (err, result) => {
      if (err || result.length === 0)
        return res.status(404).json({ message: "Recharge not found" });

      const recharge = result[0];

      // Approve the recharge
      db.query(
        "UPDATE recharge_requests SET status = 'approved' WHERE id = ?",
        [id],
        (err2) => {
          if (err2)
            return res
              .status(500)
              .json({ message: "Failed to approve recharge" });

          // Add recharge amount to user's balance
          db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [
            recharge.amount,
            recharge.user_id,
          ]);

          // Check if it's the first recharge
          db.query(
            "SELECT is_recharge, referred_by FROM users WHERE id = ?",
            [recharge.user_id],
            (err3, result2) => {
              if (!err3 && result2.length > 0) {
                const user = result2[0];
                if (!user.is_recharge && user.referred_by) {
                  // Add bonus to referrer
                  db.query(
                    "UPDATE users SET balance = balance + 50, bonus = bonus + 50 WHERE id = ?",
                    [user.referred_by]
                  );

                  // Mark user as has recharged
                  db.query("UPDATE users SET is_recharge = 1 WHERE id = ?", [
                    recharge.user_id,
                  ]);
                }
              }
            }
          );

          res.json({ success: true });
        }
      );
    }
  );
};

exports.getMyRecharges = (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json([]);

  db.query(
    "SELECT id, amount, gateway_txn_id, status, created_at FROM recharge_requests WHERE user_id = ? ORDER BY created_at DESC",
    [userId],
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
};

exports.rejectRecharge = (req, res) => {
  const { id } = req.params;

  db.query(
    "SELECT * FROM recharge_requests WHERE id = ?",
    [id],
    (err, rows) => {
      if (err || rows.length === 0)
        return res.status(404).json({ success: false });

      db.query(
        "UPDATE recharge_requests SET status = 'rejected' WHERE id = ?",
        [id],
        (err2) => {
          if (err2) return res.status(500).json({ success: false });
          res.json({ success: true });
        }
      );
    }
  );
};
