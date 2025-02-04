const Redis = require("ioredis");
require('dotenv').config();

const redisClient = new Redis({
    host: process.env.REDIS_HOST, // or your custom host
    port: process.env.REDIS_PORT, // or your custom port
    db: process.env.REDISDB,
    retryStrategy: (times) => {
        // reconnect after 1 second
        return 1000;
    },
});

redisClient.on('error', (err) => {
    process.exit(1);
});

redisClient.on('connect', () => {
    console.log('Connected to Redis');
});

redisClient.on('reconnecting', () => {
    console.log('Reconnecting to Redis');
});

redisClient.on('close', () => {
    console.log('Redis connection closed');
});

module.exports = redisClient;