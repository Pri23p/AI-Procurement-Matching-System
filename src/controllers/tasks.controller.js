const Task = require("../models/task.model");
const { AppError } = require("../utils/errors");

async function getTask(req, res) {
  const task = await Task.findById(req.params.id).populate("documentId");
  if (!task) {
    throw new AppError("Task not found.", 404);
  }
  res.json(task);
}

module.exports = {
  getTask,
};
