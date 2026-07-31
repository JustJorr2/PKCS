const express = require("express");
const { getWorkers, getUserById, createUser, login, updateProfile, uploadProfilePicture } = require("../controllers/userController");
const upload = require("../middleware/multerConfig");

const router = express.Router();

router.get("/users", getWorkers);
router.get("/users/:id", getUserById);
router.put("/users/:id/profile", updateProfile);
router.put("/users/:id/profile-picture", upload.single("profilePicture"), uploadProfilePicture);
router.post("/users", createUser);
router.post("/login", login);

module.exports = router;
