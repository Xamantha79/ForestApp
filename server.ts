import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "./server/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to get zonal office ID from name
async function getZonalOfficeId(zonalOfficeName: string): Promise<number | null> {
  try {
    const [rows] = await db.execute('SELECT id FROM zonal_offices WHERE name = ?', [zonalOfficeName]);
    const result = rows as any[];
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting zonal office ID:', error);
    return null;
  }
}

// Helper function to get district ID from name
async function getDistrictId(districtName: string): Promise<number | null> {
  try {
    const [rows] = await db.execute('SELECT id FROM districts WHERE name = ?', [districtName]);
    const result = rows as any[];
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting district ID:', error);
    return null;
  }
}

// Helper function to get range forest office ID from name
async function getRangeForestOfficeId(rangeForestOfficeName: string): Promise<number | null> {
  try {
    const [rows] = await db.execute('SELECT id FROM range_forest_offices WHERE name = ?', [rangeForestOfficeName]);
    const result = rows as any[];
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting range forest office ID:', error);
    return null;
  }
}

// Helper function to get program type ID from name
async function getProgramTypeId(programTypeName: string): Promise<number | null> {
  try {
    const [rows] = await db.execute('SELECT id FROM program_types WHERE name = ?', [programTypeName]);
    const result = rows as any[];
    return result.length > 0 ? result[0].id : null;
  } catch (error) {
    console.error('Error getting program type ID:', error);
    return null;
  }
}

// Helper function to auto-populate zonal and district from range forest office
async function getHierarchyFromRangeForestOffice(rangeForestOfficeId: number): Promise<{zonal_office_id: number | null, district_id: number | null}> {
  try {
    const [rows] = await db.execute(`
      SELECT rfo.district_id, d.zonal_office_id 
      FROM range_forest_offices rfo 
      JOIN districts d ON rfo.district_id = d.id 
      WHERE rfo.id = ?
    `, [rangeForestOfficeId]);
    const result = rows as any[];
    if (result.length > 0) {
      return {
        zonal_office_id: result[0].zonal_office_id,
        district_id: result[0].district_id
      };
    }
    return { zonal_office_id: null, district_id: null };
  } catch (error) {
    console.error('Error getting hierarchy from range forest office:', error);
    return { zonal_office_id: null, district_id: null };
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // --- API Routes ---

  // Login
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    try {
      const [rows] = await db.execute(`
        SELECT o.*, 
               z.name as zonal_office, 
               d.name as district, 
               rfo.name as range_forest_office 
        FROM officers o 
        LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id 
        LEFT JOIN districts d ON rfo.district_id = d.id 
        LEFT JOIN zonal_offices z ON d.zonal_office_id = z.id 
        WHERE o.username = ? AND o.password = ?
      `, [username, password]);
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
    const { username, password, name, range_forest_office, phone, role = 'officer' } = req.body;
    
    try {
      // Check if username already exists
      const [existingRows] = await db.execute('SELECT id FROM officers WHERE username = ?', [username]);
      const existing = existingRows as any[];
      
      if (existing.length > 0) {
        return res.status(400).json({ success: false, message: "Username already exists" });
      }

      // Get range forest office ID
      const rangeForestOfficeId = await getRangeForestOfficeId(range_forest_office);
      if (!rangeForestOfficeId) {
        return res.status(400).json({ success: false, message: "Invalid range forest office" });
      }

      // Insert new officer (only stores range_forest_office_id)
      const [result] = await db.execute(`
        INSERT INTO officers (username, password, name, range_forest_office_id, phone, role)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [username, password, name, rangeForestOfficeId, phone, role]);
      
      const insertResult = result as any;
      res.json({ success: true, id: insertResult.insertId, message: "Officer registered successfully" });
    } catch (err: any) {
      console.error('Registration error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get Programs (with filters)
  app.get("/api/programs", async (req, res) => {
    const { officer_id, type, district, range_forest_office, zonal_office, start_date, end_date } = req.query;
    let query = `
      SELECT p.*, 
             o.name as officer_name, 
             z.name as zonal_office,
             d.name as district, 
             rfo.name as range_forest_office,
             pt.name as program_type
      FROM programs p 
      LEFT JOIN officers o ON p.officer_id = o.id 
      LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id
      LEFT JOIN districts d ON rfo.district_id = d.id 
      LEFT JOIN zonal_offices z ON d.zonal_office_id = z.id
      LEFT JOIN program_types pt ON p.program_type_id = pt.id
      WHERE 1=1
    `;
    const params = [];

    if (officer_id) {
      query += ' AND p.officer_id = ?';
      params.push(officer_id);
    }
    if (type) {
      query += ' AND pt.name = ?';
      params.push(type);
    }
    if (district) {
      query += ' AND d.name = ?';
      params.push(district);
    }
    if (range_forest_office) {
      query += ' AND rfo.name = ?';
      params.push(range_forest_office);
    }
    if (zonal_office) {
      query += ' AND z.name = ?';
      params.push(zonal_office);
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
    const { program_type, officer_id, date, description, latitude, longitude, location_name, aga_division, gn_division, plants_count, participants, details } = req.body;
    
    try {
      // Get program type ID
      let programTypeId = await getProgramTypeId(program_type);
      if (!programTypeId && program_type) {
        const [insertResult] = await db.execute('INSERT INTO program_types (name, description) VALUES (?, ?)', [program_type, 'Auto-created from program submission']);
        programTypeId = (insertResult as any).insertId;
      }

      const [result] = await db.execute(`
        INSERT INTO programs (program_type_id, officer_id, date, description, latitude, longitude, location_name, aga_division, gn_division, plants_count, participants, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        programTypeId, 
        officer_id, 
        date, 
        description, 
        latitude, 
        longitude, 
        location_name,
        aga_division,
        gn_division,
        plants_count || 0,
        participants || 0,
        JSON.stringify(details || {})
      ]);
      
      const insertResult = result as any;
      res.json({ success: true, id: insertResult.insertId });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Build shared WHERE clause for analytics queries
  function buildAnalyticsFilters(query: Record<string, unknown>) {
    const {
      officer_id,
      district,
      range_office,
      zonal_office,
      year,
      start_date,
      end_date,
      program_type,
      search,
    } = query;

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];

    if (officer_id) {
      whereClause += ' AND p.officer_id = ?';
      params.push(officer_id);
    }
    if (district) {
      whereClause += ' AND d.name = ?';
      params.push(district);
    }
    if (range_office) {
      whereClause += ' AND rfo.name = ?';
      params.push(range_office);
    }
    if (zonal_office) {
      whereClause += ' AND z.name = ?';
      params.push(zonal_office);
    }
    if (year) {
      whereClause += ' AND YEAR(p.date) = ?';
      params.push(year);
    }
    if (start_date) {
      whereClause += ' AND p.date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      whereClause += ' AND p.date <= ?';
      params.push(end_date);
    }
    if (program_type) {
      whereClause += ' AND pt.name = ?';
      params.push(program_type);
    }
    if (search && String(search).trim()) {
      const term = `%${String(search).trim()}%`;
      whereClause += ` AND (
        o.name LIKE ? OR pt.name LIKE ? OR p.location_name LIKE ? OR
        p.description LIKE ? OR d.name LIKE ? OR rfo.name LIKE ? OR z.name LIKE ?
      )`;
      params.push(term, term, term, term, term, term, term);
    }

    return { whereClause, params };
  }

  const analyticsJoin = `
    FROM programs p
    LEFT JOIN officers o ON p.officer_id = o.id
    LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id
    LEFT JOIN districts d ON rfo.district_id = d.id
    LEFT JOIN zonal_offices z ON d.zonal_office_id = z.id
    LEFT JOIN program_types pt ON p.program_type_id = pt.id
  `;

  // Comprehensive analytics for admin portal
  app.get("/api/analytics", async (req, res) => {
    try {
      const { whereClause, params } = buildAnalyticsFilters(req.query);

      const [summaryRows] = await db.execute(
        `SELECT
          COUNT(*) as total_programs,
          COALESCE(SUM(p.plants_count), 0) as total_trees,
          COALESCE(SUM(p.participants), 0) as total_participants,
          COUNT(DISTINCT p.officer_id) as active_officers,
          COUNT(DISTINCT p.date) as active_days,
          MIN(p.date) as first_date,
          MAX(p.date) as last_date
        ${analyticsJoin}
        ${whereClause}`,
        params
      );

      const [byTypeRows] = await db.execute(
        `SELECT pt.name as program_type, COUNT(*) as count,
          COALESCE(SUM(p.plants_count), 0) as trees,
          COALESCE(SUM(p.participants), 0) as participants
        ${analyticsJoin}
        ${whereClause}
        GROUP BY pt.name
        ORDER BY count DESC`,
        params
      );

      const [byDistrictRows] = await db.execute(
        `SELECT d.name as district, COUNT(*) as count,
          COALESCE(SUM(p.plants_count), 0) as trees
        ${analyticsJoin}
        ${whereClause}
        GROUP BY d.name
        ORDER BY count DESC`,
        params
      );

      const [byZonalRows] = await db.execute(
        `SELECT z.name as zonal_office, COUNT(*) as count
        ${analyticsJoin}
        ${whereClause}
        GROUP BY z.name
        ORDER BY count DESC`,
        params
      );

      const [byRangeRows] = await db.execute(
        `SELECT rfo.name as range_office, COUNT(*) as count,
          COALESCE(SUM(p.plants_count), 0) as trees
        ${analyticsJoin}
        ${whereClause}
        GROUP BY rfo.name
        ORDER BY count DESC`,
        params
      );

      const [byOfficerRows] = await db.execute(
        `SELECT o.id as officer_id, o.name as officer_name,
          rfo.name as range_office, d.name as district,
          COUNT(*) as count,
          COALESCE(SUM(p.plants_count), 0) as trees,
          COALESCE(SUM(p.participants), 0) as participants,
          MIN(p.date) as first_activity,
          MAX(p.date) as last_activity,
          COUNT(DISTINCT p.date) as active_days
        ${analyticsJoin}
        ${whereClause}
        GROUP BY o.id, o.name, rfo.name, d.name
        ORDER BY count DESC`,
        params
      );

      const [byMonthRows] = await db.execute(
        `SELECT YEAR(p.date) as year, MONTH(p.date) as month,
          COUNT(*) as count,
          COALESCE(SUM(p.plants_count), 0) as trees,
          COALESCE(SUM(p.participants), 0) as participants
        ${analyticsJoin}
        ${whereClause}
        GROUP BY YEAR(p.date), MONTH(p.date)
        ORDER BY year ASC, month ASC`,
        params
      );

      const [activityRows] = await db.execute(
        `SELECT p.id, p.date, pt.name as program_type, p.location_name,
          p.description, p.plants_count, p.participants,
          o.id as officer_id, o.name as officer_name,
          rfo.name as range_forest_office, d.name as district, z.name as zonal_office
        ${analyticsJoin}
        ${whereClause}
        ORDER BY p.date DESC, p.id DESC
        LIMIT 200`,
        params
      );

      const filterConditions = whereClause.replace(/^WHERE 1=1/, '').trim();
      const inactiveWhere = filterConditions
        ? `WHERE o.role = 'officer' AND NOT EXISTS (
            SELECT 1
            FROM programs p
            LEFT JOIN officers o2 ON p.officer_id = o2.id
            LEFT JOIN range_forest_offices rfo2 ON o2.range_forest_office_id = rfo2.id
            LEFT JOIN districts d2 ON rfo2.district_id = d2.id
            LEFT JOIN zonal_offices z2 ON d2.zonal_office_id = z2.id
            LEFT JOIN program_types pt2 ON p.program_type_id = pt2.id
            WHERE p.officer_id = o.id ${filterConditions.replace(/\bo\./g, 'o2.').replace(/\brfo\./g, 'rfo2.').replace(/\bd\./g, 'd2.').replace(/\bz\./g, 'z2.').replace(/\bpt\./g, 'pt2.')}
          )`
        : `WHERE o.role = 'officer' AND NOT EXISTS (
            SELECT 1 FROM programs p WHERE p.officer_id = o.id
          )`;

      const [inactiveRows] = await db.execute(
        `SELECT o.id, o.name, rfo.name as range_office, d.name as district
        FROM officers o
        LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id
        LEFT JOIN districts d ON rfo.district_id = d.id
        ${inactiveWhere}
        ORDER BY o.name`,
        filterConditions ? params : []
      );
      const inactiveOfficers = inactiveRows as any[];

      const summary = (summaryRows as any[])[0];

      res.json({
        summary: {
          totalPrograms: Number(summary.total_programs) || 0,
          totalTrees: Number(summary.total_trees) || 0,
          totalParticipants: Number(summary.total_participants) || 0,
          activeOfficers: Number(summary.active_officers) || 0,
          activeDays: Number(summary.active_days) || 0,
          firstDate: summary.first_date,
          lastDate: summary.last_date,
        },
        byType: byTypeRows,
        byDistrict: byDistrictRows,
        byZonal: byZonalRows,
        byRange: byRangeRows,
        byOfficer: byOfficerRows,
        byMonth: byMonthRows,
        activityLog: (activityRows as any[]).map((row) => ({
          ...row,
          plants_count: row.plants_count || 0,
          participants: row.participants || 0,
        })),
        inactiveOfficers,
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get Stats
  app.get("/api/stats", async (req, res) => {
    try {
      const { officer_id, district, range_office, year } = req.query;
      
      let whereClause = 'WHERE 1=1';
      const params = [];
      
      if (officer_id) {
        whereClause += ' AND p.officer_id = ?';
        params.push(officer_id);
      }
      if (district) {
        whereClause += ' AND d.name = ?';
        params.push(district);
      }
      if (range_office) {
        whereClause += ' AND rfo.name = ?';
        params.push(range_office);
      }
      if (year) {
        whereClause += ' AND YEAR(p.date) = ?';
        params.push(year);
      }

      const [totalProgramsRows] = await db.execute(`SELECT COUNT(*) as count FROM programs p LEFT JOIN officers o ON p.officer_id = o.id LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id LEFT JOIN districts d ON rfo.district_id = d.id ${whereClause}`, params);
      const [totalTreesRows] = await db.execute(`SELECT SUM(p.plants_count) as total FROM programs p LEFT JOIN officers o ON p.officer_id = o.id LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id LEFT JOIN districts d ON rfo.district_id = d.id ${whereClause}`, params);
      const [byTypeRows] = await db.execute(`SELECT pt.name as program_type, COUNT(*) as count FROM programs p LEFT JOIN program_types pt ON p.program_type_id = pt.id LEFT JOIN officers o ON p.officer_id = o.id LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id LEFT JOIN districts d ON rfo.district_id = d.id ${whereClause} GROUP BY pt.name`, params);
      const [byDistrictRows] = await db.execute(`SELECT d.name as district, COUNT(*) as count FROM programs p LEFT JOIN officers o ON p.officer_id = o.id LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id LEFT JOIN districts d ON rfo.district_id = d.id ${whereClause} GROUP BY d.name`, params);
      const [byZonalRows] = await db.execute(`SELECT z.name as zonal_office, COUNT(*) as count FROM programs p LEFT JOIN officers o ON p.officer_id = o.id LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id LEFT JOIN districts d ON rfo.district_id = d.id LEFT JOIN zonal_offices z ON d.zonal_office_id = z.id ${whereClause} GROUP BY z.name`, params);
      const [byOfficerRows] = await db.execute(`SELECT o.name as officer_name, COUNT(*) as count FROM programs p LEFT JOIN officers o ON p.officer_id = o.id ${whereClause} GROUP BY o.name ORDER BY count DESC`, params);
      
      const totalPrograms = (totalProgramsRows as any[])[0];
      const totalTrees = (totalTreesRows as any[])[0].total || 0;
      const byType = byTypeRows as any[];
      const byDistrict = byDistrictRows as any[];
      const byZonal = byZonalRows as any[];
      const byOfficer = byOfficerRows as any[];
      
      res.json({
        total: totalPrograms.count,
        totalTrees,
        byType,
        byDistrict,
        byZonal,
        byOfficer
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get Officers (for filter dropdown)
  app.get("/api/officers", async (req, res) => {
    try {
      const [rows] = await db.execute(`
        SELECT o.id, o.name, rfo.name as range_office 
        FROM officers o 
        LEFT JOIN range_forest_offices rfo ON o.range_forest_office_id = rfo.id 
        ORDER BY o.name
      `);
      const officers = rows as any[];
      res.json(officers);
    } catch (error) {
      console.error('Get officers error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get Hierarchy Data (for registration form)
  app.get("/api/hierarchy", async (req, res) => {
    try {
      const [zonalRows] = await db.execute('SELECT id, name, code FROM zonal_offices ORDER BY name');
      const [districtRows] = await db.execute('SELECT id, name, zonal_office_id FROM districts ORDER BY name');
      const [rangeForestOfficeRows] = await db.execute(`
        SELECT rfo.id, rfo.name, rfo.district_id, d.name as district_name, d.zonal_office_id, z.name as zonal_office_name
        FROM range_forest_offices rfo 
        JOIN districts d ON rfo.district_id = d.id 
        JOIN zonal_offices z ON d.zonal_office_id = z.id
        ORDER BY d.name, rfo.name
      `);
      
      const zonalOffices = zonalRows as any[];
      const districts = districtRows as any[];
      const rangeForestOffices = rangeForestOfficeRows as any[];
      
      res.json({
        zonal_offices: zonalOffices,
        districts: districts,
        range_forest_offices: rangeForestOffices
      });
    } catch (error) {
      console.error('Get hierarchy error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Get Program Types
  app.get("/api/program-types", async (req, res) => {
    try {
      const [rows] = await db.execute('SELECT * FROM program_types ORDER BY name');
      const programTypes = rows as any[];
      res.json(programTypes);
    } catch (error) {
      console.error('Get program types error:', error);
      res.status(500).json({ success: false, message: "Server error" });
    }
  });

  // Create Program Type (Admin only)
  app.post("/api/program-types", async (req, res) => {
    const { name, description } = req.body;
    
    try {
      if (!name) {
        return res.status(400).json({ success: false, message: "Program type name is required" });
      }

      const [result] = await db.execute(
        'INSERT INTO program_types (name, description) VALUES (?, ?)',
        [name, description || null]
      );
      
      const insertResult = result as any;
      res.json({ success: true, id: insertResult.insertId, message: "Program type created successfully" });
    } catch (err: any) {
      console.error('Create program type error:', err);
      if (err.code === 'ER_DUP_ENTRY') {
        res.status(400).json({ success: false, message: "Program type already exists" });
      } else {
        res.status(500).json({ success: false, message: err.message });
      }
    }
  });

  // Delete Program Type (Admin only)
  app.delete("/api/program-types/:id", async (req, res) => {
    const { id } = req.params;
    
    try {
      // Check if program type is being used by any programs
      const [checkRows] = await db.execute(
        'SELECT COUNT(*) as count FROM programs WHERE program_type_id = ?',
        [id]
      );
      const checkResult = checkRows as any[];
      
      if (checkResult[0].count > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Cannot delete program type that is in use by existing programs" 
        });
      }

      const [result] = await db.execute('DELETE FROM program_types WHERE id = ?', [id]);
      res.json({ success: true, message: "Program type deleted successfully" });
    } catch (err: any) {
      console.error('Delete program type error:', err);
      res.status(500).json({ success: false, message: err.message });
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
