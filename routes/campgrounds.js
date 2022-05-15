const express = require('express'),
  router = express.Router(),
  moment = require('moment'),
  Campground = require('../models/campground'),
  User = require('../models/user'),
  Notification = require('../models/notification'),
  Reservation = require('../models/reservation'),
  multer = require('multer'),
  cloudinary = require('cloudinary').v2,
  axios = require('axios'),
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const { isLoggedIn, checkCampgroundOwnership } = require('../middleware'); // if we require folder it requires automatically file named index.js

// multer config
const storage = multer.diskStorage({
  filename: (req, file, callback) => {
    callback(null, Date.now() + file.originalname);
  },
});
const imageFilter = (req, file, cb) => {
  // only accept images
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error('Samo slike formata .jpg, .jpeg, .png i .gif su dozvoljene!'), false);
  }
  cb(null, true);
};
const upload = multer({
  storage: storage,
  fileFilter: imageFilter,
});

// cloudinary config
cloudinary.config({
  cloud_name: 'ajdinkomiccloud',
  api_key: process.env.CLOUDINARY_API,
  api_secret: process.env.CLOUDINARY_SECRET,
});

// INDEX - show all campgrounds
router.get('/', (req, res) => {
  const perPage = 6;
  const pageQuery = parseInt(req.query.page);
  const pageNumber = pageQuery ? pageQuery : 1;
  if (req.query.search) {
    // make a new regexp
    const regexp = new RegExp(escapeRegexp(req.query.search), 'gi'); // 'gi' are flags, g-global, i-ignore case(uppercase and lowercase)
    // get all campgrounds from db whose name matches search input
    Campground.find({
      $or: [
        {
          name: regexp,
        },
        {
          city: regexp,
        },
      ],
    })
      .sort({
        updatedAt: -1,
      })
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec((err, allCampgrounds) => {
        Campground.countDocuments({
          $or: [
            {
              name: regexp,
            },
            {
              city: regexp,
            },
          ],
        }).exec((err, count) => {
          if (err) {
            req.flash('error', 'Nije moguće dohvatiti kampove iz baze!');
            return res.redirect('back');
          } else {
            res.render('campgrounds/index', {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              search: req.query.search,
            });
          }
        });
      });
  } else {
    // get all campgrounds from db
    Campground.find({})
      .sort({
        createdAt: -1,
      })
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec((err, allCampgrounds) => {
        Campground.countDocuments().exec((err, count) => {
          if (err) {
            req.flash('error', 'Kampovi nisu pronađeni!');
            return res.redirect('back');
          } else {
            res.render('campgrounds/index', {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              search: false,
            });
          }
        });
      });
  }
});

// CREATE - add new campground to DB
router.post('/', isLoggedIn, upload.single('image'), async (req, res) => {
  try {
    let result = req.file ? await cloudinary.uploader.upload(req.file.path) : null;

    let location = `${req.body.street} ${req.body.streetNumber}, ${req.body.postalCode} ${req.body.city}`;
    let place = encodeURIComponent(location);
    let mapboxURI = `https://api.mapbox.com/geocoding/v5/mapbox.places/${place}.json?bbox=15.7%2C42.55%2C19.55%2C45.3&limit=1&types=address&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
    let lng = null;
    let lat = null;

    const response = await axios.get(mapboxURI);
    if (!response || response.length === 0 || !response.data?.features || response.data?.features.length === 0) {
      throw new Error('Adresa koju ste unijeli nije validna!');
    } else {
      lng = response.data.features[0].geometry?.coordinates[0];
      lat = response.data.features[0].geometry?.coordinates[1];
    }

    // get data from form and add to campgrounds array
    const name = req.body.name,
      image = result?.secure_url,
      imageId = result?.public_id,
      description = req.body.description,
      price = req.body.price,
      author = {
        id: req.user._id,
        username: req.user.username,
      },
      street = req.body.street,
      streetNumber = req.body.streetNumber,
      city = req.body.city,
      postalCode = req.body.postalCode;

    const newCampground = {
      name,
      price,
      image,
      imageId,
      description,
      author,
      street,
      streetNumber,
      city,
      postalCode,
      lat,
      lng,
    };

    let campground = await Campground.create(newCampground);
    let user = await User.findById(req.user._id).populate('followers').exec();
    let newNotification = {
      username: req.user.username,
      link: `/campgrounds/${campground.slug}`,
      text: `Korisnik: ${req.user.username} je krerirao/la novi kamp: ${name}!`,
    };

    for (const follower of user.followers) {
      let notification = await Notification.create(newNotification);
      follower.notifications.push(notification);
      follower.save();
    }

    req.flash('success', 'Hvala! Vaš kamp je uspješno spremljen.');
    res.redirect(`/campgrounds/${campground.slug}`);
  } catch (err) {
    req.flash('error', 'Nije moguće spremiti kamp!');
    return res.redirect('back');
  }
});

// NEW - show form to create new campground
router.get('/new', isLoggedIn, (req, res) => {
  res.render('campgrounds/new');
});

// FAVORITES - show all favorite campgrounds
router.get('/favorites', isLoggedIn, (req, res) => {
  const perPage = 6;
  const pageQuery = parseInt(req.query.page);
  const pageNumber = pageQuery ? pageQuery : 1;
  const favorites = req.user.favorites;

  if (req.query.search) {
    // make a new regexp
    const regexp = new RegExp(escapeRegexp(req.query.search), 'gi'); // 'gi' are flags, g-global, i-ignore case(uppercase and lowercase)
    // get all campgrounds from db whose name matches search input
    Campground.find({
      _id: {
        $in: favorites,
      },
      $or: [
        {
          name: regexp,
        },
        {
          city: regexp,
        },
      ],
    })
      .sort({
        createdAt: -1,
      })
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec((err, favoriteCampgrounds) => {
        Campground.countDocuments({
          _id: {
            $in: favorites,
          },
          $or: [
            {
              name: regexp,
            },
            {
              city: regexp,
            },
          ],
        }).exec((err, count) => {
          if (err) {
            req.flash('error', 'Nije moguće dohvatiti kampove iz baze!');
            return res.redirect('back');
          } else {
            res.render('campgrounds/favorites', {
              campgrounds: favoriteCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              search: req.query.search,
            });
          }
        });
      });
  } else {
    // get all campgrounds from db
    Campground.find({
      _id: {
        $in: favorites,
      },
    })
      .sort({
        createdAt: -1,
      })
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec((err, favoriteCampgrounds) => {
        Campground.countDocuments({
          _id: {
            $in: favorites,
          },
        }).exec((err, count) => {
          if (err) {
            req.flash('error', 'Kampovi nisu pronađeni!');
            return res.redirect('back');
          } else {
            res.render('campgrounds/favorites', {
              campgrounds: favoriteCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
              search: false,
            });
          }
        });
      });
  }
});

// this has to be declared last because it is /campgrounds/anything, so it could be /campgrounds/new and we don't want that
// SHOW - info about one specific campground
router.get('/:slug', (req, res) => {
  //find campground with provided slug
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
    .exec((err, foundCampground) => {
      if (err || !foundCampground) {
        req.flash('error', 'Kamp nije pronađen!');
        res.redirect('/campgrounds');
      } else {
        foundCampground.reservedDates = [];
        foundCampground.userReservations = null;

        Reservation.find({ campground: foundCampground.id })
          .sort({ isCanceled: false, dateFrom: 1 })
          .exec((err, foundReservations) => {
            if (err || !foundReservations) {
              req.flash('error', 'Rezervacije za odabrani kamp nisu pronađene!');
              res.redirect('/campgrounds');
            } else {
              foundReservations.map((reservation) => {
                let dates = [];

                if (!reservation.isCanceled) {
                  let currentDate = moment(reservation.dateFrom).startOf('day');
                  let endDate = moment(reservation.dateTo).startOf('day');

                  do {
                    dates.push(moment(currentDate.clone().toDate()).format('YYYY-MM-DD'));
                  } while (currentDate.add(1, 'days').diff(endDate) < 1);

                  foundCampground.reservedDates.push(...dates);
                }
              });

              //find current user's reservations
              if (req.user) {
                foundCampground.userReservations = foundReservations.filter((reservation) => reservation.user.equals(req.user._id));
              }

              //render show template with that campground
              res.render('campgrounds/show', {
                campground: foundCampground,
              });
            }
          });
      }
    });
});

// EDIT CAMPGROUND ROUTE
router.get('/:slug/edit', isLoggedIn, checkCampgroundOwnership, (req, res) => {
  res.render('campgrounds/edit', {
    campground: req.campground,
  });
});

// UPDATE CAMPGROUND ROUTE
router.put('/:slug', isLoggedIn, checkCampgroundOwnership, upload.single('image'), async (req, res) => {
  delete req.body.campground.rating;
  let campground = req.campground; // campground returned from checkCampgroundOwnership in middleware/index

  if (req.file) {
    try {
      await cloudinary.uploader.destroy(campground.imageId);
      let result = await cloudinary.uploader.upload(req.file.path);
      campground.image = result.secure_url;
    } catch (err) {
      req.flash('error', err.message);
      return res.redirect('back');
    }
  }

  let location = `${req.body.campground.street} ${req.body.campground.streetNumber}, ${req.body.campground.postalCode} ${req.body.campground.city}`;
  let place = encodeURIComponent(location);
  let mapboxURI = `https://api.mapbox.com/geocoding/v5/mapbox.places/${place}.json?bbox=15.7%2C42.55%2C19.55%2C45.3&limit=1&types=address&access_token=${process.env.MAPBOX_ACCESS_TOKEN}`;
  let lng = null;
  let lat = null;

  const response = await axios.get(mapboxURI);
  if (!response || response.length === 0 || !response.data?.features || response.data?.features.length === 0) {
    throw new Error('Adresa koju ste unijeli nije validna!');
  } else {
    lng = response.data.features[0].geometry?.coordinates[0];
    lat = response.data.features[0].geometry?.coordinates[1];
  }

  campground.name = req.body.campground.name;
  campground.price = req.body.campground.price;
  campground.description = req.body.campground.description;
  campground.street = req.body.campground.street;
  campground.streetNumber = req.body.campground.streetNumber;
  campground.city = req.body.campground.city;
  campground.postalCode = req.body.campground.postalCode;
  campground.lng = lng;
  campground.lat = lat;
  campground.save((err) => {
    if (err) {
      req.flash('error', 'Nije moguće ažurirati kamp!');
      res.redirect('/campgrounds');
    } else {
      req.flash('success', 'Kamp uspješno ažuriran!');
      res.redirect(`/campgrounds/${campground.slug}`);
    }
  });
});

// REMOVE CAMPGROUND FROM FAVORITES ROUTE
router.get('/favorites/remove/:slug', isLoggedIn, async (req, res) => {
  try {
    let campground = await Campground.findOne({
      slug: req.params.slug,
    });
    req.user.favorites = await req.user.favorites.filter((favorite) => String(favorite) !== String(campground._id));
    req.user.save();
    req.flash('success', `${campground.name} uklonjen iz favorita!`);
    res.redirect('/campgrounds');
  } catch (err) {
    req.flash('error', 'Nije moguće ukloniti kamp iz favorita!');
    res.redirect('back');
  }
});

// ADD CAMPGROUND TO FAVORITES ROUTE
router.get('/favorites/:slug', isLoggedIn, async (req, res) => {
  try {
    let campground = await Campground.findOne({
      slug: req.params.slug,
    });
    req.user.favorites.push(campground._id);
    req.user.save();
    req.flash('success', `Kamp: ${campground.name} dodan u favorite!`);
    res.redirect('/campgrounds');
  } catch (err) {
    req.flash('error', 'Nije moguće dodati kamp u favorite!');
    res.redirect('back');
  }
});

// DESTROY CAMPGROUND ROUTE
router.delete('/:slug', isLoggedIn, checkCampgroundOwnership, async (req, res) => {
  let campground = req.campground; // campground returned from checkCampgroundOwnership in middleware/index

  try {
    await campground.deleteOne();
  } catch (err) {
    req.flash('error', 'Nije moguće obrisati kamp!');
    return res.redirect('back');
  }
  req.flash('success', 'Kamp uspješno obrisan!');
  res.redirect('/campgrounds');
});

// STRIPE CHECKOUT ROUTE
router.post('/create-checkout-session', async (req, res) => {
  const dateFrom = moment(req.body.dateFrom);
  const dateTo = moment(req.body.dateTo);
  const numberOfNights = dateTo.diff(dateFrom, 'days');
  const unitAmount = Number(req.query.price);
  const totalAmount = unitAmount * numberOfNights;

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'bam',
          product_data: {
            name: 'Rezervacija za kamp: ' + req.query.campgroundName,
          },
          unit_amount: unitAmount * 100,
        },
        quantity: numberOfNights,
      },
    ],
    mode: 'payment',
    success_url: `${process.env.APP_LIVE_URL}/payment/success?user=${req.user._id}
			&campground=${req.query.campgroundId}
			&campgroundSlug=${req.query.campgroundSlug[0] ?? ''}
			&numberOfNights=${numberOfNights}
			&numberOfPersons=${req.body.personsNumber}
			&price=${totalAmount}
			&dateFrom=${req.body.dateFrom}
			&dateTo=${req.body.dateTo}`,
    cancel_url: `${process.env.APP_LIVE_URL}/payment/cancel?campgroundSlug=${req.query.campgroundSlug}`,
    locale: 'hr',
  });

  res.redirect(303, session.url);
});

// function for escaping regular expressions in search input, /g is to replace all ocurrences of special characters (globally)
let escapeRegexp = (text) => text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');

module.exports = router;
