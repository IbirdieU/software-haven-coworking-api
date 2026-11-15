const { Worker, Queue } = require('bullmq');
const IORedis = require('ioredis');

// ตั้งค่าการเชื่อมต่อ Redis (BullMQ บังคับให้ตั้ง maxRetriesPerRequest เป็น null)
const redisConnection = new IORedis({
    host: '127.0.0.1',
    port: 6379,
    maxRetriesPerRequest: null
});

// คิวหลัก และ คิวสำหรับงานที่ล้มเหลว (Dead-Letter Queue)
const calendarQueue = new Queue('calendar-queue', { connection: redisConnection });
const dlq = new Queue('calendar-dlq', { connection: redisConnection });

// 1. ฟังก์ชันจำลองการสร้าง Calendar Event (ทำให้สุ่ม Error เพื่อเทสต์ระบบ Retry)
const createCalendarEvent = async (data) => {
    console.log(`[Calendar API] กำลังสร้าง Event ให้ Reservation: ${data.reservationId}...`);
    
    // จำลองโอกาส 70% ที่จะเชื่อมต่อ API ปฏิทินไม่สำเร็จ
    if (Math.random() < 0.7) {
        throw new Error("Calendar API Connection Timeout");
    }
    
    return { eventId: `cal_${Date.now()}`, status: 'success' };
};

// 2. สร้าง Worker เพื่อประมวลผลงานจากคิว
const worker = new Worker('calendar-queue', async (job) => {
    console.log(`\n▶ เริ่มประมวลผล Job ID: ${job.id} (Attempt: ${job.attemptsMade + 1}/${job.opts.attempts})`);
    
    // เรียกใช้ฟังก์ชันสร้าง Calendar Event
    const result = await createCalendarEvent(job.data);
    
    console.log(`✅ Job ID: ${job.id} ทำงานสำเร็จ! (Event ID: ${result.eventId})`);
    return result;
}, { connection: redisConnection });

// 3. จัดการ Dead-letter queue เมื่อทำงานล้มเหลวถาวร
worker.on('failed', async (job, err) => {
    console.log(`⚠️ Job ID: ${job.id} ล้มเหลว: ${err.message}`);
    
    // เช็กว่าทำซ้ำจนครบจำนวนโควตา Attempts แล้วหรือยัง
    if (job.attemptsMade >= job.opts.attempts) {
        console.log(`❌ Job ID: ${job.id} ล้มเหลวถาวร! กำลังย้ายไปยัง Dead-letter queue...`);
        
        // โยนข้อมูลงานที่พังไปเก็บไว้ใน DLQ
        await dlq.add('failed-calendar-event', job.data, {
            attempts: 1 // ใน DLQ ไม่ต้องทำซ้ำแล้ว
        });
        console.log(`📦 ย้าย Job ID: ${job.id} ลง Dead-letter queue สำเร็จ`);
    } else {
        console.log(`⏳ รอระบบหน่วงเวลา (Backoff) ก่อนลองใหม่...`);
    }
});

console.log("🛠️  Calendar Worker is running and waiting for jobs...");

// ==========================================
// ส่วนสำหรับใช้ทดสอบรัน (ลบออกได้เมื่อเอาไปใช้งานจริง)
// ==========================================
const testAddJob = async () => {
    // 2. การตั้งค่า Attempts + Backoff จะกำหนดตอน Add งานเข้าคิว
    await calendarQueue.add('create-event', {
        reservationId: 'res_999',
        user: 'melathat',
        date: '2026-11-20T10:00:00Z'
    }, {
        attempts: 3, // ลองใหม่ได้สูงสุด 3 ครั้ง
        backoff: {
            type: 'exponential',
            delay: 2000 // หน่วงเวลาเริ่มต้น 2 วินาที และจะนานขึ้นเรื่อยๆ
        }
    });
    console.log("➕ ทดสอบเพิ่มงานเข้าคิว 'calendar-queue' แล้ว");
};

module.exports = { calendarQueue };