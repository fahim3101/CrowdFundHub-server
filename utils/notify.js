const { getCollections } = require('../config/db');

// Shared helper so every route creates notifications in the exact same shape.
// message, toEmail (who receives it), actionRoute (where clicking it should take them)
const sendNotification = async ({ message, toEmail, actionRoute }) => {
  const { notificationsCollection } = getCollections();
  const notification = {
    message,
    toEmail,
    actionRoute,
    isRead: false,
    time: new Date(),
  };
  await notificationsCollection.insertOne(notification);
};

module.exports = sendNotification;
