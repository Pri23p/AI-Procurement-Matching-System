const { getMatchResult } = require("../services/match.service");

async function getMatchByPoNumber(req, res) {
  const matchResult = await getMatchResult(req.params.poNumber);
  res.json(matchResult);
}

module.exports = {
  getMatchByPoNumber,
};

