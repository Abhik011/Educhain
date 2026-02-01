const express = require("express");
const router = express.Router();
const College = require("../models/College");
const collageauthMiddleware = require("../middleware/collegeauth.middleware");
const Certificate = require("../models/Certificate");

// 🔐 Protected college dashboard
router.get("/dashboard", collageauthMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "college") {
      return res.status(403).json({ message: "Access denied" });
    }

    const collegeId = req.user._id;

    const totalCertificates = await Certificate.countDocuments({
      collegeId,
    });

    const verifiedCertificates = await Certificate.countDocuments({
      collegeId,
      blockchainTx: { $exists: true, $ne: null },
    });

    const pendingCertificates =
      totalCertificates - verifiedCertificates;

    res.json({
      college: req.user,
      stats: {
        totalCertificates,
        verifiedCertificates,
        pendingCertificates,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const colleges = await College.find()
      .select("_id name")
      .sort({ name: 1 });

    res.json(colleges);
  } catch (err) {
    console.error("GET COLLEGES ERROR:", err);
    res.status(500).json({ message: "Failed to fetch colleges" });
  }
});
module.exports = router;
