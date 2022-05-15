const mongoose = require("mongoose"),
    Notification = require("./notification"),
    cloudinary = require("cloudinary").v2,
    Review = require("./review");

//schema
const campgroundSchema = new mongoose.Schema({
    name: {
        type: String,
        required: "Naziv kampa ne može biti prazan!"
    },
    slug: {
        type: String,
        unique: true
    },
    price: Number,
    image: String,
    imageId: String,
    description: String,
    street: String,
    streetNumber: String,
    city: String,
    postalCode: String,
    lat: Number,
    lng: Number,
    author: {
        id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        username: String
    },
    reviews: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review"
    }],
    rating: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

campgroundSchema.pre("deleteOne", {
    document: true,
    query: false
}, async function (req, res, next) {
    try {
        await cloudinary.uploader.destroy(this.imageId);
        await Review.deleteMany({
            "_id": {
                $in: this.reviews
            }
        });
        await Notification.deleteMany({
            "campgroundId": this.id
        });
        next();
    } catch (err) {
        req.flash("error", err.message);
        return res.redirect("back");
    }
});

// add a slug before the campground gets saved to the database
campgroundSchema.pre("save", async function (next) {
    try {
        // check if a new campground is being saved, or if the campground name is being modified
        if (this.isNew || this.isModified("name")) {
            this.slug = await generateUniqueSlug(this._id, this.name);
        }
        next();
    } catch (err) {
        next(err);
    }
});

// module.exports is very important!!!
const Campground = mongoose.model("Campground", campgroundSchema);
module.exports = Campground;

let generateUniqueSlug = async (id, campgroundName, slug) => {
    try {
        // generate the initial slug (checks if it is not passed when calling a function in pre save hook)
        if (!slug) {
            slug = slugify(campgroundName);
        }
        // check if a campground with the slug already exists
        const campground = await Campground.findOne({
            slug: slug
        });
        // check if a campground was found or if the found campground is the current campground (in case of updating a campground)
        if (!campground || campground._id.equals(id)) {
            return slug;
        }
        // if not unique, generate a new slug
        const newSlug = slugify(campgroundName);
        // check again by calling the function recursively
        return await generateUniqueSlug(id, campgroundName, newSlug);
    } catch (err) {
        throw new Error(err);
    }
}

// method for making slug out of passed text(campground name)
let slugify = text => {
    const slug = text.toString().toLowerCase()
        .replace(/\s+/g, '-') // replaces spaces with -
        .replace(/[^\w\-]+/g, '') // replace all non-word chars
        .replace(/\-\-+/g, '-') // replace multiple -- with single -
        .replace(/^-+/, '') // trim - from start of text  
        .replace(/-+$/g, '') // trim - from end of text
        .substring(0, 75); // trim at 75 chars
    return slug + "-" + Math.floor(1000 + Math.random() * 9000); // add 4 random digits to improve uniqueness
}