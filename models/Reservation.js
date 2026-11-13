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
        type : Number, // จำนวนคน
        required : true
    },
    specialRequest : {
        type : String
    },
    status : {
        type : String,
        default : 'pending' // ['pending', 'confirmed', 'cancelled']
    },
    createdAt : {
        type : Date,
        default : Date.now
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);