const mongoose = require("mongoose");

const GroupTaskSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["pending", "completed"], default: "pending" },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dueDate: { type: Date },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupTask", GroupTaskSchema);

