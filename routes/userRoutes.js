// routes/userRoutes.js

const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getMe,
  logout,
  getBetHistory,
  getReferralInfo,
} = require("../controllers/userController");

router.post("/register", register);
router.post("/login", login);
router.get("/me", getMe);
router.post("/logout", logout);
router.get("/bets", getBetHistory);
router.get("/referral-info", getReferralInfo);

module.exports = router;
