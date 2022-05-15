const mongoose = require("mongoose"),
    pasportLocalMongoose = require("passport-local-mongoose"),

    UserSchema = new mongoose.Schema({
        username: {
            type: String,
            unique: true,
            required: true
        },
        password: String,
        firstName: String,
        lastName: String,
        profileImage: String,
        profileImageId: String,
        email: {
            type: String,
            unique: true,
            required: true
        },
        shareEmail: {
            type: Boolean,
            default: false
        },
        facebook: String,
        youtube: String,
        twitter: String,
        linkedIn: String,
        resetPasswordToken: String,
        resetPasswordExpires: Date,
        isAdmin: {
            type: Boolean,
            default: false
        },
        isOfficial: {
            type: Boolean,
            default: false
        },
        isConfirmed: {
            type: Boolean,
            default: false
        },
        officialCampgroundName: String,
        officialCampgroundJIB: Number,
        notifications: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Notification"
        }],
        followers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }],
        favorites: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Campground"
        }],
        messages: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message"
        }]
    }, {
        timestamps: true
    });

UserSchema.plugin(pasportLocalMongoose);

module.exports = mongoose.model("User", UserSchema);