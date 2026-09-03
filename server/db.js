/* One shared MongoDB connection for the API and the CLI scripts. */
const { MongoClient } = require('mongodb');

const URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017';
const DB_NAME = process.env.MONGO_DB || 'wonderherb';

let client;
let db;

async function connect() {
  if (db) return db;
  client = new MongoClient(URL, { serverSelectionTimeoutMS: 3000 });
  await client.connect();
  db = client.db(DB_NAME);
  return db;
}

async function close() {
  if (client) await client.close();
  client = null;
  db = null;
}

/* The admin edits whole lists, so each module is stored as one document per
   item in its own collection, ordered by `pos` to keep the editor's order. */
const COLLECTIONS = {
  cases: 'cases',
  products: 'products',
  faq: 'faq',
  movements: 'movements',
  activity: 'activity'
};

/* Accounts are deliberately NOT in COLLECTIONS: that map is what /api/cms will
   hand to a browser and what `npm run export` writes into data/. Password
   hashes and sessions must never travel either route. */
const AUTH_COLLECTIONS = {
  users: 'users',
  sessions: 'sessions'
};

/* Numbers stored as numbers, text as text — so the database can be queried and
   sorted properly instead of holding everything as strings.
   `price` stays the "3800.00" string the site's markup already renders. */
function normalise(name, item) {
  const doc = Object.assign({}, item);
  const int = v => {
    if (v === undefined || v === null || v === '') return undefined;
    const n = parseInt(v, 10);
    return isNaN(n) ? undefined : n;
  };

  if (name === 'products') {
    ['id', 'stock', 'reorder'].forEach(k => {
      const n = int(doc[k]);
      if (n === undefined) delete doc[k]; else doc[k] = n;
    });
    if (doc.price !== undefined) doc.price = String(doc.price);
    ['images', 'testimonies', 'papers', 'articles'].forEach(k => {
      if (doc[k] !== undefined && !Array.isArray(doc[k])) delete doc[k];
    });
  }
  if (name === 'faq') {
    const n = int(doc.id);
    if (n === undefined) delete doc.id; else doc.id = n;
  }
  if (name === 'movements') {
    ['delta', 'after'].forEach(k => {
      const n = int(doc[k]);
      if (n === undefined) delete doc[k]; else doc[k] = n;
    });
  }
  return doc;
}

async function ensureIndexes(db) {
  await db.collection(COLLECTIONS.products).createIndex({ sku: 1 });
  await db.collection(COLLECTIONS.products).createIndex({ status: 1 });
  await db.collection(COLLECTIONS.faq).createIndex({ cat: 1 });
  await db.collection(COLLECTIONS.movements).createIndex({ at: -1 });
  await db.collection(COLLECTIONS.movements).createIndex({ sku: 1 });
  await db.collection(COLLECTIONS.activity).createIndex({ at: -1 });
}

/* One account per email address, and MongoDB itself expires stale sessions. */
async function ensureAuthIndexes(db) {
  await db.collection(AUTH_COLLECTIONS.users).createIndex({ email: 1 }, { unique: true });
  await db.collection(AUTH_COLLECTIONS.users).createIndex({ role: 1 });
  await db.collection(AUTH_COLLECTIONS.sessions).createIndex({ userId: 1 });
  await db.collection(AUTH_COLLECTIONS.sessions)
    .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
}

module.exports = { connect, close, COLLECTIONS, AUTH_COLLECTIONS, normalise,
                   ensureIndexes, ensureAuthIndexes, URL, DB_NAME };
