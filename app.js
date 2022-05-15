// configure dotenv package
const dotenv = require('dotenv');
dotenv.config();

const express = require('express'),
	favicon = require('serve-favicon'),
	path = require('path'),
	app = express(),
	bodyParser = require('body-parser'),
	mongoose = require('mongoose'),
	flash = require('connect-flash'),
	passport = require('passport'),
	LocalStrategy = require('passport-local'),
	methodOverride = require('method-override'),
	User = require('./models/user'),
	Campground = require('./models/campground');

// Require routes
const campgroundRoutes = require('./routes/campgrounds'),
	reviewRoutes = require('./routes/reviews'),
	indexRoutes = require('./routes/index'); // auth routes

// FAVICON - serve-favicon
app.use(favicon(path.join(__dirname, 'public', 'img', 'favicon.ico')));

// FLASH MESSAGES - should come before passport
app.use(flash());

// MOMENT JS
app.locals.moment = require('moment');

// PASSPORT CONFIG
app.use(
	require('express-session')({
		secret: 'KampirajUBiH@2022',
		resave: false,
		saveUninitialized: false
	})
);
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());
// make our req.user or currentUser accessible on all routes and views
app.use(async (req, res, next) => {
	res.locals.currentUser = req.user;
	if (req.user) {
		try {
			let user = await User.findById(req.user._id)
				.populate(
					'notifications',
					null,
					{
						isRead: false
					},
					null,
					{
						sort: {
							_id: -1
						}
					}
				)
				.populate(
					'messages',
					null,
					{
						isRead: false
					},
					null,
					{
						sort: {
							_id: -1
						}
					}
				)
				.populate('favorites')
				.exec();
			let favoriteCamps = await Campground.find({ _id: user.favorites });
			res.locals.unreadNotifications = user.notifications;
			res.locals.unreadMessages = user.messages;
			res.locals.favoriteCamps = favoriteCamps;
		} catch (err) {
			console.log(err.message);
		}
	}
	res.locals.errorMessage = req.flash('error');
	res.locals.successMessage = req.flash('success');
	next(); // IMPORTANT!!! it will stop without this
});

// connect to mongodb
mongoose.set('useNewUrlParser', true);
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);
mongoose.set('useUnifiedTopology', true);
const url = process.env.DATABASEURL || 'mongodb://localhost:27017/kampirajubih';
mongoose.connect(url);

app.set('view engine', 'ejs');
app.use(
	bodyParser.urlencoded({
		extended: true
	})
);
app.use(express.static(__dirname + '/public'));
app.use(methodOverride('_method'));

app.use('/', indexRoutes);
app.use('/campgrounds/:slug/reviews', reviewRoutes);
app.use('/campgrounds', campgroundRoutes);

const port = process.env.PORT;
const ip = process.env.IP;
app.listen(port, ip, function () {
	console.log('Kampiraj u BiH server pokrenut!');
});
