const db = require("../db");
const bcrypt = require("bcrypt");
exports.register = (req, res) => {
  const { name, email, password, referralCode } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "DB error" });
    if (results.length > 0)
      return res.status(400).json({ message: "Phone already exists" });

    // Check referral code (if given)
    const handleInsert = (referredById = null) => {
      const newUser = {
        name,
        email,
        password,
        referral_code: generateReferralCode(),
        referred_by: referredById,
      };

      db.query("INSERT INTO users SET ?", newUser, (err3) => {
        if (err3)
          return res.status(500).json({ message: "Registration failed" });
        res
          .status(200)
          .json({ success: true, message: "Registered successfully" });
      });
    };

    if (referralCode) {
      db.query(
        "SELECT id FROM users WHERE referral_code = ?",
        [referralCode],
        (err2, refResults) => {
          if (err2 || refResults.length === 0) {
            return res.status(400).json({ message: "Invalid referral code" });
          }
          handleInsert(refResults[0].id); // Set referred_by
        }
      );
    } else {
      handleInsert(); // No referral
    }
  });
};

function generateReferralCode() {
  return "REF" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

exports.login = (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ success: false, message: "Server error" });

      if (results.length === 0) {
        return res.json({ success: false, message: "Invalid login" });
      }

      const user = results[0];

      // ✅ Compare plain password to hashed password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        return res.json({ success: false, message: "Invalid login" });
      }

      // ✅ Store session and login success
      req.session.user_id = user.id;
      res.json({ success: true });
    }
  );
};

exports.getMe = (req, res) => {
  if (!req.session.user_id) return res.json(null);

  db.query(
    "SELECT id, email, balance FROM users WHERE id = ?",
    [req.session.user_id],
    (err, results) => {
      if (err || results.length === 0) return res.json(null);
      res.json(results[0]);
    }
  );
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid", { path: "/" });
    res.json({ success: true });
  });
};

exports.getBetHistory = (req, res) => {
  if (!req.session.user_id) return res.status(401).json([]);

  db.query(
    "SELECT * FROM bets WHERE user_id = ? ORDER BY created_at DESC",
    [req.session.user_id],
    (err, results) => {
      if (err) return res.status(500).json([]);
      res.json(results);
    }
  );
};

exports.getReferralInfo = (req, res) => {
  const userId = req.session.user_id;
  if (!userId) return res.status(401).json({ success: false });

  db.query(
    `SELECT referral_code, bonus FROM users WHERE id = ?`,
    [userId],
    (err, result) => {
      if (err || result.length === 0)
        return res.status(500).json({ success: false });

      const { referral_code, bonus } = result[0];

      db.query(
        `SELECT name, email FROM users WHERE referred_by = ?`,
        [userId],
        (err2, referredUsers) => {
          if (err2) return res.status(500).json({ success: false });

          res.json({
            referral_code,
            total_bonus: bonus,
            referred_users: referredUsers,
          });
        }
      );
    }
  );
};
