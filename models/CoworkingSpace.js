const mongoose = require('mongoose');

const CoworkingSpaceSchema = new mongoose.Schema({
    name : {
        type : String,
        required : [true, 'Please add a name'],
        unique : true,
        trim : true,
        maxlength : [50,'Name can not be more than 50 characters']
    },
    address : {
        type : String,
        required : [true,  'Please add an address']
    },
    tel : {
        type : String,
        required : [true, 'Please add a telephone number'],
    },
    openTime : {
        type : String,
        required : [true, 'Please add an opening time'],
        match : [/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Please add open time in HH:mm format']
    },
    closeTime : {
        type : String,
        required : [true, 'Please add a closing time'],
        match : [/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Please add close time in HH:mm format']
    },
    maxCapacity : {
        type : Number,
        required : [true, 'Please add a maximum capacity'],
        min : [1, 'Maximum capacity must be at least 1']
    },
}, {
    toJSON : {virtuals : true},
    toObject : {virtuals : true}
});

//Reverse populate with virtuals
CoworkingSpaceSchema.virtual('reservations', {
    ref : 'Reservation',
    localField : '_id',
    foreignField : 'coworkingSpace',
    justOne : false
});
module.exports = mongoose.model('CoworkingSpace', CoworkingSpaceSchema);    