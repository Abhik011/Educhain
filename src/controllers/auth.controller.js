const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");

/* ===========================
   REGISTER
=========================== */
exports.register = async (req, res) => {
  try {
    let {
      name,
      email,
      password,
      role = "student",
      aadhaarNumber,
    } = req.body;

    /* =========================
       BASIC VALIDATION
    ========================= */
    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    /* =========================
       STUDENT VALIDATION
       (NO ROLL NUMBER)
    ========================= */
    if (role === "student") {
      if (!aadhaarNumber) {
        return res.status(400).json({
          message: "Aadhaar number is required for students",
        });
      }

      if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({
          message: "Invalid Aadhaar number",
        });
      }
    }

    email = email.toLowerCase().trim();

    /* =========================
       EMAIL UNIQUENESS
    ========================= */
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    /* =========================
       AADHAAR UNIQUENESS
    ========================= */
    let aadhaarHash;
    let aadhaarLast4;

    if (role === "student") {
      aadhaarHash = crypto
        .createHash("sha256")
        .update(aadhaarNumber)
        .digest("hex");

      aadhaarLast4 = aadhaarNumber.slice(-4);

      const existingAadhaar = await User.findOne({
        aadhaarHash,
        role: "student",
      });

      if (existingAadhaar) {
        return res.status(400).json({
          message: "Aadhaar number already registered",
        });
      }
    }

    /* =========================
       HASH PASSWORD
    ========================= */
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    /* =========================
       CREATE USER
    ========================= */
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      aadhaarHash: role === "student" ? aadhaarHash : undefined,
      aadhaarLast4: role === "student" ? aadhaarLast4 : undefined,
    });

    res.status(201).json({
      message: "User registered successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aadhaar: user.aadhaarLast4
          ? `XXXX-XXXX-${user.aadhaarLast4}`
          : null,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);

    if (err.code === 11000) {
      if (err.keyPattern?.email) {
        return res.status(400).json({ message: "Email already registered" });
      }
      if (err.keyPattern?.aadhaarHash) {
        return res.status(400).json({ message: "Aadhaar already registered" });
      }
    }

    res.status(500).json({ message: "Server error" });
  }
};


/* ===========================
   LOGIN
=========================== */
exports.login = async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    email = email.toLowerCase().trim();

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        aadhaarLast4: user.aadhaarLast4 || null,
      },
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
};

/* ===========================
   CHECK ROLL NUMBER
=========================== */
exports.checkRoll = async (req, res) => {
  const { rollNumber } = req.query;

  if (!rollNumber) {
    return res.status(400).json({ available: false });
  }

  const exists = await User.findOne({
    rollNumber,
    role: "student",
  });

  res.json({ available: !exists });
};

exports.getMe = async (req, res) => {
  try {
    const user = req.user;

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,

      // ✅ REQUIRED FOR AUTO-FILL
      aadhaarLast4: user.aadhaarLast4 || null,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to load profile" });
  }
};
