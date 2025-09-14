const express = require("express");
const router = express.Router();
const { getSiteSetting, updateSiteSetting } = require("../controllers/siteSettingController");

router.get("/", getSiteSetting);
router.post("/", updateSiteSetting);

module.exports = router;