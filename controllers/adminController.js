const db = require("../db");

exports.adminLogin = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ success: false, message: "Missing fields" });

  db.query("SELECT * FROM admins WHERE email = ?", [email], (err, results) => {
    if (err)
      return res.status(500).json({ success: false, message: "DB error" });

    if (results.length === 0 || results[0].password !== password) {
      return res.json({ success: false, message: "Invalid credentials" });
    }

    const admin = results[0];
    req.session.admin_id = admin.id;

    res.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
      },
    });
  });
};

exports.adminMe = (req, res) => {
  if (!req.session.admin_id) return res.json(null);

  db.query(
    "SELECT id, email, name FROM admins WHERE id = ?",
    [req.session.admin_id],
    (err, results) => {
      if (err || results.length === 0) return res.json(null);
      res.json(results[0]);
    }
  );
};

exports.adminLogout = (req, res) => {
  console.log("Destroying admin session:", req.session.id);
  req.session.destroy(() => {
    res.clearCookie("admin.sid", { path: "/api/admin" });
    res.json({ success: true });
  });
};

exports.getAllUsers = (req, res) => {
  const query = `
    SELECT 
      u.id, u.email, u.name, u.balance, u.bonus, u.referral_code, 
      u.referred_by, u.is_recharge, u.created_at,
      ref.email AS referred_by_email
    FROM users u
    LEFT JOIN users ref ON u.referred_by = ref.id
    ORDER BY u.id DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      return res.status(500).json({ success: false, message: "DB error" });
    }
    res.json({ success: true, users: results });
  });
};

exports.getUserStats = (req, res) => {
  const userId = req.params.id;

  const summary = {
    total_bets: 0,
    total_amount: 0,
    wins: 0,
    losses: 0,
    win_amount: 0,
    loss_amount: 0,
    recharges_count: 0,
    recharges_total: 0,
    withdrawals_count: 0,
    withdrawals_total: 0,
    referral_count: 0,
    bonus: 0,
    payout: 0,
    profit: 0,
  };

  db.query(
    `SELECT COUNT(*) AS total_bets, SUM(amount) AS total_amount FROM bets WHERE user_id = ?`,
    [userId],
    (err, betRows) => {
      if (err) return res.status(500).json({ success: false, error: err });

      summary.total_bets = betRows[0].total_bets || 0;
      summary.total_amount = betRows[0].total_amount || 0;

      db.query(
        `SELECT result, COUNT(*) AS count, SUM(amount) AS amount FROM bets WHERE user_id = ? GROUP BY result`,
        [userId],
        (err2, results) => {
          if (err2)
            return res.status(500).json({ success: false, error: err2 });

          for (const row of results) {
            if (row.result === "win") {
              summary.wins = row.count;
              summary.win_amount = row.amount;
            } else if (row.result === "lose") {
              summary.losses = row.count;
              summary.loss_amount = row.amount;
            }
          }

          // Total payout (regardless of result type)
          db.query(
            `SELECT SUM(payout) AS payout FROM bets WHERE user_id = ?`,
            [userId],
            (errPayout, payoutRow) => {
              if (errPayout)
                return res
                  .status(500)
                  .json({ success: false, error: errPayout });

              summary.payout = payoutRow[0]?.payout || 0;
              summary.profit = summary.payout - summary.win_amount;

              db.query(
                `SELECT COUNT(*) AS count, SUM(amount) AS total FROM recharge_requests WHERE user_id = ? AND status = 'approved'`,
                [userId],
                (err3, rech) => {
                  if (err3)
                    return res
                      .status(500)
                      .json({ success: false, error: err3 });

                  summary.recharges_count = rech[0].count || 0;
                  summary.recharges_total = rech[0].total || 0;

                  db.query(
                    `SELECT COUNT(*) AS count, SUM(amount) AS total FROM withdraw_requests WHERE user_id = ? AND status = 'approved'`,
                    [userId],
                    (err4, withs) => {
                      if (err4)
                        return res
                          .status(500)
                          .json({ success: false, error: err4 });

                      summary.withdrawals_count = withs[0].count || 0;
                      summary.withdrawals_total = withs[0].total || 0;

                      db.query(
                        `SELECT COUNT(*) AS referral_count FROM users WHERE referred_by = ?`,
                        [userId],
                        (err5, refRows) => {
                          if (err5)
                            return res
                              .status(500)
                              .json({ success: false, error: err5 });

                          summary.referral_count =
                            refRows[0].referral_count || 0;

                          db.query(
                            `SELECT bonus FROM users WHERE id = ?`,
                            [userId],
                            (err6, bonusRow) => {
                              if (err6)
                                return res
                                  .status(500)
                                  .json({ success: false, error: err6 });

                              summary.bonus = bonusRow[0]?.bonus || 0;

                              res.json({ success: true, stats: summary });
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    }
  );
};

exports.getDashboardReport = (req, res) => {
  const report = {
    total_users: 0,
    recharges_count: 0,
    recharges_total: 0,
    withdrawals_count: 0,
    withdrawals_total: 0,
    total_bets: 0,
    total_bet_amount: 0,
    total_payout: 0,
    total_bonus: 0,
    company_profit: 0,
    total_wins: 0,
    total_losses: 0,
    total_loss_amount: 0,
    recharge_requests: 0,
    withdrawal_requests: 0,
    today: {
      users: 0,
      recharges_count: 0,
      recharges_total: 0,
      withdrawals_count: 0,
      withdrawals_total: 0,
      bets_count: 0,
      bets_amount: 0,
      payout: 0,
      total_profit: 0,
    },
  };

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;

  db.query(`SELECT COUNT(*) AS count FROM users`, (err, users) => {
    if (err) return res.status(500).json({ success: false, error: err });
    report.total_users = users[0].count;

    // Today's users
    db.query(
      `SELECT COUNT(*) AS count FROM users WHERE DATE(created_at) = ?`,
      [todayStr],
      (errU, todayUsers) => {
        if (errU) return res.status(500).json({ success: false, error: errU });
        report.today.users = todayUsers[0].count || 0;

        db.query(
          `SELECT COUNT(*) AS count, SUM(amount) AS total FROM recharge_requests WHERE status = 'success'`,
          (err2, rech) => {
            if (err2)
              return res.status(500).json({ success: false, error: err2 });
            report.recharges_count = rech[0].count || 0;
            report.recharges_total = rech[0].total || 0;

            // Today's recharges
            db.query(
              `SELECT COUNT(*) AS count, SUM(amount) AS total FROM recharge_requests WHERE status = 'success' AND DATE(created_at) = ?`,
              [todayStr],
              (err2t, rechT) => {
                if (err2t)
                  return res.status(500).json({ success: false, error: err2t });
                report.today.recharges_count = rechT[0].count || 0;
                report.today.recharges_total = rechT[0].total || 0;

                db.query(
                  `SELECT COUNT(*) AS count, SUM(amount) AS total FROM withdraw_requests WHERE status = 'approved'`,
                  (err3, withs) => {
                    if (err3)
                      return res
                        .status(500)
                        .json({ success: false, error: err3 });
                    report.withdrawals_count = withs[0].count || 0;
                    report.withdrawals_total = withs[0].total || 0;

                    // Today's withdrawals
                    db.query(
                      `SELECT COUNT(*) AS count, SUM(amount) AS total FROM withdraw_requests WHERE status = 'approved' AND DATE(created_at) = ?`,
                      [todayStr],
                      (err3t, withsT) => {
                        if (err3t)
                          return res
                            .status(500)
                            .json({ success: false, error: err3t });
                        report.today.withdrawals_count = withsT[0].count || 0;
                        report.today.withdrawals_total = withsT[0].total || 0;

                        db.query(
                          `SELECT COUNT(*) AS total_bets, SUM(amount) AS total_bet_amount, SUM(payout) AS total_payout FROM bets`,
                          (err4, bets) => {
                            if (err4)
                              return res
                                .status(500)
                                .json({ success: false, error: err4 });
                            report.total_bets = bets[0].total_bets || 0;
                            report.total_bet_amount =
                              bets[0].total_bet_amount || 0;
                            report.total_payout = bets[0].total_payout || 0;
                            db.query(
                              `SELECT SUM(amount) AS total FROM recharge_requests WHERE status = 'unpaid' OR status = 'pending'`,
                              (errR, rechReq) => {
                                if (errR)
                                  return res
                                    .status(500)
                                    .json({ success: false, error: errR });
                                report.recharge_requests =
                                  rechReq[0].total || 0;

                                // Add withdrawal_requests (total withdrawal where status = pending)
                                db.query(
                                  `SELECT SUM(amount) AS total FROM withdraw_requests WHERE status = 'pending'`,
                                  (errW, withReq) => {
                                    if (errW)
                                      return res
                                        .status(500)
                                        .json({ success: false, error: errW });
                                    report.withdrawal_requests =
                                      withReq[0].total || 0;

                                    // Today's bets
                                    db.query(
                                      `SELECT COUNT(*) AS bets_count, SUM(amount) AS bets_amount, SUM(payout) AS payout FROM bets WHERE DATE(created_at) = ?`,
                                      [todayStr],
                                      (err4t, betsT) => {
                                        if (err4t)
                                          return res
                                            .status(500)
                                            .json({
                                              success: false,
                                              error: err4t,
                                            });
                                        report.today.bets_count =
                                          betsT[0].bets_count || 0;
                                        report.today.bets_amount =
                                          betsT[0].bets_amount || 0;
                                        report.today.payout =
                                          betsT[0].payout || 0;

                                        db.query(
                                          `SELECT SUM(bonus) AS total_bonus FROM users`,
                                          (err5, bonus) => {
                                            if (err5)
                                              return res
                                                .status(500)
                                                .json({
                                                  success: false,
                                                  error: err5,
                                                });
                                            report.total_bonus =
                                              bonus[0].total_bonus || 0;

                                            db.query(
                                              `SELECT COUNT(*) AS win_count FROM bets WHERE result = 'win'`,
                                              (err6, winRes) => {
                                                if (err6)
                                                  return res.status(500).json({
                                                    success: false,
                                                    error: err6,
                                                  });
                                                report.total_wins =
                                                  winRes[0].win_count || 0;

                                                db.query(
                                                  `SELECT COUNT(*) AS loss_count, SUM(amount) AS total_loss FROM bets WHERE result = 'lose'`,
                                                  (err7, lossRes) => {
                                                    if (err7)
                                                      return res
                                                        .status(500)
                                                        .json({
                                                          success: false,
                                                          error: err7,
                                                        });
                                                    report.total_losses =
                                                      lossRes[0].loss_count ||
                                                      0;
                                                    report.total_loss_amount =
                                                      lossRes[0].total_loss ||
                                                      0;

                                                    report.company_profit =
                                                      report.recharges_total -
                                                      report.withdrawals_total;

                                                    report.today.total_profit =
                                                      report.today
                                                        .recharges_total -
                                                      report.today
                                                        .withdrawals_total;

                                                    res.json({
                                                      success: true,
                                                      report,
                                                    });
                                                  }
                                                );
                                              }
                                            );
                                          }
                                        );
                                      }
                                    );
                                  }
                                );
                              }
                            );
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          }
        );
      }
    );
  });
};

exports.updateUserBalance = (req, res) => {
  const { userId, newBalance } = req.body;

  if (!userId || isNaN(newBalance)) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  db.query(
    "UPDATE users SET balance = ? WHERE id = ?",
    [parseFloat(newBalance), userId],
    (err, result) => {
      if (err) {
        console.error("DB error:", err);
        return res.status(500).json({ success: false, message: "DB error" });
      }
      res.json({ success: true });
    }
  );
};
