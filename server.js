const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());

// =============================
// 🔓 SERVE UPLOADED FILES
// =============================
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"))
);

// 🔥 CONNECT MONGODB FIRST
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB connected");

    // Routes
    app.use("/api/auth", require("./src/routes/auth.routes"));
    app.use("/api/user", require("./src/routes/user.routes"));
    app.use("/api/certificates", require("./src/routes/certificate.routes"));
    app.use("/api/college", require("./src/routes/college.routes"));
    app.use("/api/marksheets", require("./src/routes/marksheet.routes"));


    const PORT = 5500;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      console.log(`Uploads available at http://0.0.0.0:${PORT}/uploads`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err);
  });
