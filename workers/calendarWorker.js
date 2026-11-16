const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');
const { google } = require('googleapis');

// Set up Redis connection (BullMQ requires maxRetriesPerRequest to be null)
const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// Main queue and Dead-Letter Queue (DLQ)
const calendarQueue = new Queue('calendar-queue', { connection: redisConnection });
const dlq = new Queue('calendar-dlq', { connection: redisConnection });

// Create a Google Calendar event (CALENDAR_FAIL_RATE simulates errors for testing retries)
const createCalendarEvent = async (data) => {
    console.log(`[Calendar API] Creating event for Reservation: ${data.reservationId}...`);

    if (Math.random() < Number(process.env.CALENDAR_FAIL_RATE || 0)) {
        throw new Error("Simulated Calendar API failure");
    }
    // 1. Set up Google Calendar client with service account
    const auth = new google.auth.GoogleAuth({
        keyFile : process.env.GOOGLE_KEY_FILE,
        scopes : ['https://www.googleapis.com/auth/calendar']
    });
    const calendar = google.calendar({ version : 'v3', auth });
    const start = new Date(data.date);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const res = await calendar.events.insert({
        calendarId : process.env.GOOGLE_CALENDAR_ID,
        requestBody : {
            summary : `Co-working Reservation ${data.reservationId}`,
            description : `User: ${data.user}`,
            start : { dateTime : start.toISOString() },
            end : { dateTime : end.toISOString() }
        }
    });

    return { eventId : res.data.id, status : 'success' };
};

// 2. Create a Worker to process jobs from the queue
const worker = new Worker('calendar-queue', async (job) => {
    console.log(`\nProcessing Job ID: ${job.id} (Attempt: ${job.attemptsMade + 1}/${job.opts.attempts})`);
    
    // Call Google Calendar API
    const result = await createCalendarEvent(job.data);
    
    console.log(`Job ID: ${job.id} succeeded! (Event ID: ${result.eventId})`);
    return result;
}, { connection: redisConnection });

// 3. Handle Dead-Letter Queue (DLQ) when a job fails permanently
worker.on('failed', async (job, err) => {
    console.log(`Job ID: ${job.id} failed: ${err.message}`);
    
    // Check if the maximum number of attempts has been reached
    if (job.attemptsMade >= job.opts.attempts) {
        console.log(`Job ID: ${job.id} failed permanently! Moving to Dead-letter queue...`);
        
        // Move the failed job data to the DLQ
        await dlq.add('failed-calendar-event', job.data, {
            attempts: 1 // No need to retry in DLQ
        });
        console.log(`Job ID: ${job.id} moved to Dead-letter queue successfully`);
    } else {
        console.log(`Waiting for backoff delay before retrying...`);
    }
});

console.log("Calendar Worker is running and waiting for jobs...");

module.exports = { calendarQueue };