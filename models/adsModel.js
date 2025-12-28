const mongoose = require("mongoose");

const advertisementSchema = new mongoose.Schema({
  websiteLink: { type: String, required: true },
  imagePath: { type: String, required: true },
  position: {
    type: String,
    enum: [
      "top_banner",
      "sidebar_top",
      "sidebar_bottom",
      "footer",
      "popup_ad",
      "homepage_top",
      "homepage_bottom",
      "article_sidebar",
      "article_footer",
      "mobile_popup",
    ],
    required: true,
  },
  uploadDate: { type: Date, default: Date.now },
});

const Advertisement = mongoose.model("Advertisement", advertisementSchema);
module.exports = Advertisement;
