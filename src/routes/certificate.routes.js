const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

const authMiddleware = require("../middleware/auth.middleware");
const collegeAuth = require("../middleware/collegeauth.middleware");

const blockchain = require("../services/blockchain.service");
const { uploadPdfToS3, getSignedPdfUrl } = require("../services/s3.service");

const Certificate = require("../models/Certificate");
const watermarkPdf = require("../utils/watermarkPdf");

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
   ISSUE CERTIFICATE (COLLEGE)
=========================== */
router.post(
  "/issue",
  collegeAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      if (req.user.role !== "college") {
        return res.status(403).json({ message: "Only college allowed" });
      }

      const {
        certId,
        studentName,
        course,
        rollNumber,
        year,
        aadhaarNumber,
      } = req.body;

      if (
        !certId ||
        !studentName ||
        !course ||
        !rollNumber ||
        !year ||
        !aadhaarNumber
      ) {
        return res.status(400).json({ message: "Missing fields" });
      }

      if (!/^[0-9]{12}$/.test(aadhaarNumber)) {
        return res.status(400).json({
          message: "Valid 12-digit Aadhaar number required",
        });
      }

      if (!req.file) {
        return res.status(400).json({ message: "PDF required" });
      }

      // 🔐 HASH AADHAAR (NEVER STORE RAW)
      const aadhaarHash = crypto
        .createHash("sha256")
        .update(aadhaarNumber)
        .digest("hex");

      const aadhaarLast4 = aadhaarNumber.slice(-4);

      // ❌ DUPLICATE CHECK (AADHAAR + CERT ID)
      const aadhaarExists = await Certificate.findOne({
        aadhaarHash,
        certId,
      });

      if (aadhaarExists) {
        return res.status(409).json({
          message: "This certificate is already issued for this Aadhaar",
        });
      }

      const watermarkText = `
Issued via EduChain
${studentName}
Roll No: ${rollNumber}
Aadhaar: XXXX-XXXX-${aadhaarLast4}
${new Date().toLocaleString()}
      `.trim();

      const qrText = `${process.env.APP_URL}/api/certificates/verify/${certId}`;

      // 🖨️ WATERMARK
      const watermarkedPdf = await watermarkPdf({
        inputBuffer: req.file.buffer,
        watermarkText,
        qrText,
      });

      // 🔐 HASH FINAL PDF
      const hash = crypto
        .createHash("sha256")
        .update(watermarkedPdf)
        .digest("hex");

      // ☁️ S3 UPLOAD
      const s3 = await uploadPdfToS3(watermarkedPdf, certId);

      // 🔗 BLOCKCHAIN
      const tx = await blockchain.issueCertificate({
        certId,
        studentName,
        course,
        fileHash: hash,
      });

      // 🗄️ SAVE
      await Certificate.create({
        certId,
        studentName,
        course,
        rollNumber,
        year,
        aadhaarHash,
        aadhaarLast4,
        collegeId: req.user._id,
        fileHash: hash,
        fileUrl: s3.url,
        s3Key: s3.key,
        blockchainTx: tx.txHash,
        studentClaimed: false,
      });

      res.json({
        message: "Certificate issued successfully",
        certId,
        aadhaar: `XXXX-XXXX-${aadhaarLast4}`,
        txHash: tx.txHash,
      });
    } catch (err) {
      console.error("ISSUE ERROR:", err);
      res.status(500).json({ message: "Issue failed" });
    }
  }
);

/* ===========================
   VERIFY CERTIFICATE (PUBLIC)
=========================== */
router.get("/verify/:value", async (req, res) => {
  try {
    const value = req.params.value.trim();

    const cert = await Certificate.findOne({
      $or: [{ certId: value }, { blockchainTx: value }],
    }).populate("collegeId", "name");

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    const chain = await blockchain.verifyCertificate(cert.certId);

    res.json({
      verified: true,
      certId: cert.certId,
      studentName: cert.studentName,
      course: cert.course,
      rollNumber: cert.rollNumber,
      year: cert.year,
      aadhaar: `XXXX-XXXX-${cert.aadhaarLast4}`,
      college: cert.collegeId?.name,
      txHash: cert.blockchainTx,
      issuedAt: cert.createdAt,
      blockchain: chain,
    });
  } catch (err) {
    console.error("VERIFY ERROR:", err);
    res.status(400).json({ message: "Verification failed" });
  }
});

router.post("/auto-import", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Students only" });
    }

    const student = req.user;

    if (!student.aadhaarHash) {
      return res.status(400).json({ message: "Aadhaar not linked" });
    }

    // 🔍 FIND ALL UNCLAIMED CERTS FOR THIS AADHAAR
    const certs = await Certificate.find({
      aadhaarHash: student.aadhaarHash,
      studentClaimed: false,
    }).populate("collegeId", "name");

    if (certs.length === 0) {
      return res.json({
        imported: 0,
        message: "No new certificates found",
      });
    }

    // 🔗 CLAIM ALL
    await Certificate.updateMany(
      {
        _id: { $in: certs.map((c) => c._id) },
      },
      {
        $set: {
          studentId: student._id,
          studentClaimed: true,
        },
      }
    );

    res.json({
      imported: certs.length,
      certificates: certs.map((c) => ({
        certId: c.certId,
        course: c.course,
        college: c.collegeId?.name,
        year: c.year,
        fileUrl: c.fileUrl,
      })),
    });
  } catch (err) {
    console.error("AUTO IMPORT ERROR:", err);
    res.status(500).json({ message: "Auto import failed" });
  }
});

/* ===========================
   IMPORT CERTIFICATE (STUDENT)
=========================== */
router.post("/import", authMiddleware, async (req, res) => {
  try {
    const { collegeId, rollNumber, year, aadhaarNumber } = req.body;

    if (!collegeId || !rollNumber || !year || !aadhaarNumber) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const aadhaarHash = crypto
      .createHash("sha256")
      .update(aadhaarNumber)
      .digest("hex");

    const cert = await Certificate.findOne({
      collegeId,
      rollNumber,
      year,
      aadhaarHash,
      studentClaimed: false,
    });

    if (!cert) {
      return res.status(404).json({ message: "Certificate not found" });
    }

    cert.studentId = req.user._id;
    cert.studentClaimed = true;
    await cert.save();

    res.json({
      message: "Certificate added to wallet",
      certificate: {
        certId: cert.certId,
        course: cert.course,
        year: cert.year,
        aadhaar: `XXXX-XXXX-${cert.aadhaarLast4}`,
        fileUrl: cert.fileUrl,
      },
    });
  } catch (err) {
    console.error("IMPORT ERROR:", err);
    res.status(500).json({ message: "Import failed" });
  }
});

/* ===========================
   MY CERTIFICATES (STUDENT)
=========================== */
router.get("/my", authMiddleware, async (req, res) => {
  if (req.user.role !== "student") {
    return res.status(403).json({ message: "Only students allowed" });
  }

  const certs = await Certificate.find({
    studentId: req.user._id,
  }).populate("collegeId", "name");

  const safe = certs.map((c) => ({
    certId: c.certId,
    studentName: c.studentName,
    course: c.course,
    year: c.year,
    college: c.collegeId?.name,
    aadhaar: `XXXX-XXXX-${c.aadhaarLast4}`,
    issuedAt: c.issuedAt,
    fileUrl: c.fileUrl,
    blockchainTx: c.blockchainTx,
  }));

  res.json(safe);
});

/* ===========================
   SECURE DOWNLOAD (STUDENT)
=========================== */
router.get("/download/:certId", authMiddleware, async (req, res) => {
  const cert = await Certificate.findOne({ certId: req.params.certId });

  if (!cert) {
    return res.status(404).json({ message: "Certificate not found" });
  }

  if (cert.studentId.toString() !== req.user._id.toString()) {
    return res.status(403).json({ message: "Access denied" });
  }

  const signedUrl = await getSignedPdfUrl(cert.s3Key, 300);

  res.json({ downloadUrl: signedUrl });
});


module.exports = router;
