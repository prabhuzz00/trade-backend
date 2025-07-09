const express = require("express");
const router = express.Router();
const { placeBet } = require("../controllers/betController");

router.post("/place-bet", placeBet);

module.exports = router;
