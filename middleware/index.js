const Campground = require("../models/campground"),
    Review = require("../models/review");

module.exports = {
    isLoggedIn: (req, res, next) => {
        if (req.isAuthenticated()) {
            return next();
        }
        req.flash("error", "Za pristup ovom dijelu aplikacije, morate biti prijavljeni!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
        res.redirect("/login");
    },

    checkCampgroundOwnership: (req, res, next) => {
        Campground.findOne({
            slug: req.params.slug
        }, (err, foundCampground) => {
            if (err || !foundCampground) { // error or foundcampground is null
                req.flash("error", "Kamp nije pronađen!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                res.redirect("/campgrounds");
            } else if (foundCampground.author.id.equals(req.user._id) || req.user.isAdmin) {
                // does user own campground?
                // console.log(foundCampground.author.id); // this is object (mongoose object)
                // console.log(req.user._id); // this is String,so we can't use === but .equals
                req.campground = foundCampground;
                next();
            } else {
                req.flash("error", "Nemate odgovarajuće privilegije za izvršavanje ove akcije!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                res.redirect(`/campgrounds/${req.params.slug}`);
            }
        });
    },

    checkReviewOwnership: (req, res, next) => {
        Review.findById(req.params.review_id, (err, foundReview) => {
            if (err || !foundReview) {
                req.flash("error", "Recenzija nije pronađena!");
                res.redirect("back");
            } else {
                if (foundReview.author.id.equals(req.user._id) || req.user.isAdmin) {
                    req.review = foundReview;
                    next();
                } else {
                    req.flash("error", "Nemate odgovarajuće privilegije za izvršavanje ove akcije!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    res.redirect("back");
                }
            }
        });
    },

    checkReviewExistence: (req, res, next) => {
        Campground.findOne({
            slug: req.params.slug
        }).populate("reviews").exec((err, foundCampground) => {
            if (err || !foundCampground) {
                req.flash("error", "Kamp nije pronađen!");
                res.redirect("back");
            } else {
                // check if req.user._id exists in foundCampground.reviews
                const foundUserReview = foundCampground.reviews.some(review => review.author.id.equals(req.user._id));
                if (foundUserReview) {
                    req.flash("error", "Već ste napisali jednu recenziju!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    return res.redirect(`/campgrounds/${foundCampground.slug}`);
                }
                if (foundCampground.author.id.equals(req.user._id)) {
                    req.flash("error", "Nije moguće napisati recenziju za vlastiti kamp!"); // we can add this before res.redirect or in the same line as res.render like: return res.render("register", {"error": err.message});
                    return res.redirect(`/campgrounds/${foundCampground.slug}`);
                }
                req.campground = foundCampground;
                next();
            }
        });
    }

}