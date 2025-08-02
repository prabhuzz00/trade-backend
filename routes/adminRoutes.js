const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { rejectRecharge } = require("../controllers/rechargeController");
const { rejectWithdraw } = require("../controllers/withdrawController");
const gameController = require("../controllers/gameController");
const supportController = require("../controllers/supportController");

// Auth
router.post("/login", adminController.adminLogin);
router.get("/me", adminController.adminMe);
router.post("/logout", adminController.adminLogout);
router.post("/recharges/:id/reject", rejectRecharge);
router.post("/withdraws/:id/reject", rejectWithdraw);

router.get("/prediction/status", gameController.adminStatus);
router.post("/prediction/set-result", gameController.setResultManually);

router.get("/report", adminController.getDashboardReport);

router.get("/users", adminController.getAllUsers);
router.get("/user/:id", adminController.getUserStats);
router.post("/update-balance", adminController.updateUserBalance);

router.get("/tickets", supportController.getAllTickets);
router.get("/tickets/:id/messages", supportController.getTicketMessages);
router.post("/tickets/:id/messages", supportController.postMessage); // reuse
router.post("/tickets/:id/status", supportController.updateStatus);
module.exports = router;
