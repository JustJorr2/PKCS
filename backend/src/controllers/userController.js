const User = require("../models/User");
const Rating = require("../models/Rating");
const fs = require("fs");
const path = require("path");

async function getWorkers(req, res) {
  try {
    const users = await User.find({ role: "worker" }).select("-password");
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function getUserById(req, res) {
  try {
    const worker = await User.findById(req.params.id).select("-password");
    const ratings = await Rating.find({ ratedUser: req.params.id })
      .populate("ratedBy", "name role")
      .sort({ createdAt: -1 });
    res.json({ worker, ratings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function createUser(req, res) {
  try {
    const { name, email, username, password, role } = req.body;
    const userRole = role || "worker";

    if (userRole === "worker" && !username) {
      return res.status(400).json({ message: "Username is required for worker accounts" });
    }
    if (userRole !== "worker" && !email) {
      return res.status(400).json({ message: "Email is required for this role" });
    }

    const worker = new User({
      name,
      password,
      role: userRole,
      ...(username ? { username } : {}),
      ...(email ? { email } : {})
    });

    const newUser = await worker.save();
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0] || "field";
      return res.status(400).json({ message: `That ${field} is already taken` });
    }
    res.status(400).json({ message: err.message });
  }
}

async function login(req, res) {
  try {
    const { identifier, password } = req.body;

    if (!identifier) {
      return res.status(400).json({ message: "Email or username is required" });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();

    const worker = await User.findOne({
      $or: [{ email: cleanIdentifier }, { username: cleanIdentifier }]
    });

    if (!worker) return res.status(400).json({ message: "User not found" });
    if (worker.password !== password) {
      return res.status(400).json({ message: "Invalid password" });
    }

    if (worker.role === "worker" && !worker.isApproved) {
      return res.status(403).json({ message: "Your account is pending admin approval" });
    }

    res.json({
      _id: worker._id,
      name: worker.name,
      email: worker.email,
      username: worker.username,
      role: worker.role,
      profilePicture: worker.profilePicture,
      averageRating: worker.averageRating,
      totalRatings: worker.totalRatings,
      createdAt: worker.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function updateProfile(req, res) {
  try {
    const { name } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { name: name.trim() },
      { returnDocument: 'after' }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
}

async function uploadProfilePicture(req, res) {
  try {
    // Check if user exists
    const user = await User.findById(req.params.id);
    if (!user) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ message: "User not found" });
    }

    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Delete old profile picture if it exists
    if (user.profilePicture) {
      const oldFilePath = path.join(__dirname, "../../", user.profilePicture);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
    }

    // Store relative path for serving
    const profilePicturePath = path.relative(
      path.join(__dirname, ".."),
      req.file.path
    ).replace(/\\/g, "/");

    console.log("Stored path:", profilePicturePath);
    console.log("File path:", req.file.path);

    // Update user with new profile picture path
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { profilePicture: profilePicturePath },
      { returnDocument: 'after' }
    ).select("-password");

    res.json({
      message: "Profile picture uploaded successfully",
      user: updatedUser
    });
  } catch (err) {
    // Clean up uploaded file on error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: err.message });
  }
}

module.exports = {
  getWorkers,
  getUserById,
  createUser,
  login,
  updateProfile,
  uploadProfilePicture
};
