const express = require("express");
const router = express.Router();

// Controllers
const authController = require("../controllers/auth.controller");
const collegeController = require("../controllers/college.controller");
const User = require("../models/User");
// =======================
// USER AUTH
// =======================
router.post("/register", authController.register);
router.post("/login", authController.login);

// routes/auth.routes.js
router.get("/check-roll", async (req, res) => {
  try {
    // ✅ FIX 2: match Flutter query params
    const { rollNumber, collegeId } = req.query;

    if (!rollNumber || !collegeId) {
      return res.status(400).json({
        available: false,
        message: "rollNumber and collegeId are required",
      });
    }

    const exists = await User.findOne({
      rollNumber: rollNumber.trim(),
      collegeId,
      role: "student",
    });

    return res.json({
      available: !exists,
    });
  } catch (err) {
    console.error("CHECK ROLL ERROR:", err);
    return res.status(500).json({
      available: false,
      message: "Server error",
    });
  }
});

// =======================
// COLLEGE AUTH
// =======================
router.post("/college-register", collegeController.registerCollege);
router.post("/college-login", collegeController.loginCollege);

module.exports = router;
