const Comment = require("../models/commentModels");
const User = require("../models/userModels");
const AuditLog = require("../models/auditLogModel");

// Delete any comment (Admin only)
exports.deleteAnyComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    await AuditLog.create({
      action: "DELETE_COMMENT",
      targetId: comment._id,
      performedBy: req.user._id,
      metadata: {
        contentPreview: comment.content.substring(0, 50) + (comment.content.length > 50 ? "..." : "")
      }
    });

    await comment.deleteOne();

    res.status(200).json({ message: "Comment deleted by Admin", commentId: comment._id });
  } catch (error) {
    console.error("Admin Comment Deletion Error:", error.message);
    res.status(500).json({
      message: "Server Error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Promote user to moderator
exports.makeModerator = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.role === "moderator") {
      return res.status(400).json({
        message: "User is already a moderator",
        userId: user._id
      });
    }

    const previousRole = user.role;
    user.role = "moderator";

    await AuditLog.create({
      action: "ROLE_CHANGE",
      targetId: user._id,
      performedBy: req.user._id,
      metadata: {
        from: previousRole,
        to: "moderator"
      }
    });

    await user.save();

    res.status(200).json({
      message: `${user.username} promoted to moderator`,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error("Role Promotion Error:", error.message);
    res.status(500).json({
      message: "Server Error",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
