const express = require("express");
const router = express.Router();
const {
  status,
  getCandleHistory,
  getRecentWinners,
} = require("../controllers/gameController");

router.get("/status", status);
router.get("/candles", getCandleHistory);
router.get("/winners", getRecentWinners);

module.exports = router;
