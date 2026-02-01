const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["student", "college", "admin"],
      default: "student",
    },

    /* =========================
       🔐 AADHAAR (STUDENT ONLY)
       NEVER store raw Aadhaar
    ========================= */
    aadhaarHash: {
      type: String,
      unique: true,
      sparse: true, // allows non-student users
    },

    aadhaarLast4: {
      type: String,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/* =========================
   INDEXES (SINGLE SOURCE)
========================= */

// 🔒 One Aadhaar = One student
userSchema.index(
  { aadhaarHash: 1 },
  {
    unique: true,
    sparse: true,
  }
);

module.exports = mongoose.model("User", userSchema);
