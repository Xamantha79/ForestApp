import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./server/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- API Routes ---

  // Login
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const [rows] = await db.execute('SELECT * FROM officers WHERE username = ? AND password = ?', [username, password]);
      const user = (rows as any[])[0];

      if (user) {
        res.json({ success: true, user });
      } else {
        res.status(401).json({ success: false, message: "Invalid credentials" });
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Register
  app.post("/api/register", async (req, res) => {
    const { username, password, name, district, range_office, phone, role = 'officer' } = req.body;
    
    try {
      // Check if username already exists
      const [existingRows] = await db.execute('SELECT id FROM officers WHERE username = ?', [username]);
      const existing = existingRows as any[];
      
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }

      // Insert new officer
      const [result] = await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [username, password, name, district, range_office, phone, role]);
      
      const insertResult = result as any;
      res.json({ success: true, id: insertResult.insertId, message: "Officer registered successfully" });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get Programs (with filters)
  app.get("/api/programs", async (req, res) => {
    const { officer_id, type, district, range, start_date, end_date } = req.query;
    // We now prefer the program's district if available, otherwise fallback to officer's district
    let query = 'SELECT p.*, o.name as officer_name, COALESCE(p.district, o.district) as district, o.range_office FROM programs p JOIN officers o ON p.officer_id = o.id WHERE 1=1';
    const params = [];

    if (officer_id) {
      query += ' AND p.officer_id = ?';
      params.push(officer_id);
    }
    if (type) {
      query += ' AND p.program_type = ?';
      params.push(type);
    }
    if (district) {
      // Filter by either program district or officer district
      query += ' AND (p.district = ? OR (p.district IS NULL AND o.district = ?))';
      params.push(district);
      params.push(district);
    }
    if (range) {
      query += ' AND o.range_office = ?';
      params.push(range);
    }
    if (start_date) {
      query += ' AND p.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND p.date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY p.date DESC';

    try {
      const [rows] = await db.execute(query, params);
      const programs = rows as any[];
      
      // Parse JSON details
      const parsedPrograms = programs.map((p: any) => ({
        ...p,
        details: p.details ? (typeof p.details === 'string' ? JSON.parse(p.details) : p.details) : {}
      }));

      res.json(parsedPrograms);
    } catch (error) {
      console.error('Get programs error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Create Program
  app.post("/api/programs", async (req, res) => {
    const { program_type, officer_id, date, description, latitude, longitude, location_name, district, aga_division, gn_division, plants_count, participants, details } = req.body;
    
    try {
      const [result] = await db.execute(`
        INSERT INTO programs (program_type, officer_id, date, description, latitude, longitude, location_name, district, participants, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        program_type, 
        officer_id, 
        date, 
        description, 
        latitude, 
        longitude, 
        location_name,
        district,
        participants, 
        JSON.stringify(details || {})
      ]);
      
      const insertResult = result as any;
      res.json({ success: true, id: insertResult.insertId });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get Stats
  app.get("/api/stats", async (req, res) => {
    try {
      const [totalProgramsRows] = await db.execute('SELECT COUNT(*) as count FROM programs');
      const [byTypeRows] = await db.execute('SELECT program_type, COUNT(*) as count FROM programs GROUP BY program_type');
      const [byDistrictRows] = await db.execute('SELECT o.district, COUNT(*) as count FROM programs p JOIN officers o ON p.officer_id = o.id GROUP BY o.district');
      
      const totalPrograms = (totalProgramsRows as any[])[0];
      const byType = byTypeRows as any[];
      const byDistrict = byDistrictRows as any[];
      
      res.json({
        total: totalPrograms.count,
        byType,
        byDistrict
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
