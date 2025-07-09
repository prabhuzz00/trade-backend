const express = require("express");
const router = express.Router();
const supportController = require("../controllers/supportController");

// User Routes
router.post("/tickets", supportController.createTicket);
router.get("/tickets", supportController.getMyTickets);
router.get("/tickets/:id/messages", supportController.getTicketMessages);
router.post("/tickets/:id/messages", supportController.postMessage);

// Admin Routes (use session.admin check middleware)

module.exports = router;
