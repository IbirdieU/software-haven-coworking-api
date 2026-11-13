const mongoose = require('mongoose');

const ReservationSchema = new mongoose.Schema({
    resvDate : {
        type : Date,
        required : true
    },
    user : {
        type : mongoose.Schema.ObjectId,
        ref : 'User',
        required : true
    },
    coworkingSpace : {
        type : mongoose.Schema.ObjectId,
        ref : 'CoworkingSpace',
        required : true
    },
    attendees : {
        type : Number,
        required : true,
        min : 1 // Require at least 1 attendee
    },
    specialRequest : {
        type : String
    },
    status : {
        type : String,
        enum : ['confirmed', 'checked-in', 'expired'], // Limit status values
        default : 'confirmed' // Set default status
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);