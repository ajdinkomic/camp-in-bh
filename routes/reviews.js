const express = require('express'),
  router = express.Router({
    mergeParams: true,
  }),
  Campground = require('../models/campground'),
  Review = require('../models/review'),
  User = require('../models/user'),
  Notification = require('../models/notification'),
  { isLoggedIn, checkReviewExistence, checkReviewOwnership } = require('../middleware');

// Reviews index
router.get('/', (req, res) => {
  Campground.findOne({
    slug: req.params.slug,
  })
    .populate({
      path: 'reviews',
      options: {
        sort: {
          createdAt: -1,
        },
      },
    })
    .exec((err, campground) => {
      if (err || !campground) {
        req.flash('error', err.message);
        return res.redirect('back');
      }
      res.render('reviews/index', {
        campground,
      });
    });
});

// Reviews new
router.get('/new', isLoggedIn, checkReviewExistence, (req, res) => {
  // checkReviewExistence checks if a user already reviewed the campground, only one review per user is allowed
  res.render('reviews/new', {
    campground: req.campground,
  });
});

// Reviews create
router.post('/', isLoggedIn, checkReviewExistence, (req, res) => {
  let campground = req.campground;

  Review.create(req.body.review, async (err, review) => {
    if (err) {
      req.flash('error', 'Nije moguće spremiti recenziju!');
      return res.redirect('back');
    }

    review.author.id = req.user._id;
    review.author.username = req.user.username;
    review.campground = campground;
    await review.save();

    campground.reviews.push(review);
    campground.rating = calculateAvg(campground.reviews);
    await campground.save();

    let user = await User.findById(campground.author.id).populate('notifications').exec();
    let newNotification = {
      username: req.user.username,
      link: `/campgrounds/${campground.slug}`,
      text: `Nova recenzija za kamp: ${campground.name} od korisnika: ${req.user.username}!`,
    };
    let notification = await Notification.create(newNotification);

    user.notifications.push(notification);
    await user.save();

    req.flash('success', 'Hvala! Vaša recenzija je uspješno spremljena.');
    res.redirect(`/campgrounds/${campground.slug}`);
  });
});

// Reviews edit
router.get('/:review_id/edit', isLoggedIn, checkReviewOwnership, (req, res) => {
  res.render('reviews/edit', {
    campground_slug: req.params.slug,
    review: req.review,
  });
});

// Reviews update
router.put('/:review_id', isLoggedIn, checkReviewOwnership, async (req, res) => {
  let review = req.review;

  review.rating = req.body.review.rating;
  review.text = req.body.review.text;

  await review.save();

  Campground.findOne({
    slug: req.params.slug,
  })
    .populate('reviews')
    .exec((err, campground) => {
      if (err || !campground) {
        req.flash('error', 'Nije moguće urediti recenziju!');
        return res.redirect('back');
      }
      campground.rating = calculateAvg(campground.reviews);
      campground.save();
      req.flash('success', 'Recenzija uspješno uređena!');
      res.redirect(`/campgrounds/${campground.slug}`);
    });
});

// Reviews delete
router.delete('/:review_id', isLoggedIn, checkReviewOwnership, async (req, res) => {
  let review = req.review;
  await review.remove();

  Campground.findOneAndUpdate(
    {
      slug: req.params.slug,
    },
    {
      $pull: {
        reviews: req.params.review_id,
      },
    },
    {
      new: true,
    }
  )
    .populate('reviews')
    .exec((err, campground) => {
      if (err || !campground) {
        req.flash('error', 'Nije moguće obrisati recenziju!');
        return res.redirect('back');
      }
      campground.rating = calculateAvg(campground.reviews);
      campground.save();
      req.flash('success', 'Recenzija uspješno obrisana!');
      res.redirect(`/campgrounds/${campground.slug}`);
    });
});

function calculateAvg(reviews) {
  if (reviews.length === 0) {
    return 0;
  }
  let sum = 0;
  reviews.forEach((element) => {
    sum += element.rating;
  });
  return sum / reviews.length;
}

module.exports = router;
