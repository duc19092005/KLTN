const { Client } = require('pg');

const passwords = [
  'YourPassword123!',
  'change-me-local-only',
  'postgres',
  'admin',
  '123456',
  'root',
  '19092005'
];

async function main() {
  console.log('🔍 Testing PostgreSQL passwords on localhost:5432...\n');
  
  for (const pass of passwords) {
    const client = new Client({
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: pass,
      port: 5432,
    });
    try {
      await client.connect();
      console.log(`🎉 SUCCESS! Correct password is: "${pass}"`);
      await client.end();
      return;
    } catch (err) {
      console.log(`❌ Failed password: "${pass}" -> ${err.message}`);
    }
  }
}

main();
