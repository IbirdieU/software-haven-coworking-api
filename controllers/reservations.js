const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

//@desc    Get all reservations
//@route   GET /api/v1/reservations
//@access  Public
exports.getReservations = async (req,res,next) => {
    let query;
    //General users can see only their reservations!
    if (req.user.role !== 'admin') { 
        query = Reservation.find({user : req.user.id}).populate({'path' : 'coworkingSpace', select : 'name address tel'});
    }else{//If you are admin you can see all!
        if(req.params.coworkingSpaceId) {
            console.log(req.params.coworkingSpaceId);
            query = Reservation.find({coworkingSpace : req.params.coworkingSpaceId}).populate({'path' : 'coworkingSpace', select : 'name address tel'});
        } else {
            query = Reservation.find().populate({'path' : 'coworkingSpace', select : 'name address tel'});
        }
    }
    try {
        const reservations = await query;   
        res.status(200).json({success : true, count : reservations.length, data : reservations});
    }catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot find reservations"});
    }
}

//@desc    Get single reservation
//@route   GET /api/v1/reservations/:id
//@access  Public
exports.getReservation = async (req,res,next) => {
    try {
        const reservation = await Reservation.findById(req.params.id).populate({'path' : 'coworkingSpace', select : 'name address tel'});
        if(!reservation) {
            return res.status(400).json({success : false, message : `No reservation with id of ${req.params.id}`})
        }
        res.status(200).json({success : true, data : reservation});
    }catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot find reservation"});
    }
}

//@desc    Add reservation
//@route   POST /api/v1/coworkingspaces/:coworkingSpaceId/reservations
//@access  Private
exports.addReservation = async (req,res,next) => {
    try {
        req.body.coworkingSpace = req.params.coworkingSpaceId;
        const coworkingSpace = await CoworkingSpace.findById(req.params.coworkingSpaceId);
        if (!coworkingSpace) {
            return res.status(400).json({success : false, message : `No coworking space with the id of ${req.params.coworkingSpaceId}`})
        }
        //add user to req.body
        req.body.user = req.user.id;

        //New reservation is always confirmed
        req.body.status = 'confirmed';

        //Check for existed reservation 
        const existedReservation = await Reservation.find({user:req.user.id});
        //If the user is not an admin, they can only create 3 reservations
        if(existedReservation.length >= 3 && req.user.role !== 'admin') {
            return res.status(400).json({success : false, message : `The user with ID ${req.user.id} has already made 3 reservations`})
        }
        const reservation = await Reservation.create(req.body);
        res.status(201).json({success : true, data : reservation});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot create reservation"});
    }
}

//@desc    Update reservation
//@route   PUT /api/v1/reservations/:id
//@access  Private
exports.updateReservation = async (req,res,next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);
        if(!reservation) {
            return res.status(400).json({success : false, message : `No reservation with id of ${req.params.id}`})
        }
        
        //Make sure user is the reservation owner
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({success : false, message : `User ${req.user.id} is not authorized to update this reservation`})
        }
        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new : true,
            runValidators : true
        });
        res.status(200).json({success : true, data : reservation});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot update reservation"});
    }
}

//@desc   Delete reservation
//@route   DELETE /api/v1/reservations/:id
//@access  Private
exports.deleteReservation = async (req,res,next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        if(!reservation) {
            return res.status(400).json({success : false, message : `No reservation with id of ${req.params.id}`})
        }

        //Make sure user is the reservation owner
        if (reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({success : false, message : `User ${req.user.id} is not authorized to delete this reservation`})
        }
        await reservation.deleteOne();
        res.status(200).json({success : true, data : {}});
    } catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot delete reservation"});
    }
}

//@desc Check in reservation
// @route PUT /api/v1/reservations/:id/checkin
// @access Private
exports.checkInReservation = async (req,res,next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);
        if(!reservation) {
            return res.status(400).json({success : false, message : `No reservation with id of ${req.params.id}`})
        }

        //Make sure user is the reservation owner
        if(reservation.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({success : false, message : `User ${req.user.id} is not authorized to check in this reservation`})
        }

        //Only confirmed reservations can be checked in
        if (reservation.status !== 'confirmed') {
            return res.status(400).json({success : false, message : `Reservation is already ${reservation.status}`})
        }

        //Check in must be within 15 minutes of the reservation start time
        const deadline = new Date(reservation.resvDate.getTime() + 15 * 60 * 1000);
        if (Date.now() > deadline) {
            return res.status(400).json({success : false, message : `Check-in time has passed for reservation ${req.params.id}`})
        }
        
        reservation = await Reservation.findByIdAndUpdate(req.params.id, {status : 'checked-in'}, {
            new : true,
            runValidators : true
        });
        res.status(200).json({success : true, data : reservation});

    } catch(err) {
        console.log(err);
        return res.status(500).json({success:false,message: "Cannot check in reservation"});
    }
} 