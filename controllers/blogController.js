const Blog = require('../models/blogModel');
const Comment = require('../models/commentModels');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const unlinkAsync = promisify(fs.unlink);
const he = require('he');
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 60 });

// Helper to delete file
const deleteFile = async (filePath) => {
  try {
    await unlinkAsync(path.join(__dirname, '../uploads', filePath));
  } catch (err) {
    console.error('Error deleting file:', err.message);
  }
};

// Blog CRUD Operations
const createBlog = async (req, res) => {
  try {
    console.log('createBlog received:', {
      body: req.body,
      file: req.file,
      headers: req.headers,
    });

    const { title, content, youtubeLink, subheading, tags } = req.body;

    if (!title || !content) {
      if (req.file) await fs.unlink(path.join(__dirname, '../uploads', req.file.filename));
      const errorMsg = 'Title and content are required';
      console.log('Validation error:', errorMsg);
      return res.status(400).json({
        success: false,
        error: errorMsg,
      });
    }

    if (!req.file) {
      const errorMsg = 'Featured image is required';
      console.log('Validation error:', errorMsg);
      return res.status(400).json({
        success: false,
        error: errorMsg,
      });
    }

    const blog = await Blog.create({
      title,
      content,
      youtubeLink,
      subheading,
      tags: Array.isArray(tags) ? tags : tags ? tags.split(',') : [],
      image: req.file.filename,
    });

    console.log('Blog created successfully:', blog._id);
    res.status(201).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    console.error('createBlog error:', {
      message: err.message,
      stack: err.stack,
    });
    if (req.file) await fs.unlink(path.join(__dirname, '../uploads', req.file.filename));
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};
const getAllBlogs = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;
    const searchQuery = req.query.search || '';

    // Sanitize search input to prevent regex injection
    const sanitizeRegex = (input) => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sanitizedSearchQuery = sanitizeRegex(searchQuery);

    // Build the query
    const query = { isPublished: true };
    if (sanitizedSearchQuery) {
      query.$or = [
        { title: { $regex: sanitizedSearchQuery, $options: 'i' } },
        { content: { $regex: sanitizedSearchQuery, $options: 'i' } },
        { tags: { $regex: sanitizedSearchQuery, $options: 'i' } },
      ];
    }

    // Get total count for pagination
    const total = await Blog.countDocuments(query);

    // Get paginated results
    const blogs = await Blog.find(query)
      .sort({ createdAt: -1 }) // Sort by newest first
      .skip(skip)
      .limit(limit)
      .lean();

    res.status(200).json({
      success: true,
      count: blogs.length,
      total,
      data: blogs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};


const getBlog = async (req, res) => {
  try {
    const cacheKey = `blog_${req.params.id}`;
    const cachedBlog = cache.get(cacheKey);

    // Return cached data if available
    if (cachedBlog) {
      return res.status(200).json({
        success: true,
        data: cachedBlog,
      });
    }

    // Fetch blog from database
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { $inc: { viewCount: 1 } },
      { new: true, lean: true } // Use lean for better performance
    ).populate({
      path: 'comments',
      select: 'content author createdAt', // Select only necessary fields
      options: { lean: true },
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found',
      });
    }

    // Decode content only if necessary
    const decodedContent = blog.content ? he.decode(blog.content) : blog.content;
    const blogData = { ...blog, content: decodedContent };

    // Store in cache
    cache.set(cacheKey, blogData);

    res.status(200).json({
      success: true,
      data: blogData,
    });
  } catch (err) {
    console.error('Error fetching blog:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};


const updateBlog = async (req, res) => {
  try {
    const { title, content, youtubeLink, subheading, tags } = req.body;
    const updateData = {
      title,
      content,
      youtubeLink,
      subheading,
      tags: Array.isArray(tags) ? tags : tags ? tags.split(',') : req.blog.tags,
    };

    // Ensure an image is present (new upload or existing)
    if (req.file) {
      // Delete old image if it exists
      if (req.blog.image) {
        await deleteFile(req.blog.image);
      }
      updateData.image = req.file.filename;
    } else if (!req.blog.image) {
      return res.status(400).json({
        success: false,
        error: 'Featured image is required',
      });
    }

    const updatedBlog = await Blog.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      data: updatedBlog,
    });
  } catch (err) {
    if (req.file) await deleteFile(req.file.filename);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found',
      });
    }

    if (blog.image) {
      await deleteFile(blog.image);
    }

    await Blog.findByIdAndDelete(req.params.id);
    res.status(200).json({
      success: true,
      data: {},
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Blog Interaction Methods
const getTopArticle = async (req, res) => {
  try {
    const topArticle = await Blog.findOne({ isPublished: true })
      .sort({ viewCount: -1 })
      .limit(1);

    if (!topArticle) {
      return res.status(404).json({
        success: false,
        error: 'No articles found',
      });
    }

    res.status(200).json({
      success: true,
      data: topArticle,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const likeBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found',
      });
    }

    const userId = req.user._id;
    const likeIndex = blog.likes.indexOf(userId);

    if (likeIndex === -1) {
      blog.likes.push(userId);
    } else {
      blog.likes.splice(likeIndex, 1);
    }

    await blog.save();
    res.status(200).json({
      success: true,
      data: blog,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

// Comment Methods
const addComment = async (req, res) => {
  try {
    const comment = await Comment.create({
      content: req.body.content,
      blog: req.params.id,
      user: req.user.id,
    });

    await Blog.findByIdAndUpdate(req.params.id, {
      $push: { comments: comment._id },
    });

    res.status(201).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const getBlogComments = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id).populate({
      path: 'comments',
      match: { isSpam: false },
      populate: {
        path: 'replies',
        match: { isSpam: false },
      },
    });

    if (!blog) {
      return res.status(404).json({
        success: false,
        error: 'Blog not found',
      });
    }

    res.status(200).json({
      success: true,
      count: blog.comments.length,
      data: blog.comments,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const likeComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    const userId = req.user._id;
    const likeIndex = comment.likes.indexOf(userId);

    if (likeIndex === -1) {
      comment.likes.push(userId);
    } else {
      comment.likes.splice(likeIndex, 1);
    }

    await comment.save();
    res.status(200).json({
      success: true,
      data: comment,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const reportComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      {
        $inc: { reportedCount: 1 },
        $set: { isSpam: true },
      },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    res.status(200).json({
      success: true,
      data: comment,
      message: 'Comment reported successfully',
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({
        success: false,
        error: 'Comment not found',
      });
    }

    if (
      comment.user.toString() !== req.user._id.toString() &&
      !['admin', 'moderator'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to delete this comment',
      });
    }

    if (!comment.parentComment) {
      await Blog.findByIdAndUpdate(comment.blog, {
        $pull: { comments: comment._id },
      });
    }

    if (comment.replies.length > 0) {
      await Comment.deleteMany({ _id: { $in: comment.replies } });
    }

    await comment.deleteOne();
    res.status(200).json({
      success: true,
      data: { id: req.params.id },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};

const getTopViewedArticle = async (req, res) => {
  try {
    const topArticle = await Blog.findOne({ isPublished: true })
      .sort('-viewCount') // Sort by highest viewCount
    if (!topArticle) {
      return res.status(404).json({ success: false, message: 'No article found' });
    }
    res.status(200).json({ success: true, topArticle });
  } catch (err) {
    console.error('Error fetching top article:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

const getLatestArticles = async (req, res) => {
  try {
    const blogs = await Blog.find({ isPublished: true }).sort('-createdAt').limit(4);
    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
};


// Export all methods
module.exports = {
  createBlog,
  getAllBlogs,
  getBlog,
  updateBlog,
  deleteBlog,
  getTopArticle,
  likeBlog,
  addComment,
  getBlogComments,
  likeComment,
  reportComment,
  deleteComment,
  getTopViewedArticle,
  getLatestArticles
};