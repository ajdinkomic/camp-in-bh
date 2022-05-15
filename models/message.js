const mongoose = require("mongoose"),

  messageSchema = new mongoose.Schema({
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    body: String,
    isRead: {
      type: Boolean,
      default: false
    }
  }, {
    timestamps: true
  });

module.exports = mongoose.model("Message", messageSchema);