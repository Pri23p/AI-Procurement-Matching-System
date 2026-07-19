const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const path = require("path");
const swaggerUi = require("swagger-ui-express");
const YAML = require("yamljs");
const routes = require("./routes");
const { errorHandler, notFoundHandler } = require("./middleware/error-handler");

const openApiDocument = YAML.load(path.resolve(__dirname, "../docs/openapi.yaml"));

const app = express();

app.use(cors());
app.use(morgan("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_req, res) => {
  res.json({
    message: "Finifi three-way match engine is running.",
    docs: "/api-docs",
  });
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));
app.use(routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;

