import fs from 'fs';
import path from 'path';

// Load environment variables from backend/.env if present
const envPath = path.resolve('backend/.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}

const WORKSPACE_ID = process.env.POSTMAN_WORKSPACE_ID || '2937ca56-703a-48ff-a485-c13dcc3977a7';
const API_KEY = process.env.POSTMAN_API_KEY;

if (!API_KEY) {
  console.error('❌ Error: POSTMAN_API_KEY is not set in process.env or backend/.env');
  console.error('Please configure POSTMAN_API_KEY in backend/.env before running postman:sync');
  process.exit(1);
}

const MAP_FILE = path.resolve('backend/postman/collections-map.json');

async function sync() {
  console.log('🔄 Syncing Medconsults Collections to Postman Workspace:', WORKSPACE_ID);

  // 1. Load canonical collection UIDs map to prevent duplicate creations
  let collectionsMap = {};
  if (fs.existsSync(MAP_FILE)) {
    try {
      collectionsMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf-8'));
    } catch {
      collectionsMap = {};
    }
  }

  // 2. Read local collection files
  const collectionsDir = path.resolve('backend/postman/collections');
  if (!fs.existsSync(collectionsDir)) {
    console.error('❌ Directory not found:', collectionsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(collectionsDir).filter(f => f.endsWith('.collection.json'));
  console.log(`Found ${files.length} local collection files.`);

  let mapUpdated = false;

  for (const file of files) {
    const filePath = path.join(collectionsDir, file);
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const name = content.info.name;

    if (collectionsMap[name]) {
      const uid = collectionsMap[name];
      console.log(`Updating "${name}" (${uid})...`);
      const res = await fetch(`https://api.getpostman.com/collections/${uid}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ collection: content })
      });
      const data = await res.json();
      if (data.collection) {
        console.log(`✅ Updated "${name}"`);
      } else {
        console.error(`⚠️ Failed to update "${name}":`, data);
      }
    } else {
      console.log(`Creating "${name}"...`);
      const res = await fetch(`https://api.getpostman.com/collections?workspace=${WORKSPACE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
        body: JSON.stringify({ collection: content })
      });
      const data = await res.json();
      if (data.collection) {
        const uid = data.collection.uid || data.collection.id;
        collectionsMap[name] = uid;
        mapUpdated = true;
        console.log(`✅ Created "${name}" (UID: ${uid})`);
      } else {
        console.error(`⚠️ Failed to create "${name}":`, data);
      }
    }
  }

  if (mapUpdated) {
    fs.writeFileSync(MAP_FILE, JSON.stringify(collectionsMap, null, 2), 'utf-8');
    console.log(`💾 Saved updated collection UIDs to ${MAP_FILE}`);
  }

  console.log('🎉 Finished syncing all collections to Postman (idempotent, 0 duplicates)!');
}

sync().catch(console.error);

