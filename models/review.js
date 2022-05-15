const mongoose = require("mongoose"),

  reviewSchema = new mongoose.Schema({
    rating: {
      type: Number,
      required: "Ocjena je obavezna (1-5 zvjezdica).",
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: "{VALUE} nije numerička vrijednost."
      }
    },
    text: {
      type: String
    },
    author: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      username: String
    },
    campground: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Campground"
    }
  }, {
    timestamps: true
  });

module.exports = mongoose.model("Review", reviewSchema);