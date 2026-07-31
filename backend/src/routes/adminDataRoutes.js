const express = require("express");
const multer = require("multer");

const {
  exportExcel,
  importExcel,
  downloadTemplate
} = require("../controllers/adminDataController");

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage()
});

router.get("/admin/export", exportExcel);

router.post(
  "/admin/import",
  upload.single("file"),
  importExcel
);

router.get(
  "/admin/template",
  downloadTemplate
);

module.exports = router;