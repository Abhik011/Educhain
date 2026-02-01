const mongoose = require("mongoose");

const transcriptSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  collegeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "College",
    required: true,
  },

  rollNumber: String,
  course: String,

  semesters: [Number], // [1,2,3,4,5,6,7,8]

  filePath: String,
  fileUrl: String,

  blockchainTx: String,

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Transcript", transcriptSchema);
