const express = require("express");
const router = express.Router();
const rechargeController = require("../controllers/rechargeController");

router.post("/recharge", rechargeController.submitRecharge);
router.get("/admin/recharges", rechargeController.getPendingRecharges);
router.post("/admin/recharges/:id/approve", rechargeController.approveRecharge);
router.post("/admin/recharges/:id/reject", rechargeController.rejectRecharge);
router.get("/my-recharges", rechargeController.getMyRecharges);

module.exports = router;
