const express = require("express");
const asyncHandler = require("../middleware/async-handler");
const { getTask } = require("../controllers/tasks.controller");

const router = express.Router();

router.get("/:id", asyncHandler(getTask));

module.exports = router;
