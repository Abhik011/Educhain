const jwt = require("jsonwebtoken");
const College = require("../models/College");

module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // ✅ Only college tokens allowed here
    if (decoded.role !== "college") {
      return res.status(403).json({ message: "Access denied" });
    }

    const college = await College.findById(decoded.collegeId);
    if (!college) {
      return res.status(401).json({ message: "College not found" });
    }

    req.user = college;
    req.user.role = "college"; // 🔥 normalize role
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid token" });
  }
};
