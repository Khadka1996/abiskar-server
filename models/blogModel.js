const mongoose = require("mongoose");
const slugify = require("slugify");

const BlogSchema = new mongoose.Schema(
  {
    title: { 
      type: String, 
      required: [true, "Title is required"],
      trim: true,
      index: true
    },
    slug: {
      type: String,
      unique: true,
      index: true
    },
    subheading: { 
      type: String,
      trim: true
    },
    content: { 
      type: String, 
      required: [true, "Content is required"],
      trim: true
    },
    image: { 
      type: String,
      required: true
    },
    youtubeLink: { 
      type: String,
      validate: {
        validator: v => !v || /^(https?\:\/\/)?(www\.)?(youtube\.com|youtu\.?be)\/.+$/.test(v),
        message: "Invalid YouTube URL format"
      }
    },
    shareCount: { 
      type: Number, 
      default: 0
    },
    viewCount: { 
      type: Number, 
      default: 0
    },
    likes: [{ 
      type: mongoose.Schema.Types.ObjectId, 
    }],
    isTrending: { 
      type: Boolean, 
      default: false,
      index: true 
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    comments: [{ 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Comment" 
    }],
    tags: [{
      type: String,
      trim: true,
      index: true
    }]
  },
  { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtuals
BlogSchema.virtual("likeCount").get(function() {
  return this.likes.length;
});

BlogSchema.virtual("commentCount").get(function() {
  return this.comments.length;
});

// Indexes
BlogSchema.index({ title: "text", content: "text" });
BlogSchema.index({ createdAt: -1 });

// Middleware
BlogSchema.pre("save", function(next) {
  this.slug = slugify(this.title, { lower: true, strict: true });
  next();
});

module.exports = mongoose.model("Blog", BlogSchema);