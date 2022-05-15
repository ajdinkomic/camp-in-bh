const express = require('express'),
  router = express.Router(),
  passport = require('passport'),
  User = require('../models/user'),
  Campground = require('../models/campground'),
  Notification = require('../models/notification'),
  Review = require('../models/review'),
  Message = require('../models/message'),
  Reservation = require('../models/reservation'),
  async = require('async'),
  multer = require('multer'),
  cloudinary = require('cloudinary').v2,
  nodemailer = require('nodemailer'),
  crypto = require('crypto'),
  { isLoggedIn } = require('../middleware');

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

// LANDING PAGE
router.get('/', async (req, res) => {
  try {
    let campCount = await Campground.estimatedDocumentCount();
    let userCount = await User.estimatedDocumentCount();
    let reviewCount = await Review.estimatedDocumentCount();
    res.render('landing', {
      campCount,
      userCount,
      reviewCount,
    });
  } catch (err) {
    req.flash('error', 'Nije moguće učitati naslovnu stranicu!');
    res.redirect('back');
  }
});

//================================================
//          AUTH ROUTES
//================================================

// show register form
router.get('/register', (req, res) => {
  res.render('register', {
    page: 'register',
  });
});

// show register official form
router.get('/register-official', (req, res) => {
  res.render('register-official', {
    page: 'register-official',
  });
});

//handle sign up logic
router.post('/register', upload.single('image'), async (req, res) => {
  let result, profileImage, profileImageId;

  if (req.file) {
    result = await cloudinary.uploader.upload(req.file.path);
    profileImage = result.secure_url;
    profileImageId = result.public_id;
  }

  const newUser = new User({
    username: req.body.username,
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    profileImage: profileImage,
    profileImageId: profileImageId,
    email: req.body.email,
    facebook: req.body.facebook,
    youtube: req.body.youtube,
    twitter: req.body.twitter,
    linkedIn: req.body.linkedIn,
  });

  if (req.body.adminCode === process.env.ADMINCODE) {
    newUser.isAdmin = true;
  }

  if (req.body.shareEmail === 'share') {
    newUser.shareEmail = true;
  }

  if (req.query.page && req.query.page === 'register-official') {
    newUser.isOfficial = true;
    newUser.officialCampgroundName = req.body.campgroundName;
    newUser.officialCampgroundJIB = req.body.campgroundJIB;

    const admins = await User.find({
      isAdmin: true,
    });

    if (admins.length) {
      let reject = true;
      if (process.env.REJECTUNAUTHORIZED && process.env.REJECTUNAUTHORIZED === 'false') {
        reject = false;
      }
      const smtpTransport = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
          user: 'ajdin.komic12@gmail.com',
          pass: process.env.MAILPW,
        },
        tls: {
          rejectUnauthorized: reject,
        },
      });
      for (const admin of admins) {
        const mailOptions = {
          to: admin.email,
          from: 'ajdin.komic12@gmail.com',
          subject: 'Kampiraj u BiH | Novi službeni korisnik',
          text: `Poštovani/a, ${admin.firstName}\n\nObavještavamo Vas da je registrovan novi službeni korisnik sa sljedećim podacima:\nIme i prezime: ${newUser.firstName} ${newUser.lastName}\nNaziv kampa: ${newUser.officialCampgroundName}\nJIB kampa: ${newUser.officialCampgroundJIB}\n\nUkoliko želite potvrditi ovog službenog korisnika, molimo kliknite na sljedeću poveznicu: https://${req.headers.host}/confirm-user/${newUser.username}.\n`,
        };
        smtpTransport.sendMail(mailOptions);
      }
    }
  }

  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      return res.render('register', {
        errorMessage: err.message,
      });
    }

    passport.authenticate('local')(req, res, () => {
      req.flash('success', 'Uspješna prijava! Dobrodošli, ' + user.firstName + '.');
      res.redirect('/campgrounds');
    });
  });
});

// confirm official user
router.get('/confirm-user/:username', async (req, res) => {
  const user = await User.findOne({ username: req.params.username });

  if (user) {
    user.isConfirmed = true;
    await user.save();

    let reject = true;
    if (process.env.REJECTUNAUTHORIZED && process.env.REJECTUNAUTHORIZED === 'false') {
      reject = false;
    }
    const smtpTransport = nodemailer.createTransport({
      service: 'Gmail',
      auth: {
        user: 'ajdin.komic12@gmail.com',
        pass: process.env.MAILPW,
      },
      tls: {
        rejectUnauthorized: reject,
      },
    });
    const mailOptions = {
      to: user.email,
      from: 'ajdin.komic12@gmail.com',
      subject: 'Kampiraj u BiH | Potvrda službenog korisnika',
      text: `Poštovani/a, ${user.firstName}\n\nObavještavamo Vas da ste potvrđeni kao službeni korisnik kampa ${user.officialCampgroundName}. Ugodno korištenje aplikacije Kampiraj u BiH!`,
    };
    smtpTransport.sendMail(mailOptions);
  }

  req.flash('success', `Uspješno ste potvrdili službenog korisnika: ${user.username}`);
  res.redirect('/campgrounds');
});

// show login form
router.get('/login', (req, res) => {
  res.render('login', {
    page: 'login',
  });
});

// handling login logic
router.post(
  '/login',
  passport.authenticate('local', {
    successRedirect: '/campgrounds',
    failureRedirect: '/login',
    failureFlash: true,
    successFlash: 'Dobrodošli nazad!',
  }),
  function (req, res) {}
);

// logout
router.get('/logout', (req, res) => {
  req.logout();
  req.flash('success', 'Doviđenja!');
  res.redirect('/campgrounds');
});

// user profile
router.get('/users/:username', async (req, res) => {
  try {
    let user = await User.findOne({
      username: req.params.username,
    })
      .populate('followers')
      .exec();
    let campgrounds = await Campground.find({
      'author.id': user._id,
    });
    let reviews = await Review.find({
      'author.id': user._id,
    });

    res.render('users/show', {
      user,
      campgrounds,
      reviews,
      followers: user.followers,
    });
  } catch (err) {
    req.flash('error', 'Korisnik nije pronađen!');
    res.redirect('back');
  }
});

// follow user
router.get('/follow/:username', isLoggedIn, async (req, res) => {
  try {
    let user = await User.findOne({
      username: req.params.username,
    });
    let newNotification = {
      username: req.user.username,
      link: `/users/${req.user.username}`,
      text: `Zapratio vas je korisnik: ${req.user.username}!`,
    };
    let notification = await Notification.create(newNotification);

    user.followers.push(req.user._id);
    user.notifications.push(notification);
    await user.save();

    req.flash('success', `Uspješno ste zapratili korisnika: ${user.username}`);
    res.redirect(`/users/${req.params.username}`);
  } catch (err) {
    req.flash('error', 'Nije moguće zapratiti korisnika!');
    res.redirect('back');
  }
});

// unfollow user
router.get('/unfollow/:username', isLoggedIn, async (req, res) => {
  try {
    let user = await User.findOne({
      username: req.params.username,
    });
    user.followers.remove(req.user._id);
    user.save();
    req.flash('success', `Uspješno ste otpratili korisnika: ${user.username}`);
    res.redirect(`/users/${req.params.username}`);
  } catch (err) {
    req.flash('error', 'Nije moguće otpratiti korisnika!');
    res.redirect('back');
  }
});

// view all notifications
router.get('/notifications', isLoggedIn, async (req, res) => {
  try {
    let user = await User.findById(req.user._id)
      .populate({
        path: 'notifications',
        options: {
          sort: {
            _id: -1,
          },
        },
      })
      .exec();

    let allNotifications = user.notifications;
    let notifications = [];
    let allUnreadNotifications = [];

    allNotifications.forEach(function (notification) {
      if (!notification.isRead) {
        allUnreadNotifications.push(notification);
      } else {
        notifications.push(notification);
      }
    });
    res.render('notifications/index', {
      notifications: notifications,
      unreadNotifications: allUnreadNotifications,
    });
  } catch (err) {
    req.flash('error', 'Nije moguće dohvatiti obavijesti iz baze!');
    res.redirect('back');
  }
});

// handle notification
router.get('/notifications/:id', isLoggedIn, async (req, res) => {
  try {
    let notification = await Notification.findById(req.params.id);
    notification.isRead = true;
    notification.save();
    res.redirect(notification.link);
  } catch (err) {
    req.flash('error', 'Obavijest nije pronađena!');
    res.redirect('back');
  }
});

// view all favorite campgrounds
router.get('/favorites', isLoggedIn, async (req, res) => {
  res.redirect('/campgrounds/favorites');
});

// message user
router.post('/message/:username', isLoggedIn, async (req, res) => {
  try {
    let user = await User.findOne({
      username: req.params.username,
    });
    const newMessage = {
      sender: req.user._id,
      body: req.body.messageBody,
    };
    let message = await Message.create(newMessage);
    user.messages.push(message);
    user.save();
    req.flash('success', `Uspješno ste poslali poruku korisniku: ${user.username}`);
    res.redirect(`/users/${req.params.username}`);
  } catch (err) {
    req.flash('error', 'Nije moguće poslati poruku!');
    res.redirect('back');
  }
});

// forgot password
router.get('/forgot', (req, res) => {
  res.render('forgot');
});

router.post('/forgot', (req, res, next) => {
  async.waterfall(
    [
      (done) => {
        crypto.randomBytes(20, (err, buf) => {
          const token = buf.toString('hex');
          done(err, token);
        });
      },
      (token, done) => {
        User.findOne(
          {
            email: req.body.email,
          },
          (err, user) => {
            if (err || !user) {
              req.flash('error', 'Račun s tom e-mail adresom nije pronađen!');
              return res.redirect('/forgot');
            }

            user.resetPasswordToken = token;
            user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

            user.save((err) => {
              done(err, token, user);
            });
          }
        );
      },
      (token, user, done) => {
        let reject = true;
        if (process.env.REJECTUNAUTHORIZED && process.env.REJECTUNAUTHORIZED === 'false') {
          reject = false;
        }
        const smtpTransport = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: 'ajdin.komic12@gmail.com',
            pass: process.env.MAILPW,
          },
          tls: {
            rejectUnauthorized: reject,
          },
        });
        const mailOptions = {
          to: user.email,
          from: 'ajdin.komic12@gmail.com',
          subject: 'Kampiraj u BiH | Zahtjev za promjenu lozinke',
          text: `Poštovani/a ${user.firstName},\n\nPrimate ovu poruku zato što ste Vi (ili neko drugi) zatražili promjenu lozinke za Vaš račun.\n\nMolimo Vas da kliknete na ovu poveznicu ili je zalijepite u internet preglednik:\n\nhttps://${req.headers.host}/reset/${token}\n\nUkoliko niste poslali zahtjev, molimo ignorišite ovaj e-mail i Vaša lozinka će ostati nepromijenjena.\n`,
        };
        smtpTransport.sendMail(mailOptions, (err) => {
          req.flash('success', `E-mail s daljim instrukcijama je poslan na: ${user.email}!`);
          done(err, 'done');
        });
      },
    ],
    (err) => {
      if (err) return next(err);
      res.redirect('/forgot');
    }
  );
});

router.get('/reset/:token', (req, res) => {
  // $gt means greater than
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: {
        $gt: Date.now(),
      },
    },
    (err, user) => {
      if (err || !user) {
        req.flash('error', 'Token za promjenu lozinke nije validan ili je istekao!');
        return res.redirect('/forgot');
      }
      res.render('reset', {
        token: req.params.token,
      });
    }
  );
});

router.post('/reset/:token', (req, res) => {
  async.waterfall(
    [
      (done) => {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: {
              $gt: Date.now(),
            },
          },
          (err, user) => {
            if (err || !user) {
              req.flash('error', 'Token za promjenu lozinke nije validan ili je istekao!');
              return res.redirect('/forgot');
            }
            if (req.body.password === req.body.confirm) {
              user.setPassword(req.body.password, (err) => {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save((err) => {
                  if (err) {
                    req.flash('error', 'Nije moguće spremiti korisnika u bazu!');
                    return res.redirect('back');
                  }
                  req.logIn(user, (err) => {
                    done(err, user);
                  });
                });
              });
            } else {
              req.flash('error', 'Lozinke se ne podudaraju!');
              return res.redirect('back');
            }
          }
        );
      },
      (user, done) => {
        let reject = true;
        if (process.env.REJECTUNAUTHORIZED && process.env.REJECTUNAUTHORIZED === 'false') {
          reject = false;
        }
        const smtpTransport = nodemailer.createTransport({
          service: 'Gmail',
          auth: {
            user: 'ajdin.komic12@gmail.com',
            pass: process.env.MAILPW,
          },
          tls: {
            rejectUnauthorized: reject,
          },
        });
        const mailOptions = {
          to: user.email,
          from: 'ajdin.komic12@gmail.com',
          subject: 'Kampiraj u BiH | Uspješna promjena lozinke',
          text: `Poštovani/a, ${user.firstName}\n\nOvo je potvrda da je lozinka za Vaš račun ${user.email} uspješno promijenjena.\n`,
        };
        smtpTransport.sendMail(mailOptions, (err) => {
          req.flash('success', 'Vaša lozinka je uspješno promijenjena!');
          done(err);
        });
      },
    ],
    (err) => {
      if (err) {
        req.flash('error', 'Došlo je do greške!');
        return res.redirect('back');
      }
      res.redirect('/campgrounds');
    }
  );
});

// payment success
router.get('/payment/success', async (req, res) => {
  const user = req.query.user,
    campground = req.query.campground,
    numberOfNights = req.query.numberOfNights,
    numberOfPersons = req.query.numberOfPersons,
    price = req.query.price,
    dateFrom = req.query.dateFrom,
    dateTo = req.query.dateTo;

  const newReservation = {
    user,
    campground,
    numberOfNights,
    numberOfPersons,
    price,
    dateFrom,
    dateTo,
  };

  let reservation = await Reservation.create(newReservation);

  req.flash('success', 'Hvala! Vaša rezervacija je potvrđena.');
  return res.redirect(`/campgrounds/${req.query.campgroundSlug}`);
});

// payment cancel
router.get('/payment/cancel', (req, res) => {
  req.flash('danger', 'Došlo je do greške prilikom kreiranja rezervacije!');
  return res.redirect(`/campgrounds/${req.query.campgroundSlug}`);
});

// reservation cancel
router.get('/reservation/cancel/:reservation_id', async (req, res) => {
  try {
    let reservation = await Reservation.findOne({
      _id: req.params.reservation_id,
    });

    reservation.isCanceled = true;
    await reservation.save();

    req.flash('success', 'Rezervacija uspješno otkazana!');
    res.redirect('back');
  } catch (err) {
    req.flash('error', 'Rezervacija nije pronađena!');
    res.redirect('back');
  }
});

module.exports = router;
