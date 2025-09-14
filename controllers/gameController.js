const db = require("../db");

let gameState = {
  period: Math.floor(Date.now() / 120000),
  tick: 0,
  open: null,
  high: null,
  low: null,
  price: null,
  result: null,
  volume: 0,
};

const resetGameState = () => {
  gameState.period = Math.floor(Date.now() / 120000);
  gameState.tick = 0;
  gameState.open = gameState.price || 300;
  gameState.high = gameState.open;
  gameState.low = gameState.open;
  gameState.result = null;
  gameState.volume = 0;
};

const initializePeriod = () => {
  db.query(
    "SELECT close FROM candles ORDER BY id DESC LIMIT 1",
    (err, result) => {
      const lastClose = result?.[0]?.close || 300;
      gameState.open = lastClose;
      gameState.high = lastClose;
      gameState.low = lastClose;
      gameState.price = lastClose;
      gameState.result = null;
      gameState.volume = 0;
      gameState.tick = 0;
      gameState.period = Math.floor(Date.now() / 120000);
      console.log("New period started:", gameState.period);
    }
  );
};

const simulatePrice = () => {
  gameState.tick++;

  if (gameState.tick <= 90) {
    const delta = (Math.random() * 2 - 1).toFixed(2);
    gameState.price = parseFloat(
      (gameState.price + parseFloat(delta)).toFixed(2)
    );
    gameState.high = Math.max(gameState.high, gameState.price);
    gameState.low = Math.min(gameState.low, gameState.price);

    const volatility = Math.abs(gameState.price - gameState.open);
    const baseVolume = 100 + Math.random() * 50;
    const volatilityBoost = volatility * 50;

    gameState.volume += Math.floor(baseVolume + volatilityBoost);
  }

  if (gameState.tick === 91) {
    const currentPeriod = gameState.period;

    // ✅ Skip auto-result if already set by admin
    if (gameState.result) {
      console.log(
        `Result already set manually for period ${currentPeriod}: ${gameState.result}`
      );
      return;
    }

    db.query(
      "SELECT side, SUM(amount) as total FROM bets WHERE period = ? GROUP BY side",
      [currentPeriod],
      (err, results) => {
        if (err || !results || results.length === 0) {
          const outcomes = [
            "green",
            "red",
            "green",
            "red",
            "doji_green",
            "green",
            "red",
            "doji_red",
            "green",
            "red",
          ];
          gameState.result =
            outcomes[Math.floor(Math.random() * outcomes.length)];
          return;
        }

        let green = 0,
          red = 0;
        for (const row of results) {
          if (row.side === "green") green = row.total;
          else if (row.side === "red") red = row.total;
        }

        // if (green < red) gameState.result = "green";
        // else if (red < green) gameState.result = "red";
        // else {
        //   const outcomes = ["doji_green", "doji_red"];
        //   gameState.result =
        //     outcomes[Math.floor(Math.random() * outcomes.length)];
        // }

        if (green === 0 && red > 0 && red <= 200) {
          // Only red has a small bet (≤ 200)
          gameState.result = Math.random() < 0.3 ? "red" : "green";
        } else if (red === 0 && green > 0 && green <= 200) {
          // Only green has a small bet (≤ 200)
          gameState.result = Math.random() < 0.3 ? "green" : "red";
        } else if (green < red) {
          gameState.result = "green";
        } else if (red < green) {
          gameState.result = "red";
        } else {
          const outcomes = ["doji_green", "doji_red"];
          gameState.result =
            outcomes[Math.floor(Math.random() * outcomes.length)];
        }
      }
    );
  }

  if (gameState.tick > 91 && gameState.tick <= 119) {
    const randomDiff = Math.floor(Math.random() * (20 - 3 + 1)) + 3;
    let target =
      gameState.result === "green"
        ? gameState.open + randomDiff
        : gameState.result === "red"
        ? gameState.open - randomDiff
        : gameState.result === "doji_green"
        ? gameState.open + 0.2
        : gameState.open - 0.2;

    const step = (target - gameState.price) / (119 - gameState.tick + 1);
    gameState.price = parseFloat((gameState.price + step).toFixed(2));
    gameState.high = Math.max(gameState.high, gameState.price);
    gameState.low = Math.min(gameState.low, gameState.price);

    const volatility = Math.abs(gameState.price - gameState.open);
    const baseVolume = 100 + Math.random() * 50;
    const volatilityBoost = volatility * 50;
    gameState.volume += Math.floor(baseVolume + volatilityBoost);
  }

  if (gameState.tick === 120) {
    const { period, open, high, low, price: close, volume } = gameState;

    db.query(
      "INSERT INTO candles (period, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?)",
      [period, open, high, low, close, volume],
      (err) => {
        if (err) console.error("Error saving candle:", err);
        else console.log("Candle saved for period:", period);
      }
    );

    // resolve bets
    db.query(
      "SELECT id, user_id, amount, side FROM bets WHERE period = ?",
      [period],
      (err, bets) => {
        if (err || !bets || bets.length === 0) return;

        bets.forEach((bet) => {
          let outcome = "lose";
          let payout = 0;

          if (gameState.result === bet.side) {
            outcome = "win";
            payout = bet.amount * 1.9;
          } else if (
            (gameState.result === "doji_red" && bet.side === "red") ||
            (gameState.result === "doji_green" && bet.side === "green")
          ) {
            outcome = "win";
            payout = bet.amount * 0.3;
          }

          // Update result, game_result, and payout
          db.query(
            "UPDATE bets SET result = ?, game_result = ?, payout = ? WHERE id = ?",
            [outcome, gameState.result, payout, bet.id]
          );

          if (payout > 0) {
            db.query("UPDATE users SET balance = balance + ? WHERE id = ?", [
              payout,
              bet.user_id,
            ]);
          }
        });
      }
    );

    initializePeriod();
  }
};

initializePeriod();
setInterval(simulatePrice, 1000);

exports.status = (req, res) => {
  res.json({
    tick: gameState.tick,
    period: gameState.period,
    open: gameState.open,
    high: gameState.high,
    low: gameState.low,
    price: gameState.price,
    volume: gameState.volume,
    // result: gameState.result,
  });
};

exports.adminStatus = (req, res) => {
  const currentPeriod = gameState.period;

  // Query total bets per side
  db.query(
    "SELECT side, SUM(amount) as total FROM bets WHERE period = ? GROUP BY side",
    [currentPeriod],
    (err, results) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, message: "Failed to fetch bet totals" });
      }

      // Map results into { green: 1000, red: 500, ... }
      const betTotals = {};
      for (const row of results) {
        betTotals[row.side] = row.total;
      }

      res.json({
        tick: gameState.tick,
        period: gameState.period,
        open: gameState.open,
        high: gameState.high,
        low: gameState.low,
        price: gameState.price,
        result: gameState.result,
        betTotals, // <- new!
      });
    }
  );
};

exports.setResultManually = (req, res) => {
  const { result } = req.body;
  const validResults = ["green", "red", "doji_green", "doji_red"];

  if (!validResults.includes(result)) {
    return res.status(400).json({ success: false, message: "Invalid result" });
  }

  gameState.result = result;
  console.log(`Manual result set: ${result}`);
  res.json({ success: true });
};

exports.getCandleHistory = (req, res) => {
  db.query(
    "SELECT period, open, high, low, close, volume FROM candles ORDER BY period DESC LIMIT 6000",
    (err, rows) => {
      if (err) return res.status(500).json({ success: false });

      const formatted = rows
        .map((row) => ({
          time: row.period * 120, // UNIX timestamp
          open: row.open,
          high: row.high,
          low: row.low,
          close: row.close,
          volume: row.volume || 0,
        }))
        .reverse(); // newest last for chart display

      res.json(formatted);
    }
  );
};

// controllers/gameController.js
exports.getRecentWinners = (req, res) => {
  db.query(
    `SELECT u.name, b.amount
     FROM bets b
     JOIN users u ON b.user_id = u.id
     WHERE b.result = 'win'
     ORDER BY b.created_at DESC
     LIMIT 10`,
    (err, results) => {
      if (err) {
        console.error("Error fetching winners:", err);
        return res.status(500).json({ success: false });
      }

      res.json(results); // [{ name: "Prabhu", amount: 100 }, ...]
    }
  );
};
