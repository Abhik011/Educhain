const mongoose = require("mongoose");

const marksheetSchema = new mongoose.Schema(
  {
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "College",
      required: true,
      index: true,
    },

    rollNumber: {
      type: String,
      required: true,
      index: true,
    },

    // 🔐 AADHAAR (SAFE)
    aadhaarHash: {
      type: String,
      required: true,
      index: true,
    },

    aadhaarLast4: {
      type: String,
      required: true,
    },

    course: {
      type: String,
      required: true,
    },

    semester: {
      type: String,
      required: true,
      index: true,
    },

    year: {
      type: String,
      required: true,
      index: true,
    },

    // 🔗 STUDENT WALLET
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },

    studentClaimed: {
      type: Boolean,
      default: false,
      index: true,
    },

    s3Key: {
      type: String,
      required: true,
    },

    fileUrl: {
      type: String,
      required: true,
    },

    fileHash: {
      type: String,
      required: true,
    },

    blockchainTx: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

// 🔒 ONE MARKSHEET PER AADHAAR PER SEMESTER PER COLLEGE
marksheetSchema.index(
  { collegeId: 1, aadhaarHash: 1, semester: 1, year: 1 },
  { unique: true }
);

module.exports = mongoose.model("Marksheet", marksheetSchema);
