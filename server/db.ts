import mysql from 'mysql2/promise';

// Create MySQL connection pool - Railway only
const db = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://root:VScBmggdqxGquzWJcTfNsCHckAgdQdIW@ballast.proxy.rlwy.net:33826/railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize normalized tables
async function initializeTables() {
  try {
    // Check if we need to migrate from old schema
    const needsMigration = await migrateFromOldSchema();

    // Zonal Offices lookup table (top level)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS zonal_offices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        code VARCHAR(20) UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Districts lookup table (linked to zonal offices)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS districts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        zonal_office_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (zonal_office_id) REFERENCES zonal_offices(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      )
    `);

    // Range Forest Offices lookup table (linked to districts)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS range_forest_offices (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        district_id INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (district_id) REFERENCES districts(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE,
        UNIQUE KEY unique_range_forest_office (name, district_id)
      )
    `);

    // Program Types lookup table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS program_types (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Officers table (normalized - only stores range_forest_office_id)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS officers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        range_forest_office_id INT,
        phone VARCHAR(50),
        role ENUM('officer', 'admin') DEFAULT 'officer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (range_forest_office_id) REFERENCES range_forest_offices(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      )
    `);

    // Programs table (normalized - only stores officer_id, zonal_office_id and district_id inferred through joins)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS programs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        program_type_id INT,
        officer_id INT,
        date DATE,
        description TEXT,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        location_name VARCHAR(255),
        aga_division VARCHAR(100),
        gn_division VARCHAR(100),
        plants_count INT DEFAULT 0,
        participants INT DEFAULT 0,
        details JSON,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (program_type_id) REFERENCES program_types(id)
        ON DELETE RESTRICT
        ON UPDATE CASCADE,
        FOREIGN KEY (officer_id) REFERENCES officers(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      )
    `);

    console.log('Tables initialized successfully');
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
}

// Migrate from old schema to new normalized schema
async function migrateFromOldSchema(): Promise<boolean> {
  try {
    let needsMigration = false;

    // Check if officers table has zonal_office_id column (indicates old schema)
    const [officerColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'officers' 
      AND COLUMN_NAME = 'zonal_office_id'
    `);
    
    if ((officerColumns as any[]).length > 0) {
      console.log('Detected old schema (officers table has zonal_office_id), starting migration...');
      
      // Backup old data if possible
      try {
        const [oldOfficers] = await db.execute('SELECT * FROM officers');
        const [oldPrograms] = await db.execute('SELECT * FROM programs');
        (global as any).oldOfficersData = oldOfficers;
        (global as any).oldProgramsData = oldPrograms;
      } catch (e) {
        console.log('Could not backup old data, proceeding with fresh start');
      }
      
      // Drop old tables
      await db.execute('DROP TABLE IF EXISTS programs');
      await db.execute('DROP TABLE IF EXISTS officers');
      await db.execute('DROP TABLE IF EXISTS range_offices');
      await db.execute('DROP TABLE IF EXISTS districts');
      await db.execute('DROP TABLE IF EXISTS program_types');
      
      console.log('Old tables dropped, will recreate with new zonal hierarchy schema');
      
      needsMigration = true;
    }

    // Check if programs table has zonal_office_id or district_id columns (indicates old programs schema)
    const [programColumns] = await db.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'programs' 
      AND (COLUMN_NAME = 'zonal_office_id' OR COLUMN_NAME = 'district_id')
    `);
    
    if ((programColumns as any[]).length > 0) {
      console.log('Detected old programs schema (has zonal_office_id or district_id), starting migration...');
      
      try {
        // Drop foreign key constraints first
        await db.execute('ALTER TABLE programs DROP FOREIGN KEY programs_ibfk_3');
        await db.execute('ALTER TABLE programs DROP FOREIGN KEY programs_ibfk_4');
      } catch (e) {
        // Foreign keys might not exist or have different names
      }

      // Drop the columns
      try {
        await db.execute('ALTER TABLE programs DROP COLUMN zonal_office_id');
      } catch (e) {
        console.log('Could not drop zonal_office_id (might not exist)');
      }
      try {
        await db.execute('ALTER TABLE programs DROP COLUMN district_id');
      } catch (e) {
        console.log('Could not drop district_id (might not exist)');
      }
      
      console.log('Programs schema migration completed successfully');
      needsMigration = true;
    }

    return needsMigration;
  } catch (error) {
    // If table doesn't exist or other error, ignore
    console.log('Migration check completed (no old schema found)');
    return false;
  }
}

// Initialize tables on startup (data comes from Railway MySQL)
async function startDatabase() {
  await initializeTables();
}

startDatabase();

export default db;
