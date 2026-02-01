const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const authMiddleware = require("../middleware/auth.middleware");
const userController = require("../controllers/user.controller"); // ✅ IMPORT CONTROLLER
const College = require("../models/College");
// 🔐 Get logged-in user profile
router.get("/me", authMiddleware, userController.getMe);
router.get("/colleges", async (req, res) => {
  const colleges = await College.find().select("_id name");
  res.json(colleges);
});

// ✏️ Update profile
router.put("/me", authMiddleware, userController.getMe);
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "All fields required" });
    }

    const user = req.user;

    // Check current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
