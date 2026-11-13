const dotenv = require('dotenv');
const express = require('express');
const cookieParser = require('cookie-parser');
const coworkingspaces = require('./routes/coworkingspaces'); // เปลี่ยนชื่อไฟล์
const reservations = require('./routes/reservations'); // เปลี่ยนชื่อไฟล์
const auth = require('./routes/auth');
const connectDB = require('./config/db');
const mongoSanitize=require('@exortek/express-mongo-sanitize');
const helmet=require('helmet');
const {xss}=require('express-xss-sanitizer');
const rateLimit=require('express-rate-limit');
const hpp=require('hpp');
const cors=require('cors');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUI = require('swagger-ui-express');

//Load env vars
dotenv.config({path:'./config/config.env'}); 
//Connect to database
connectDB();
const app = express();
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, //10 mins
    max: 100
});
//Body parser
app.use(express.json());

//Cookie parser
app.use(cookieParser());
    
//MongoSanitize
app.use(mongoSanitize());

//Helmet
app.use(helmet());

//XSS
app.use(xss());

app.set('trust proxy', 1);

app.use(limiter);
//Query parser
app.set('query parser', 'extended');

//HPP
app.use(hpp());

//Enable CORS
app.use(cors());
const swaggerOptions={
    swaggerDefinition:{
        openapi: '3.0.0',
        info: {
            title: 'Co-working Space Reservation API',
            version: '1.0.0',
            description: 'A simple Express Co-working Space Reservation API'
        },
        servers: [
            {
                url: 'http://localhost:5000/api/v1'
            }
        ],
    },
    apis:['./routes/*.js'],
};
const swaggerDocs=swaggerJsDoc(swaggerOptions);
app.use('/api-docs',swaggerUI.serve, swaggerUI.setup(swaggerDocs));

// แก้ไข path ตรงนี้
app.use('/api/v1/coworkingspaces', coworkingspaces); 
app.use('/api/v1/reservations', reservations);
app.use('/api/v1/auth', auth);

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, console.log('Server running in ', process.env.NODE_ENV, ' mode on port ', PORT));

//Handle unhandled promise rejections
process.on('unhandledRejection',(err,promise)=>{
    console.log(`Error: ${err.message}`);
    //Close Server & exit process
    server.close(()=>process.exit(1));
})