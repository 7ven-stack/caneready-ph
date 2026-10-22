import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';
import mongoose from 'mongoose';
import { INITIAL_LOTS } from '../src/data/initialLots.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const DB_ENGINE = (process.env.DB_ENGINE || 'json').toLowerCase();

app.use(cors());
app.use(express.json());

const DB_FILE = path.resolve(process.cwd(), 'server/database.json');
function readJsonDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_LOTS, null, 2), 'utf8');
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeJsonDb(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

let mysqlPool = null;
async function initMySQL() {
  mysqlPool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'caneready_db',
    waitForConnections: true,
    connectionLimit: 10
  });
  await mysqlPool.query(
    'CREATE TABLE IF NOT EXISTS farm_lots (' +
    'id VARCHAR(32) PRIMARY KEY, hacienda VARCHAR(120), planter VARCHAR(120), ' +
    'sector VARCHAR(80), variety VARCHAR(80), cropClass VARCHAR(40), ' +
    'areaHa DOUBLE, expectedTcHa DOUBLE, plantingDate VARCHAR(20), ' +
    'cropAgeMonths DOUBLE, topBrix DOUBLE, bottomBrix DOUBLE, ' +
    'soilMoisture VARCHAR(60), lastSampled VARCHAR(20), svgPoints TEXT, ' +
    'labelPos JSON, dispatch JSON)'
  );
  const [rows] = await mysqlPool.query('SELECT COUNT(*) as count FROM farm_lots');
  if (rows[0].count === 0) {
    for (const lot of INITIAL_LOTS) {
      await mysqlPool.query(
        'INSERT INTO farm_lots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          lot.id, lot.hacienda, lot.planter, lot.sector, lot.variety, lot.cropClass,
          lot.areaHa, lot.expectedTcHa, lot.plantingDate, lot.cropAgeMonths,
          lot.topBrix, lot.bottomBrix, lot.soilMoisture, lot.lastSampled,
          lot.svgPoints || null, JSON.stringify(lot.labelPos || null), JSON.stringify(lot.dispatch || null)
        ]
      );
    }
  }
  console.log('Connected to MySQL database');
}

let LotModel = null;
async function initMongoDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/caneready_db';
  await mongoose.connect(uri);
  const lotSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    hacienda: String,
    planter: String,
    sector: String,
    variety: String,
    cropClass: String,
    areaHa: Number,
    expectedTcHa: Number,
    plantingDate: String,
    cropAgeMonths: Number,
    topBrix: Number,
    bottomBrix: Number,
    soilMoisture: String,
    lastSampled: String,
    svgPoints: String,
    labelPos: Object,
    dispatch: Object
  });
  LotModel = mongoose.models.FarmLot || mongoose.model('FarmLot', lotSchema);
  const count = await LotModel.countDocuments();
  if (count === 0) {
    await LotModel.insertMany(INITIAL_LOTS);
  }
  console.log('Connected to MongoDB database');
}

(async () => {
  try {
    if (DB_ENGINE === 'mysql') await initMySQL();
    else if (DB_ENGINE === 'mongodb') await initMongoDB();
    else {
      readJsonDb();
      console.log('Using local JSON database (server/database.json)');
    }
  } catch (err) {
    console.error('Database init warning, falling back to JSON store:', err.message);
  }
})();

app.get('/api/lots', async (req, res) => {
  try {
    if (DB_ENGINE === 'mysql' && mysqlPool) {
      const [rows] = await mysqlPool.query('SELECT * FROM farm_lots');
      return res.json(rows);
    }
    if (DB_ENGINE === 'mongodb' && LotModel) {
      const docs = await LotModel.find({}, { _id: 0, __v: 0 }).lean();
      return res.json(docs);
    }
    return res.json(readJsonDb());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lots', async (req, res) => {
  try {
    const newLot = req.body;
    if (DB_ENGINE === 'mysql' && mysqlPool) {
      await mysqlPool.query(
        'INSERT INTO farm_lots VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [
          newLot.id, newLot.hacienda, newLot.planter, newLot.sector, newLot.variety, newLot.cropClass,
          newLot.areaHa, newLot.expectedTcHa, newLot.plantingDate, newLot.cropAgeMonths,
          newLot.topBrix, newLot.bottomBrix, newLot.soilMoisture, newLot.lastSampled,
          newLot.svgPoints || null, JSON.stringify(newLot.labelPos || null), JSON.stringify(newLot.dispatch || null)
        ]
      );
      return res.status(201).json(newLot);
    }
    if (DB_ENGINE === 'mongodb' && LotModel) {
      await LotModel.create(newLot);
      return res.status(201).json(newLot);
    }
    const lots = readJsonDb();
    lots.unshift(newLot);
    writeJsonDb(lots);
    return res.status(201).json(newLot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/lots/:id/brix', async (req, res) => {
  try {
    const { id } = req.params;
    const { topBrix, bottomBrix, lastSampled } = req.body;

    if (DB_ENGINE === 'mysql' && mysqlPool) {
      await mysqlPool.query(
        'UPDATE farm_lots SET topBrix = ?, bottomBrix = ?, lastSampled = ? WHERE id = ?',
        [topBrix, bottomBrix, lastSampled, id]
      );
      return res.json({ id, topBrix, bottomBrix, lastSampled });
    }
    if (DB_ENGINE === 'mongodb' && LotModel) {
      await LotModel.updateOne({ id }, { $set: { topBrix, bottomBrix, lastSampled } });
      return res.json({ id, topBrix, bottomBrix, lastSampled });
    }
    const lots = readJsonDb().map((l) =>
      l.id === id ? { ...l, topBrix, bottomBrix, lastSampled } : l
    );
    writeJsonDb(lots);
    return res.json({ id, topBrix, bottomBrix, lastSampled });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/lots/:id/dispatch', async (req, res) => {
  try {
    const { id } = req.params;
    const { dispatch } = req.body;

    if (DB_ENGINE === 'mysql' && mysqlPool) {
      await mysqlPool.query(
        'UPDATE farm_lots SET dispatch = ? WHERE id = ?',
        [JSON.stringify(dispatch), id]
      );
      return res.json({ id, dispatch });
    }
    if (DB_ENGINE === 'mongodb' && LotModel) {
      await LotModel.updateOne({ id }, { $set: { dispatch } });
      return res.json({ id, dispatch });
    }
    const lots = readJsonDb().map((l) =>
      l.id === id ? { ...l, dispatch } : l
    );
    writeJsonDb(lots);
    return res.json({ id, dispatch });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log('CaneReadyPH API Server running at http://localhost:' + PORT + '/api/lots (Engine: ' + DB_ENGINE.toUpperCase() + ')');
});
