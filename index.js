const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();

// ✅ middleware
app.use(cors());
app.use(express.json());

// ✅ routes
app.use("/skills", require("./routes/skillRoutes"));

// ✅ DB connection
mongoose.connect("mongodb://127.0.0.1:27017/skillsdb")
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log(err));

// ✅ server start
app.listen(5000, () => {
  console.log("Server running on port 5000");
});