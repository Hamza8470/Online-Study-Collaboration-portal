const mongoose = require("mongoose");

const GroupResourceSchema = new mongoose.Schema(
  {
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true, index: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["drive", "youtube", "pdf", "notes", "link", "other"],
      default: "link",
    },
    title: { type: String, required: true },
    url: { type: String, required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GroupResource", GroupResourceSchema);

