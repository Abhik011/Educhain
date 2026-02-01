const User = require("../models/User");

// 🔐 GET /api/user/me
exports.getMe = async (req, res) => {
  try {
    const user = req.user; // set by auth middleware

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to load profile" });
  }
};

// ✏️ PUT /api/user/me
exports.updateMe = async (req, res) => {
  try {
    const { name, email } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { name, email },
      { new: true }
    ).select("-password");

    res.json({
      id: user._id,
      name: user.name,
      email: user.email,
    });
  } catch (e) {
    res.status(500).json({ message: "Failed to update profile" });
  }
};
