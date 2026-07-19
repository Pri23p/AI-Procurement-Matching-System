const multer = require("multer");
const { AppError } = require("../utils/errors");

function notFoundHandler(_req, _res, next) {
  next(new AppError("Route not found.", 404));
}

function errorHandler(error, _req, res, _next) {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message: error.message,
      details: error.code,
    });
  }

  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    message: error.message || "Internal server error.",
    details: error.details || null,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};

