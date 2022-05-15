const mongoose = require("mongoose"),

  notificationSchema = new mongoose.Schema({
    username: String,
    link: String,
    text: String,
    isRead: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });

module.exports = mongoose.model("Notification", notificationSchema)