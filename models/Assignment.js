const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    mobileNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^\d{10}$/, "Mobile number must be 10 digits"],
    },
    agentId: {
      type: String,
      required: true,
      trim: true,
    },
    lead: {
      type: String,
      required: true,
      trim: true,
    },
    assignedAt: {
      type: Date,
      default: Date.now,
    },
    // Derived fields stored for fast querying — month & year extracted at write time
    month: {
      type: Number, // 1–12
      required: true,
    },
    year: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true },
);

// Compound index for efficient monthly lookups per DSE
assignmentSchema.index({ mobileNumber: 1, year: 1, month: 1 });

module.exports = mongoose.model("Assignment", assignmentSchema);
