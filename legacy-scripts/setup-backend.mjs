import fs from 'fs';
import path from 'path';

const files = {
  'package.json': `{
  "name": "caneready-ph",
  "private": true,
  "version": "1.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "server": "node server/index.js",
    "dev:full": "concurrently \\"npm run server\\" \\"npm run dev\\"",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.46.1",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.21.1",
    "lucide-react": "^0.460.0",
    "mongoose": "^8.8.1",
    "mysql2": "^3.11.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.3",
    "autoprefixer": "^10.4.20",
    "concurrently": "^9.1.0",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "vite": "^5.4.10"
  }
}
`,

  '.env.example': `# --- OPTION A: SUPABASE (PostgreSQL) ---
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# --- OPTION B: NODE.JS + EXPRESS BACKEND ---
VITE_API_URL=http://localhost:5000/api
PORT=5000

# Set DB_ENGINE to: json | mysql | mongodb (defaults to json)
DB_ENGINE=json

# If DB_ENGINE=mysql
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=caneready_db

# If DB_ENGINE=mongodb
MONGODB_URI=mongodb://127.0.0.1:27017/caneready_db
`,

  'database/schema.sql': `CREATE TABLE IF NOT EXISTS farm_lots (
  id VARCHAR(32) PRIMARY KEY,
  hacienda VARCHAR(120) NOT NULL,
  planter VARCHAR(120) NOT NULL,
  sector VARCHAR(80) NOT NULL,
  variety VARCHAR(80) NOT NULL,
  crop_class VARCHAR(40) NOT NULL,
  area_ha NUMERIC(6,2) NOT NULL,
  expected_tc_ha NUMERIC(6,2) DEFAULT 75,
  planting_date DATE NOT NULL,
  crop_age_months NUMERIC(4,1) NOT NULL,
  top_brix NUMERIC(4,1) NOT NULL,
  bottom_brix NUMERIC(4,1) NOT NULL,
  soil_moisture VARCHAR(60) DEFAULT 'Optimal (18%)',
  last_sampled DATE NOT NULL,
  svg_points TEXT,
  label_pos JSONB,
  dispatch JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`,

  'server/index.js': `import express from 'express';
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
`,

  'src/services/lotService.js': `import { createClient } from '@supabase/supabase-js';
import { INITIAL_LOTS } from '../data/initialLots';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const supabase =
  SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function fromSqlRow(row) {
  return {
    id: row.id,
    hacienda: row.hacienda,
    planter: row.planter,
    sector: row.sector,
    variety: row.variety,
    cropClass: row.crop_class ?? row.cropClass,
    areaHa: Number(row.area_ha ?? row.areaHa),
    expectedTcHa: Number(row.expected_tc_ha ?? row.expectedTcHa ?? 75),
    plantingDate: row.planting_date ?? row.plantingDate,
    cropAgeMonths: Number(row.crop_age_months ?? row.cropAgeMonths),
    topBrix: Number(row.top_brix ?? row.topBrix),
    bottomBrix: Number(row.bottom_brix ?? row.bottomBrix),
    soilMoisture: row.soil_moisture ?? row.soilMoisture,
    lastSampled: row.last_sampled ?? row.lastSampled,
    svgPoints: row.svg_points ?? row.svgPoints,
    labelPos: row.label_pos ?? row.labelPos,
    dispatch: row.dispatch ?? null,
  };
}

export async function fetchAllLots() {
  if (supabase) {
    const { data, error } = await supabase
      .from('farm_lots')
      .select('*')
      .order('id', { ascending: true });
    if (!error && data) {
      return { lots: data.map(fromSqlRow), source: 'Supabase (PostgreSQL)' };
    }
  }

  try {
    const res = await fetch(API_URL + '/lots');
    if (res.ok) {
      const data = await res.json();
      return { lots: data.map(fromSqlRow), source: 'Express Backend API' };
    }
  } catch {
    // Fallback to localStorage
  }

  const saved = localStorage.getItem('caneready_lots_v1');
  const lots = saved ? JSON.parse(saved) : INITIAL_LOTS;
  return { lots, source: 'Local Storage (Offline Mode)' };
}

export async function createFarmLot(newLot) {
  if (supabase) {
    await supabase.from('farm_lots').insert([
      {
        id: newLot.id,
        hacienda: newLot.hacienda,
        planter: newLot.planter,
        sector: newLot.sector,
        variety: newLot.variety,
        crop_class: newLot.cropClass,
        area_ha: newLot.areaHa,
        expected_tc_ha: newLot.expectedTcHa,
        planting_date: newLot.plantingDate,
        crop_age_months: newLot.cropAgeMonths,
        top_brix: newLot.topBrix,
        bottom_brix: newLot.bottomBrix,
        soil_moisture: newLot.soilMoisture,
        last_sampled: newLot.lastSampled,
        dispatch: null,
      },
    ]);
    return;
  }

  try {
    await fetch(API_URL + '/lots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newLot),
    });
  } catch {}
}

export async function updateLotBrixSample(lotId, topBrix, bottomBrix, lastSampled) {
  if (supabase) {
    await supabase
      .from('farm_lots')
      .update({ top_brix: topBrix, bottom_brix: bottomBrix, last_sampled: lastSampled })
      .eq('id', lotId);
    return;
  }

  try {
    await fetch(API_URL + '/lots/' + lotId + '/brix', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topBrix, bottomBrix, lastSampled }),
    });
  } catch {}
}

export async function updateLotDispatch(lotId, dispatchData) {
  if (supabase) {
    await supabase
      .from('farm_lots')
      .update({ dispatch: dispatchData })
      .eq('id', lotId);
    return;
  }

  try {
    await fetch(API_URL + '/lots/' + lotId + '/dispatch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dispatch: dispatchData }),
    });
  } catch {}
}
`,

  'src/App.jsx': `import React, { useState, useEffect, useMemo } from 'react';
import { INITIAL_LOTS } from './data/initialLots';
import { evaluateLotMetrics } from './utils/caneCalculations';
import {
  fetchAllLots,
  createFarmLot,
  updateLotBrixSample,
  updateLotDispatch,
} from './services/lotService';
import Navbar from './components/Navbar';
import KpiStrip from './components/KpiStrip';
import FilterToolbar from './components/FilterToolbar';
import LotCardGrid from './components/LotCardGrid';
import ParcelMapView from './components/ParcelMapView';
import PlanterTableView from './components/PlanterTableView';
import LotInspectorDrawer from './components/LotInspectorDrawer';
import { QuickBrixModal, RegisterLotModal } from './components/Modals';

export default function App() {
  const [rawLots, setRawLots] = useState(INITIAL_LOTS);
  const [dataSource, setDataSource] = useState('Connecting...');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sectorFilter, setSectorFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('readiness');
  const [viewMode, setViewMode] = useState('cards');

  const [selectedLotId, setSelectedLotId] = useState(null);
  const [isBrixModalOpen, setIsBrixModalOpen] = useState(false);
  const [isNewLotModalOpen, setIsNewLotModalOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetchAllLots().then(({ lots, source }) => {
      if (mounted) {
        setRawLots(lots);
        setDataSource(source);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('caneready_lots_v1', JSON.stringify(rawLots));
  }, [rawLots]);

  const evaluatedLots = useMemo(
    () => rawLots.map((lot) => evaluateLotMetrics(lot)),
    [rawLots]
  );

  const sectors = useMemo(
    () => Array.from(new Set(rawLots.map((l) => l.sector))),
    [rawLots]
  );

  const filteredLots = useMemo(() => {
    return evaluatedLots
      .filter((lot) => {
        const matchesStatus =
          statusFilter === 'ALL' || lot.status === statusFilter;
        const matchesSector =
          sectorFilter === 'ALL' || lot.sector === sectorFilter;
        const q = searchQuery.toLowerCase();
        const matchesQuery =
          !q ||
          lot.id.toLowerCase().includes(q) ||
          lot.hacienda.toLowerCase().includes(q) ||
          lot.planter.toLowerCase().includes(q) ||
          lot.variety.toLowerCase().includes(q);

        return matchesStatus && matchesSector && matchesQuery;
      })
      .sort((a, b) => {
        if (sortBy === 'brix') return b.avgBrix - a.avgBrix;
        if (sortBy === 'age') return b.cropAgeMonths - a.cropAgeMonths;
        if (sortBy === 'area') return b.areaHa - a.areaHa;
        return b.readinessScore - a.readinessScore;
      });
  }, [evaluatedLots, statusFilter, sectorFilter, searchQuery, sortBy]);

  const selectedLot = useMemo(
    () => evaluatedLots.find((l) => l.id === selectedLotId) || null,
    [evaluatedLots, selectedLotId]
  );

  const handleUpdateBrix = async (lotId, topBrix, bottomBrix) => {
    const today = new Date().toISOString().split('T')[0];
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId
          ? { ...lot, topBrix, bottomBrix, lastSampled: today }
          : lot
      )
    );
    await updateLotBrixSample(lotId, topBrix, bottomBrix, today);
  };

  const handleSaveDispatch = async (lotId, dispatchData) => {
    setRawLots((prev) =>
      prev.map((lot) =>
        lot.id === lotId ? { ...lot, dispatch: dispatchData } : lot
      )
    );
    await updateLotDispatch(lotId, dispatchData);
  };

  const handleAddLot = async (newLot) => {
    setRawLots((prev) => [newLot, ...prev]);
    await createFarmLot(newLot);
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Navbar
        onOpenBrixModal={() => setIsBrixModalOpen(true)}
        onOpenNewLotModal={() => setIsNewLotModalOpen(true)}
      />

      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              Database Source: <strong className="text-white">{dataSource}</strong>
            </span>
          </div>
          <span className="hidden sm:inline text-slate-400">
            Auto-syncing Refractometer Brix & Dispatch Records
          </span>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <KpiStrip
          lots={evaluatedLots}
          statusFilter={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        <FilterToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sectorFilter={sectorFilter}
          onSectorChange={setSectorFilter}
          sectors={sectors}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
        />

        {viewMode === 'cards' && (
          <LotCardGrid
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}

        {viewMode === 'map' && (
          <ParcelMapView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}

        {viewMode === 'table' && (
          <PlanterTableView
            lots={filteredLots}
            onSelectLot={(lot) => setSelectedLotId(lot.id)}
          />
        )}
      </main>

      <LotInspectorDrawer
        lot={selectedLot}
        onClose={() => setSelectedLotId(null)}
        onUpdateBrix={handleUpdateBrix}
        onSaveDispatch={handleSaveDispatch}
      />

      <QuickBrixModal
        isOpen={isBrixModalOpen}
        onClose={() => setIsBrixModalOpen(false)}
        lots={evaluatedLots}
        onUpdateBrix={handleUpdateBrix}
      />

      <RegisterLotModal
        isOpen={isNewLotModalOpen}
        onClose={() => setIsNewLotModalOpen(false)}
        onAddLot={handleAddLot}
      />
    </div>
  );
}
`
};

for (const [relativePath, content] of Object.entries(files)) {
  const fullPath = path.resolve(process.cwd(), relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created: ' + relativePath);
}
