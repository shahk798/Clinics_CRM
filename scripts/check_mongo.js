const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/.env' });

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MONGO_URI not found in backend/.env');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(uri, { /* options intentionally left empty to avoid deprecated warnings */ });
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    if (!cols.length) {
      console.log('No collections found in the database.');
    } else {
      console.log(`Found ${cols.length} collections:`);
      for (const c of cols) {
        const name = c.name;
        try {
          const count = await db.collection(name).countDocuments();
          console.log(` - ${name}: ${count} documents`);
        } catch (err) {
          console.log(` - ${name}: error counting documents - ${err.message}`);
        }
      }
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Error connecting to MongoDB:', err.message || err);
    process.exit(2);
  }
}

main();
