const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "public");
  },
  filename: (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    const imageId = uuidv4();
    cb(null, imageId + extname);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 2 },
  fileFilter: (req, file, cb) => {
    const extname = path.extname(file.originalname).toLowerCase();
    if ([".jpg", ".jpeg", ".png"].includes(extname)) {
      cb(null, true);
    } else {
      cb(
        new Error("Invalid file type. Only JPG, JPEG, PNG images are allowed.")
      );
    }
  },
});

module.exports = upload;
