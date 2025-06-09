const mysql = require('mysql');

// Create a connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'simplelogin'
});

// Connect to MySQL
db.connect(err => {
  if (err) {
    console.error('❌ Database connection failed:', err);
    return;
  }
  
  console.log('✅ Connected to MySQL database.');
  
  // Test database query
  db.query('SHOW TABLES', (err, results) => {
    if (err) {
      console.error('❌ Error querying tables:', err);
      return;
    }
    
    console.log('📋 Tables in the database:');
    console.log(results);
    
    // Check if usercredentials table exists
    const tables = results.map(row => Object.values(row)[0]);
    if (tables.includes('usercredentials')) {
      console.log('✅ usercredentials table exists');
      
      // Check table structure
      db.query('DESCRIBE usercredentials', (err, fields) => {
        if (err) {
          console.error('❌ Error describing table:', err);
          return;
        }
        
        console.log('📋 Table structure:');
        console.log(fields);
        
        // Test the insert query
        const testUser = {
          fullname: 'Test User',
          email: `test${Date.now()}@example.com`,
          password: 'password123'
        };
        
        db.query(
          'INSERT INTO usercredentials (fullname, email, password) VALUES (?, ?, ?)',
          [testUser.fullname, testUser.email, testUser.password],
          (err, result) => {
            if (err) {
              console.error('❌ Test insert failed:', err);
            } else {
              console.log('✅ Test insert successful:', result);
              
              // Clean up the test data
              db.query('DELETE FROM usercredentials WHERE email = ?', [testUser.email], (err) => {
                if (err) {
                  console.error('❌ Failed to clean up test data:', err);
                } else {
                  console.log('✅ Test data cleaned up successfully');
                }
                
                // Close the connection
                db.end();
              });
            }
          }
        );
      });
    } else {
      console.log('❌ usercredentials table does NOT exist');
      
      // Create the table
      console.log('Creating usercredentials table...');
      const createTableSQL = `
        CREATE TABLE usercredentials (
          id INT AUTO_INCREMENT PRIMARY KEY,
          fullname VARCHAR(100) NOT NULL,
          email VARCHAR(100) NOT NULL UNIQUE,
          password VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      
      db.query(createTableSQL, (err) => {
        if (err) {
          console.error('❌ Failed to create table:', err);
        } else {
          console.log('✅ Table created successfully');
        }
        
        // Close the connection
        db.end();
      });
    }
  });
});