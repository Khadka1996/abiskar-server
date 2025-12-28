const cron = require('node-cron');
const { ChatMessage } = require('../models/chatModel');

const cleanupOldMessages = async () => {
  try {
    // This is redundant with MongoDB TTL but provides logging
    const cutoffDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const result = await ChatMessage.deleteMany({ createdAt: { $lt: cutoffDate } });
    console.log(`Cleanup: Deleted ${result.deletedCount} messages older than 7 days`);
  } catch (error) {
    console.error('Cleanup error:', error);
  }
};

const scheduleCleanup = () => {
  // Run daily at midnight
  cron.schedule('0 0 * * *', cleanupOldMessages);
  console.log('Scheduled message cleanup job');
};

module.exports = {
  cleanupOldMessages,
  scheduleCleanup
};