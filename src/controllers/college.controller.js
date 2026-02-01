const College = require("../models/College"); // or User if shared
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

/**
 * 🏫 College Registration
 * POST /api/auth/register
 */
exports.registerCollege = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check existing college
    const existing = await College.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "College already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const college = await College.create({
      name,
      email,
      password: hashedPassword,
      role: "college",
      verified: false, // optional: admin approval
    });

    res.status(201).json({
      message: "College registered successfully",
      college: {
        id: college._id,
        name: college.name,
        email: college.email,
      },
    });
  } catch (error) {
    console.error("REGISTER ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};

/**
 * 🔐 College Login
 * POST /api/auth/login
 */
exports.loginCollege = async (req, res) => {
  try {
    const { email, password } = req.body;

    const college = await College.findOne({ email });
    if (!college) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, college.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { collegeId: college._id, role: "college" },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      college: {
        id: college._id,
        name: college.name,
        email: college.email,
      },
    });
  } catch (error) {
    console.error("LOGIN ERROR:", error);
    res.status(500).json({ message: "Server error" });
  }
};
