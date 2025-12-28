const mongoose = require("mongoose");
const { Schema } = mongoose;

const CommentSchema = new Schema(
  {
    content: {
      type: String,
      required: [true, "Comment content is required"],
      trim: true
    },
    blog: {
      type: Schema.Types.ObjectId,
      ref: "Blog",
      required: [true, "Comment must belong to a blog"],
      index: true
    },
    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "Comment",
      index: true
    },
    replies: [{
      type: Schema.Types.ObjectId,
      ref: "Comment"
    }],
    likes: [{
      type: Schema.Types.ObjectId,
      ref: "User"
    }],
    isEdited: {
      type: Boolean,
      default: false
    },
    isSpam: {
      type: Boolean,
      default: false,
      index: true
    },
    reportedCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtuals
CommentSchema.virtual("likeCount").get(function() {
  return this.likes.length;
});

CommentSchema.virtual("replyCount").get(function() {
  return this.replies.length;
});

// Indexes
CommentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Comment", CommentSchema);