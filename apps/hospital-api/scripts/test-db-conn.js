const { Client } = require('pg');

async function testConn(pass, db) {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: db,
    password: pass,
    port: 5432,
  });
  try {
    await client.connect();
    console.log(`✅ Kết nối THÀNH CÔNG! Password: "${pass}", DB: "${db}"`);
    const res = await client.query('SELECT current_database(), current_user;');
    console.log('   Result:', res.rows[0]);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Thất bại! Password: "${pass}", DB: "${db}" -> Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('🔍 Đang kiểm tra kết nối Postgres localhost:5432...\n');
  await testConn('YourPassword123!', 'zkp_identity');
  await testConn('YourPassword123!', 'postgres');
  await testConn('change-me-local-only', 'zkp_identity');
  await testConn('postgres', 'postgres');
}

main();
