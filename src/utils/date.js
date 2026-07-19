function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function parseDocumentDate(input) {
  if (!input) {
    return null;
  }

  if (isValidDate(input)) {
    return input;
  }

  const value = String(input).trim();
  if (!value) {
    return null;
  }

  const ddmmyyyy = value.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (ddmmyyyy) {
    const day = Number(ddmmyyyy[1]);
    const month = Number(ddmmyyyy[2]);
    const year = Number(ddmmyyyy[3].length === 2 ? `20${ddmmyyyy[3]}` : ddmmyyyy[3]);
    const parsed = new Date(Date.UTC(year, month - 1, day));
    return isValidDate(parsed) ? parsed : null;
  }

  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

function toIsoDate(input) {
  const parsed = parseDocumentDate(input);
  if (!parsed) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

module.exports = {
  parseDocumentDate,
  toIsoDate,
};

