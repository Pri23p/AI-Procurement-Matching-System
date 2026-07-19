const express = require("express");
const documentsRoutes = require("./documents.routes");
const matchRoutes = require("./match.routes");
const tasksRoutes = require("./tasks.routes");

const router = express.Router();

router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "finifi-three-way-match",
  });
});

router.use("/documents", documentsRoutes);
router.use("/match", matchRoutes);
router.use("/tasks", tasksRoutes);

module.exports = router;

