const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');

// Set up Redis connection (BullMQ requires maxRetriesPerRequest to be null)
const redisConnection = new IORedis({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    maxRetriesPerRequest: null
});

// Main queue and Dead-Letter Queue (DLQ)
const calendarQueue = new Queue('calendar-queue', { connection: redisConnection });
const dlq = new Queue('calendar-dlq', { connection: redisConnection });

// 1. Mock function to create a Calendar Event (simulates errors for testing retries)
const mockCreateCalendarEvent = async (data) => {
    console.log(`[Calendar API] Creating event for Reservation: ${data.reservationId}...`);
    
    // Simulate a 70% chance of Calendar API connection failure
    if (Math.random() < 0.7) {
        throw new Error("Calendar API Connection Timeout");
    }
    
    return { eventId: `cal_${Date.now()}`, status: 'success' };
};

// 2. Create a Worker to process jobs from the queue
const worker = new Worker('calendar-queue', async (job) => {
    console.log(`\nProcessing Job ID: ${job.id} (Attempt: ${job.attemptsMade + 1}/${job.opts.attempts})`);
    
    // NOTE: Call the real Google Calendar API here in production (e.g., using googleapis)
    const result = await mockCreateCalendarEvent(job.data);
    
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