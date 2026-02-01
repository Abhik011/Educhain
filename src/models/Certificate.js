const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
  {
    // 🔑 PUBLIC CERTIFICATE ID
    certId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // 👤 STUDENT (AFTER CLAIM)
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // 🏫 ISSUING COLLEGE
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },

    studentName: {
      type: String,
      required: true,
    },

    course: {
      type: String,
      required: true,
    },

    rollNumber: {
      type: String,
      required: true,
      index: true,
    },

    year: {
      type: String,
      required: true,
      index: true,
    },

    // 🔐 AADHAAR (SAFE STORAGE)
    aadhaarHash: {
      type: String,
      required: true,
      index: true,
    },

    aadhaarLast4: {
      type: String,
      required: true,
      match: /^[0-9]{4}$/,
    },

    // ☁️ FILE STORAGE
    filePath: {
      type: String,
      required: false, // legacy support
    },

    s3Key: {
      type: String,
      required: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    // 🔐 BLOCKCHAIN INTEGRITY
    fileHash: {
      type: String,
      required: true,
    },

    blockchainTx: {
      type: String,
      required: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    // 🔓 CLAIM STATUS
    studentClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

/* ===========================
   INDEXES (VERY IMPORTANT)
=========================== */

// 🔍 Import / lookup (NOT UNIQUE)
CertificateSchema.index({
  collegeId: 1,
  rollNumber: 1,
  year: 1,
});

// 🔒 ONE CERTIFICATE → ONE STUDENT ONLY
// (Allows unclaimed certs because of sparse)
CertificateSchema.index(
  { studentId: 1, certId: 1 },
  { unique: true, sparse: true }
);

// 🔒 ONE AADHAAR → ONE CERTIFICATE ID
CertificateSchema.index(
  { aadhaarHash: 1, certId: 1 },
  { unique: true }
);

module.exports = mongoose.model("Certificate", CertificateSchema);
