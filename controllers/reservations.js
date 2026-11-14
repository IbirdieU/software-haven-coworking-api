const Reservation = require('../models/Reservation');
const CoworkingSpace = require('../models/CoworkingSpace');

//@desc    Get all reservations
//@route   GET /api/v1/reservations
//@access  Public
exports.getReservations = async (req,res,next) => {
    //--- Expire Logic ก่อนดึงข้อมูล ---
    const expireTime = new Date(Date.now() - 15 * 60 * 1000);
    await Reservation.updateMany(
        { status: 'confirmed', resvDate: { $lt: expireTime } },
        { status: 'expired' }
    );

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

        // เช็กว่าจำนวนคนจองเกินความจุสูงสุดหรือไม่
        if (req.body.attendees && req.body.attendees > coworkingSpace.maxCapacity) {
            return res.status(400).json({
                success: false, 
                message: `Number of attendees (${req.body.attendees}) exceeds the maximum capacity (${coworkingSpace.maxCapacity}) of this coworking space`
            });
        }

        //add user to req.body
        req.body.user = req.user.id;

        // คำนวณเวลาย้อนหลังไป 15 นาทีจากปัจจุบัน
        const expireTime = new Date(Date.now() - 15 * 60 * 1000); 
        // อัปเดตรายการที่ยังเป็น confirmed และเวลา resvDate เก่ากว่า 15 นาทีที่แล้ว ให้กลายเป็น expired
        await Reservation.updateMany(
            { status: 'confirmed', resvDate: { $lt: expireTime } },
            { status: 'expired' }
        );

        //Check for existed reservation, Exclude expired from 3-room count
        const existedReservation = await Reservation.find({
            user: req.user.id,
            status: { $ne: 'expired' } 
        });
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

        // ถ้ามีการส่ง attendees มาอัปเดต ต้องเช็กความจุสูงสุดก่อน
        if (req.body.attendees) {
            const coworkingSpace = await CoworkingSpace.findById(reservation.coworkingSpace);
            if (req.body.attendees > coworkingSpace.maxCapacity) {
                return res.status(400).json({
                    success: false, 
                    message: `Number of attendees (${req.body.attendees}) exceeds the maximum capacity (${coworkingSpace.maxCapacity}) of this coworking space`
                });
            }
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