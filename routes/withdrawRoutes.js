const express = require("express");
const router = express.Router();
const withdrawController = require("../controllers/withdrawController");

router.post("/withdraw", withdrawController.submitWithdraw);
router.get("/admin/withdraws", withdrawController.getPendingWithdrawals);
router.post("/admin/withdraws/:id/approve", withdrawController.approveWithdraw);
router.post("/admin/withdraws/:id/reject", withdrawController.rejectWithdraw);
router.get("/my-withdrawals", withdrawController.getMyWithdrawals);

module.exports = router;
