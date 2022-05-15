const mongoose = require('mongoose');

//schema
const reservationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    campground: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Campground',
    },
    numberOfNights: Number,
    numberOfPersons: Number,
    price: Number,
    dateFrom: Date,
    dateTo: Date,
    isCanceled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Reservation', reservationSchema);
