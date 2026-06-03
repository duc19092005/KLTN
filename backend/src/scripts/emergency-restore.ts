import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { ethers } from 'ethers';
import 'dotenv/config';

// ABI for IdentityRegistry to check admin rights
const IDENTITY_REGISTRY_ABI = [
  'function owner() view returns (address)',
  'function isAuthorized(address wallet) view returns (bool)'
];

// Configurable constants
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://localhost:8545';
const REGISTRY_ADDRESS = process.env.IDENTITY_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const DB_CONTAINER_NAME = 'admin-auth-postgres';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

// Extract database details from DATABASE_URL
function getDbConfig() {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:change-me-local-only@localhost:5432/hospital_db';
  try {
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
    if (!match) throw new Error('Invalid DATABASE_URL format');
    return {
      user: match[1],
      password: match[2],
      host: match[3],
      port: match[4],
      database: match[5]
    };
  } catch (err) {
    console.warn('⚠️ Could not parse DATABASE_URL, using defaults: postgres, hospital_db');
    return {
      user: 'postgres',
      password: 'change-me-local-only',
      host: 'localhost',
      port: '5432',
      database: 'hospital_db'
    };
  }
}

async function main() {
  console.log('\n======================================================');
  console.log('🔒 HỆ THỐNG KHÔI PHỤC DATABASE KHẨN CẤP (EMERGENCY RESTORE)');
  console.log('======================================================\n');

  // 1. Get and check backup file
  const backupFileArg = process.argv[2];
  if (!backupFileArg) {
    console.error('❌ Lỗi: Vui lòng cung cấp đường dẫn tới file backup.');
    console.error('Sử dụng: npm run db:emergency-restore <path_to_backup_file>');
    process.exit(1);
  }

  const backupFilePath = path.resolve(backupFileArg);
  if (!fs.existsSync(backupFilePath)) {
    console.error(`❌ Lỗi: Không tìm thấy file backup tại: ${backupFilePath}`);
    process.exit(1);
  }

  console.log(`📂 File backup hợp lệ: ${backupFilePath}`);
  console.log(`🔌 Kết nối Node Blockchain RPC: ${RPC_URL}`);
  console.log(`🛡️ Contract IdentityRegistry: ${REGISTRY_ADDRESS}\n`);

  // 2. Generate cryptographically random challenge string with Timestamp
  const randomHex = ethers.hexlify(ethers.randomBytes(16));
  const timestamp = Date.now();
  const challenge = `EMERGENCY_DATABASE_RESTORE_CHALLENGE:${randomHex}:${timestamp}`;

  console.log('------------------------------------------------------');
  console.log('Vui lòng sử dụng ví Web3 của Admin ký thông điệp dưới đây:');
  console.log('------------------------------------------------------');
  console.log(`\x1b[36m${challenge}\x1b[0m`);
  console.log('------------------------------------------------------\n');

  // 3. Prompt admin to input the Web3 signature
  const signature = await prompt('Nhập chữ ký số (Signature - dạng Hex bắt đầu bằng 0x): ');
  
  if (!signature.startsWith('0x') || signature.length < 130) {
    console.error('❌ Lỗi: Định dạng chữ ký số không hợp lệ.');
    process.exit(1);
  }

  console.log('\n⏳ Đang xác thực chữ ký và đối chiếu Blockchain...');

  try {
    // 4. Recover signer address from signature and challenge
    const signerAddress = ethers.verifyMessage(challenge, signature);
    console.log(`🔎 Địa chỉ ví phục hồi: ${signerAddress}`);

    // 5. Connect to blockchain and call IdentityRegistry
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const registry = new ethers.Contract(REGISTRY_ADDRESS, IDENTITY_REGISTRY_ABI, provider);

    const ownerAddress = await registry.owner();
    const isAuthorized = await registry.isAuthorized(signerAddress);

    const isSuperadmin = signerAddress.toLowerCase() === ownerAddress.toLowerCase() || isAuthorized;

    if (!isSuperadmin) {
      console.error('❌ Lỗi: Địa chỉ ví này KHÔNG phải Admin tối cao được ủy quyền trên Blockchain!');
      process.exit(1);
    }

    console.log('✅ Xác thực thành công! Quyền Admin Tối Cao được Blockchain phê duyệt.');
    console.log('⚙️ Bắt đầu tiến trình khôi phục cơ sở dữ liệu...\n');

    // 6. Perform the DB restore
    const dbConfig = getDbConfig();
    
    // Command selection: We target the running Docker container or run locally
    let restoreCmd = '';
    try {
      // Check if docker is running the DB container
      execSync(`docker ps -q -f name=${DB_CONTAINER_NAME}`);
      console.log(`🐳 Phát hiện Docker container: ${DB_CONTAINER_NAME}. Tiến hành restore...`);
      
      // Execute restore inside container
      restoreCmd = `docker exec -i ${DB_CONTAINER_NAME} psql -U ${dbConfig.user} -d ${dbConfig.database} < "${backupFilePath}"`;
    } catch {
      console.log('💻 Không phát hiện Docker. Cố gắng chạy restore trực tiếp trên hệ thống...');
      // Execute restore locally
      restoreCmd = `PGPASSWORD="${dbConfig.password}" psql -h localhost -U ${dbConfig.user} -d ${dbConfig.database} -f "${backupFilePath}"`;
    }

    console.log('⏳ Đang nạp dữ liệu...');
    execSync(restoreCmd, { stdio: 'inherit' });

    console.log('\n======================================================');
    console.log('🎉 KHÔI PHỤC DATABASE THÀNH CÔNG!');
    console.log('======================================================\n');

  } catch (err: any) {
    console.error('\n❌ Có lỗi xảy ra trong quá trình khôi phục:');
    console.error(err.message || err);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
