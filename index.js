const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const cors = require("cors");

const app = express();

// ✅ middleware
app.use(cors());
app.use(express.json());

// ✅ routes
app.use("/skills", require("./routes/skillRoutes"));

// ✅ DB connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.log("❌ Error:", err));

// ✅ server start
app.listen(5000, () => {
  console.log("Server running on port 5000");
});