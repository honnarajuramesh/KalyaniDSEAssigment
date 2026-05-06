require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const assignmentRoutes = require("./routes/assignments");

const app = express();

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "PUT", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => {
    console.error("MongoDB connection error:", err.message);
    process.exit(1);
  });

app.use("/api/assignments", assignmentRoutes);

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use((req, res) =>
  res.status(404).json({ success: false, message: "Route not found." }),
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: "Internal server error." });
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () =>
  console.log(`DSE Assignment API running on port ${PORT}`),
);
