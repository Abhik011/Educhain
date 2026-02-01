const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const mongoose = require ("mongoose");
const authCollege = require("../middleware/collegeauth.middleware");
const authStudent = require("../middleware/auth.middleware");

const Marksheet = require("../models/Marksheet");
const blockchain = require("../services/blockchain.service");
const watermarkPdf = require("../utils/watermarkPdf");
const { uploadPdfToS3, getSignedPdfUrl } = require("../services/s3.service");

const router = express.Router();

/* ===========================
   MULTER (MEMORY)
=========================== */
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_, file, cb) => {
    if (file.mimetype !== "application/pdf") {
      return cb(new Error("Only PDF allowed"));
    }
    cb(null, true);
  },
});

/* ===========================
   ISSUE MARKSHEET (COLLEGE)
=========================== */
router.post(
  "/issue",
  authCollege,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.user.role !== "college") {
        return res.status(403).json({ message: "Only college allowed" });
      }

      const { rollNumber, course, semester, year, aadhaarNumber } = req.body;

      if (!rollNumber || !course || !semester || !year || !aadhaarNumber) {
        return res.status(400).json({ message: "Missing fields" });
      }

      if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({ message: "Invalid Aadhaar number" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "PDF required" });
      }

      // 🔐 HASH AADHAAR
      const aadhaarHash = crypto
        .createHash("sha256")
        .update(aadhaarNumber)
        .digest("hex");

      const aadhaarLast4 = aadhaarNumber.slice(-4);

      // ❌ DUPLICATE CHECK
      const exists = await Marksheet.findOne({
        collegeId: req.user._id,
        aadhaarHash,
        semester,
        year,
      });

      if (exists) {
        return res.status(409).json({
          message: "Marksheet already issued for this semester",
        });
      }

      // 🖨️ WATERMARK
      const watermarkText = `
EduChain Marksheet
Roll No: ${rollNumber}
Semester: ${semester}
Aadhaar: XXXX-XXXX-${aadhaarLast4}
Issued: ${new Date().toLocaleString()}
      `.trim();

      const qrText = `${process.env.APP_URL}/api/marksheets/verify/${rollNumber}-${semester}-${year}`;

      const watermarkedPdf = await watermarkPdf({
        inputBuffer: req.file.buffer,
        watermarkText,
        qrText,
      });

      // 🔐 HASH PDF
      const fileHash = crypto
        .createHash("sha256")
        .update(watermarkedPdf)
        .digest("hex");

      // ☁️ UPLOAD TO S3
      const s3 = await uploadPdfToS3(
        watermarkedPdf,
        `marksheets/${rollNumber}-sem-${semester}-${year}`
      );

      // 🔗 BLOCKCHAIN
      const tx = await blockchain.issueCertificate({
        certId: `MARKSHEET-${rollNumber}-${semester}-${year}`,
        studentName: rollNumber,
        course,
        fileHash,
      });

      // 💾 SAVE
      const marksheet = await Marksheet.create({
        collegeId: req.user._id,
        rollNumber,
        aadhaarHash,
        aadhaarLast4,
        course,
        semester,
        year,
        s3Key: s3.key,
        fileUrl: s3.url,
        fileHash,
        blockchainTx: tx.txHash,
        studentClaimed: false,
      });

      res.status(201).json({
        message: "Marksheet issued successfully",
        marksheetId: marksheet._id,
        semester,
        year,
        aadhaar: `XXXX-XXXX-${aadhaarLast4}`,
      });
    } catch (err) {
      console.error("MARKSHEET ISSUE ERROR:", err);
      res.status(500).json({ message: err.message });
    }
  }
);

/* ===========================
   AUTO IMPORT MARKSHEETS
=========================== */
router.post("/auto-import", authStudent, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const { collegeId } = req.body;

    if (!collegeId) {
      return res.status(400).json({ message: "College ID required" });
    }

    if (!req.user.aadhaarHash) {
      return res.status(400).json({ message: "Aadhaar not linked" });
    }

    const marksheets = await Marksheet.find({
  collegeId: new mongoose.Types.ObjectId(collegeId),
  aadhaarHash: req.user.aadhaarHash,
  studentClaimed: false,
}).populate("collegeId", "name");


    if (marksheets.length === 0) {
      return res.json({
        imported: 0,
        message: "No marksheets found",
      });
    }

    await Marksheet.updateMany(
      { _id: { $in: marksheets.map((m) => m._id) } },
      {
        $set: {
          studentId: req.user._id,
          studentClaimed: true,
        },
      }
    );

    res.json({
      imported: marksheets.length,
      marksheets: marksheets.map((m) => ({
        _id: m._id,
        semester: m.semester,
        year: m.year,
        course: m.course,
        college: m.collegeId?.name,
        fileUrl: m.fileUrl,
      })),
    });
  } catch (err) {
    console.error("AUTO IMPORT ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

/* ===========================
   GET MY MARKSHEETS (STUDENT)
=========================== */
router.get("/my", authStudent, async (req, res) => {
  try {
    const marksheets = await Marksheet.find({
      studentId: req.user._id,
    }).populate("collegeId", "name");

    const safe = marksheets.map((m) => ({
      _id: m._id,
      rollNumber: m.rollNumber,
      semester: m.semester,
      year: m.year,
      course: m.course,
      college: m.collegeId?.name,
      aadhaar: `XXXX-XXXX-${m.aadhaarLast4}`,
      issuedAt: m.createdAt,
      blockchainTx: m.blockchainTx,
      fileUrl: m.fileUrl,
    }));

    res.json({
      count: safe.length,
      marksheets: safe,
    });
  } catch (err) {
    console.error("GET MY MARKSHEETS ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});


/* ===========================
   DOWNLOAD MARKSHEET (SECURE)
=========================== */
router.get("/download/:id", authStudent, async (req, res) => {
  try {
    const marksheet = await Marksheet.findById(req.params.id);

    if (!marksheet) {
      return res.status(404).json({ message: "Marksheet not found" });
    }

    if (marksheet.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" });
    }

    const signedUrl = await getSignedPdfUrl(marksheet.s3Key, 300);

    res.json({
      downloadUrl: signedUrl,
      aadhaar: `XXXX-XXXX-${marksheet.aadhaarLast4}`,
    });
  } catch (err) {
    console.error("DOWNLOAD MARKSHEET ERROR:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
