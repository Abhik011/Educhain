const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const Marksheet = require("../models/Marksheet");
const Transcript = require("../models/Transcript");
const blockchain = require("../services/blockchain.service");
const { generateTranscript } = require("../services/transcript.service");
const fs = require("fs");

const router = express.Router();

/* ===========================
   GENERATE FINAL TRANSCRIPT
=========================== */
router.post("/generate", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Only students allowed" });
    }

    const marksheets = await Marksheet.find({
      studentId: req.user._id,
    }).sort({ semester: 1 });

    if (marksheets.length === 0) {
      return res.status(400).json({ message: "No marksheets found" });
    }

    const student = req.user;
    const qrText = `${process.env.PUBLIC_BASE_URL}/verify/transcript/${student._id}`;

    const pdfBytes = await generateTranscript({
      student,
      marksheets,
      qrText,
    });

    const filePath = `uploads/transcripts/${student._id}.pdf`;
    fs.writeFileSync(filePath, pdfBytes);

    const tx = await blockchain.issueCertificate({
      certId: `TRANSCRIPT-${student._id}`,
      studentName: student.name,
      course: marksheets[0].course,
      fileHash: "auto-generated",
    });

    const transcript = await Transcript.create({
      studentId: student._id,
      collegeId: marksheets[0].collegeId,
      rollNumber: marksheets[0].rollNumber,
      course: marksheets[0].course,
      semesters: marksheets.map((m) => m.semester),
      filePath,
      fileUrl: `/${filePath}`,
      blockchainTx: tx.txHash,
    });

    res.json({
      message: "Transcript generated successfully",
      fileUrl: transcript.fileUrl,
      txHash: transcript.blockchainTx,
    });
  } catch (err) {
    console.error("TRANSCRIPT ERROR:", err);
    res.status(500).json({ message: "Transcript generation failed" });
  }
});

module.exports = router;
