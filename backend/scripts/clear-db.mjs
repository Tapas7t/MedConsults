import mongoose from 'mongoose';
import dns from 'node:dns';
import dotenv from 'dotenv';
import path from 'path';

dns.setServers(['8.8.8.8', '1.1.1.1']);
dotenv.config({ path: path.resolve('backend/.env') });

async function clear() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI not found in backend/.env');
    process.exit(1);
  }

  console.log('🔄 Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('✅ Connected to database:', mongoose.connection.name);

  const collections = await mongoose.connection.db.collections();
  console.log(`Found ${collections.length} collections.`);

  for (const col of collections) {
    const count = await col.countDocuments();
    if (count > 0) {
      await col.deleteMany({});
      console.log(`🧹 Cleared "${col.collectionName}": deleted ${count} documents`);
    } else {
      console.log(`⚪ Collection "${col.collectionName}" is already empty`);
    }
  }

  console.log('🎉 All test data cleared successfully from MongoDB!');
  await mongoose.disconnect();
}

clear().catch(console.error);
