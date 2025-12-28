const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    required: true,
    enum: ["DELETE_COMMENT", "ROLE_CHANGE", "CONTENT_EDIT"]
  },
  targetId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, { 
  timestamps: true,
  capped: { size: 1024 * 1024 * 10, max: 10000 } // 10MB capped collection
});

module.exports = mongoose.model("AuditLog", auditLogSchema);