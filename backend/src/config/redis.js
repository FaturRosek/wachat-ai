const Redis = require('ioredis');
require('dotenv').config();

const redisConfig = process.env.REDIS_URL
  ? {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    }
  : {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    };

const createRedisConnection = () => {
  let client;
  if (redisConfig.url) {
    client = new Redis(redisConfig.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false
    });
  } else {
    client = new Redis(redisConfig);
  }

  client.on('connect', () => {
    console.log('[Redis] Connection established');
  });

  client.on('error', (err) => {
    console.warn(`[Redis Warning] ${err.message}`);
  });

  return client;
};

const testRedisConnection = async () => {
  try {
    const client = createRedisConnection();
    const ping = await client.ping();
    await client.quit();
    console.log(`[Redis] Connection test succeeded: PING -> ${ping}`);
    return true;
  } catch (error) {
    console.warn(`[Redis Warning] Test connection failed: ${error.message}`);
    return false;
  }
};

module.exports = {
  redisConfig,
  createRedisConnection,
  testRedisConnection
};
