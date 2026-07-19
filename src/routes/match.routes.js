const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { getMatchByPoNumber } = require("../controllers/match.controller");

const router = express.Router();

router.get("/:poNumber", asyncHandler(getMatchByPoNumber));

module.exports = router;

