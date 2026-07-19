const { createDocumentFromUpload, getDocumentById } = require("../services/document.service");

async function uploadDocument(req, res) {
  const task = await createDocumentFromUpload({
    file: req.file,
    documentType: req.body.documentType,
  });

  res.status(202).json({
    message: "Document uploaded successfully. Processing in progress.",
    task,
  });
}

async function getDocument(req, res) {
  const document = await getDocumentById(req.params.id);
  res.json(document);
}

module.exports = {
  uploadDocument,
  getDocument,
};

