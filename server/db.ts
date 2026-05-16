import mysql from 'mysql2/promise';

// Create MySQL connection pool - Railway only
const db = mysql.createPool({
  uri: process.env.DATABASE_URL || 'mysql://root:VScBmggdqxGquzWJcTfNsCHckAgdQdIW@ballast.proxy.rlwy.net:33826/railway',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Initialize tables
async function initializeTables() {
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS officers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(255) UNIQUE,
        password VARCHAR(255),
        name VARCHAR(255),
        district VARCHAR(100),
        range_office VARCHAR(100),
        phone VARCHAR(50),
        role ENUM('officer', 'admin') DEFAULT 'officer'
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS programs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        program_type ENUM('school', 'community', 'ngo', 'planting', 'home_garden'),
        officer_id INT,
        date DATE,
        description TEXT,
        latitude DECIMAL(10,6),
        longitude DECIMAL(10,6),
        location_name VARCHAR(255),
        district VARCHAR(100),
        participants INT,
        details JSON,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (officer_id) REFERENCES officers(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
      )
    `);
  } catch (error) {
    console.error('Error initializing tables:', error);
  }
}

// Seed data if empty
async function seedData() {
  try {
    const [rows] = await db.execute('SELECT COUNT(*) as count FROM officers');
    const result = rows as any[];
    
    if (result[0].count === 0) {
      // Admin
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['admin', 'admin123', 'Headquarters Admin', 'Colombo', 'HQ', '0112345678', 'admin']);

      // Officers
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer1', 'pass123', 'Saman Perera', 'Kandy', 'Ududumbara', '0771234567', 'officer']);
      
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer2', 'pass123', 'Kamal Silva', 'Anuradhapura', 'Mihintale', '0719876543', 'officer']);
      
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer3', 'pass123', 'Nimali Fernando', 'Galle', 'Kanneliya', '0765554444', 'officer']);
      
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer4', 'pass123', 'Sunil Perera', 'Gampaha', 'Kadawala', '0777777777', 'officer']);
      
      // Islandwide Officer (Generic Account for 170 officers)
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer', 'officer123', 'Extension Officer', 'Islandwide', 'General', '0000000000', 'officer']);

      // Seed some programs
      await db.execute(`
        INSERT INTO programs (program_type, officer_id, date, description, latitude, longitude, location_name, district, participants, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['school', 2, '2023-10-15', 'Awareness on forest conservation', 7.2906, 80.6337, 'Dharmaraja College', 'Kandy', 150, JSON.stringify({ school_name: 'Dharmaraja College', district: 'Kandy' })]);

      await db.execute(`
        INSERT INTO programs (program_type, officer_id, date, description, latitude, longitude, location_name, district, participants, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['home_garden', 4, '2023-11-05', 'Distributed fruit plants', 7.0000, 79.9500, 'Kadawala Village', 'Gampaha', 20, JSON.stringify({ household: 'Jayasinghe Family' })]);

      await db.execute(`
        INSERT INTO programs (program_type, officer_id, date, description, latitude, longitude, location_name, district, participants, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, ['planting', 3, '2023-10-20', 'Teak planting project', 8.3114, 80.4037, 'Mihintale Reserve', 'Anuradhapura', 50, JSON.stringify({ tree_species: 'Teak', number_planted: 200, area_size: '2 acres' })]);
    }
  } catch (error) {
    console.error('Error seeding database:', error);
  }
}

// Ensure the 'officer' user exists (for updates to existing DBs)
async function ensureOfficerExists() {
  try {
    const [rows] = await db.execute('SELECT id FROM officers WHERE username = ?', ['officer']);
    const result = rows as any[];
    
    if (result.length === 0) {
      await db.execute(`
        INSERT INTO officers (username, password, name, district, range_office, phone, role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['officer', 'officer123', 'Extension Officer', 'Islandwide', 'General', '0000000000', 'officer']);
    }
  } catch (error) {
    console.error('Error ensuring officer exists:', error);
  }
}

// Initialize tables and seed data on startup
initializeTables();
setTimeout(seedData, 1000);
setTimeout(ensureOfficerExists, 2000);

export default db;
