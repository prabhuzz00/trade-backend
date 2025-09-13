const express = require("express");
const router = express.Router();
const rechargeController = require("../controllers/rechargeController");
const {
  handlePaymentCallback,
  initiateRecharge,
} = require("../controllers/paymentController");
const requireAuth = require("../middleware/requireAuth");

// Multer for file upload
const multer = require("multer");
const uploadDir = require("path").join(__dirname, "..", "..", "uploads");
const fs = require("fs");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = file.originalname.split(".").pop();
    cb(
      null,
      Date.now() + "_" + Math.random().toString(36).slice(2) + "." + ext
    );
  },
});
const upload = multer({ storage });

router.post(
  "/recharge",
  upload.single("screenshot"),
  rechargeController.submitRecharge
);
router.get("/admin/recharges", rechargeController.getPendingRecharges);
router.post("/admin/recharges/:id/approve", rechargeController.approveRecharge);
router.post("/admin/recharges/:id/reject", rechargeController.rejectRecharge);
router.get("/my-recharges", rechargeController.getMyRecharges);

router.post("/recharge/initiate", requireAuth, initiateRecharge);
router.post("/recharge/callback", handlePaymentCallback);

module.exports = router;
