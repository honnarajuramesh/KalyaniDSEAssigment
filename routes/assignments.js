const express = require("express");
const router = express.Router();
const Assignment = require("../models/Assignment");

const MONTHLY_LIMIT = 30;

// Helper — get current month/year (or from query for testing)
function getCurrentPeriod(query = {}) {
  const now = new Date();
  return {
    month: parseInt(query.month) || now.getMonth() + 1, // 1-based
    year: parseInt(query.year) || now.getFullYear(),
  };
}

// ─────────────────────────────────────────────
// POST /api/assignments
// Add a new assignment record for a DSE
// Body: { mobileNumber, agentId, lead }
// ─────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { mobileNumber, agentId, lead } = req.body;

    if (!mobileNumber || !agentId || !lead) {
      return res.status(400).json({
        success: false,
        message: "mobileNumber, agentId, and lead are required.",
      });
    }

    const { month, year } = getCurrentPeriod();

    // Guard: enforce 30-lead monthly cap before inserting
    const currentCount = await Assignment.countDocuments({
      mobileNumber,
      month,
      year,
    });

    if (currentCount >= MONTHLY_LIMIT) {
      return res.status(409).json({
        success: false,
        message: `DSE ${mobileNumber} has already reached the ${MONTHLY_LIMIT}-lead limit for this month.`,
        currentCount,
        limit: MONTHLY_LIMIT,
      });
    }

    const assignment = await Assignment.create({
      mobileNumber,
      agentId,
      lead,
      month,
      year,
    });

    return res.status(201).json({
      success: true,
      message: "Assignment recorded successfully.",
      data: assignment,
      remaining: MONTHLY_LIMIT - (currentCount + 1),
    });
  } catch (err) {
    console.error("POST /assignments error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error.", error: err.message });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/assignments/:id
// Delete a specific assignment record by its _id
// ─────────────────────────────────────────────

// DELETE /api/assignments/by-data
// Body: { mobileNumber, agentId, lead }
router.delete("/by-data", async (req, res) => {
  try {
    const { mobileNumber, agentId, lead } = req.body;

    if (!mobileNumber || !agentId || !lead) {
      return res.status(400).json({
        success: false,
        message: "mobileNumber, agentId, and lead are required.",
      });
    }

    const deleted = await Assignment.findOneAndDelete({
      mobileNumber,
      agentId,
      lead,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "No matching assignment found." });
    }

    return res.json({
      success: true,
      message: "Assignment deleted successfully.",
      data: deleted,
    });
  } catch (err) {
    console.error("DELETE /assignments/by-data error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error.", error: err.message });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Assignment.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res
        .status(404)
        .json({ success: false, message: "Assignment record not found." });
    }

    return res.json({
      success: true,
      message: "Assignment deleted successfully.",
      data: deleted,
    });
  } catch (err) {
    console.error("DELETE /assignments/:id error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error.", error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/assignments/maxed-out
// Returns all DSEs who have hit the 30-lead cap this month
// Query (optional): ?month=6&year=2025  (defaults to current month)
// ─────────────────────────────────────────────
router.get("/maxed-out", async (req, res) => {
  try {
    const { month, year } = getCurrentPeriod(req.query);

    // Aggregate: group by mobileNumber, count records, filter >= 30
    const maxedDSEs = await Assignment.aggregate([
      { $match: { month, year } },
      {
        $group: {
          _id: "$mobileNumber",
          count: { $sum: 1 },
          // Grab the latest agentId for reference
          lastAgentId: { $last: "$agentId" },
        },
      },
      { $match: { count: { $gte: MONTHLY_LIMIT } } },
      {
        $project: {
          _id: 0,
          mobileNumber: "$_id",
          assignmentCount: "$count",
          lastAgentId: 1,
        },
      },
      { $sort: { mobileNumber: 1 } },
    ]);

    return res.json({
      success: true,
      month,
      year,
      limit: MONTHLY_LIMIT,
      total: maxedDSEs.length,
      data: maxedDSEs,
    });
  } catch (err) {
    console.error("GET /assignments/maxed-out error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error.", error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /api/assignments/check/:mobileNumber
// Check if a specific DSE has capacity (< 30) this month
// Query (optional): ?month=6&year=2025
// ─────────────────────────────────────────────
router.get("/check/:mobileNumber", async (req, res) => {
  try {
    const { mobileNumber } = req.params;
    const { month, year } = getCurrentPeriod(req.query);

    const count = await Assignment.countDocuments({
      mobileNumber,
      month,
      year,
    });
    const remaining = MONTHLY_LIMIT - count;
    const canAssign = count < MONTHLY_LIMIT;

    return res.json({
      success: true,
      mobileNumber,
      month,
      year,
      assignmentCount: count,
      limit: MONTHLY_LIMIT,
      remaining: Math.max(remaining, 0),
      canAssign,
      message: canAssign
        ? `DSE can accept ${remaining} more lead(s) this month.`
        : `DSE has reached the ${MONTHLY_LIMIT}-lead limit for this month.`,
    });
  } catch (err) {
    console.error("GET /assignments/check/:mobileNumber error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error.", error: err.message });
  }
});

module.exports = router;
