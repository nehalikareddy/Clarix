const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./models/User');
const Document = require('./models/Document');

async function syncUserCounts() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB...');

    const users = await User.find({});
    console.log(`Found ${users.length} users. Syncing...`);

    for (const user of users) {
      const actualCount = await Document.countDocuments({ userId: user._id });
      user.docsUploaded = actualCount;
      await user.save();
      console.log(`Updated user ${user.email}: ${actualCount} documents`);
    }

    console.log('Sync complete!');
    process.exit(0);
  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  }
}

syncUserCounts();
