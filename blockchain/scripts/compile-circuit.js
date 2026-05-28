/**
 * Circuit Compilation Script
 * 
 * Prerequisites:
 *   1. Install circom: https://docs.circom.io/getting-started/installation/
 *      - Requires Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
 *      - git clone https://github.com/iden3/circom.git && cd circom
 *      - cargo build --release && cargo install --path circom
 *   2. npm install (in blockchain directory)
 * 
 * This script automates:
 *   1. Compile circom circuit → R1CS + WASM
 *   2. Download Powers of Tau file
 *   3. Generate zkey (Groth16 trusted setup)
 *   4. Export verification key
 *   5. Export Solidity verifier contract
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const https = require("https");

const CIRCUIT_NAME = "identity";
const CIRCUITS_DIR = path.join(__dirname, "..", "circuits");
const BUILD_DIR = path.join(CIRCUITS_DIR, "build");
const CONTRACTS_DIR = path.join(__dirname, "..", "contracts");
const PTAU_URL = "https://hermez.s3-eu-west-1.amazonaws.com/powersOfTau28_hez_final_12.ptau";
const PTAU_FILE = path.join(BUILD_DIR, "pot12_final.ptau");

function run(cmd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
}

async function downloadPtau() {
  if (fs.existsSync(PTAU_FILE)) {
    console.log("Powers of Tau file already exists, skipping download...");
    return;
  }

  console.log("Downloading Powers of Tau file (pot12)...");
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(PTAU_FILE);
    https.get(PTAU_URL, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        https.get(response.headers.location, (res) => {
          res.pipe(file);
          file.on("finish", () => { file.close(); resolve(); });
        });
      } else {
        response.pipe(file);
        file.on("finish", () => { file.close(); resolve(); });
      }
    }).on("error", reject);
  });
}

async function main() {
  // Create build directory
  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true });
  }

  const circuitPath = path.join(CIRCUITS_DIR, `${CIRCUIT_NAME}.circom`);

  // Step 1: Compile circuit
  console.log("\n=== Step 1: Compiling circuit ===");
  run(`circom ${circuitPath} --r1cs --wasm --sym -o ${BUILD_DIR}`);

  // Step 2: Download Powers of Tau
  console.log("\n=== Step 2: Downloading Powers of Tau ===");
  await downloadPtau();

  // Step 3: Generate zkey (Groth16 setup)
  console.log("\n=== Step 3: Groth16 setup ===");
  const r1csFile = path.join(BUILD_DIR, `${CIRCUIT_NAME}.r1cs`);
  const zkey0 = path.join(BUILD_DIR, `${CIRCUIT_NAME}_0000.zkey`);
  const zkeyFinal = path.join(BUILD_DIR, `${CIRCUIT_NAME}_final.zkey`);

  run(`npx snarkjs groth16 setup ${r1csFile} ${PTAU_FILE} ${zkey0}`);

  // Contribute to ceremony
  run(`npx snarkjs zkey contribute ${zkey0} ${zkeyFinal} --name="ZKP Identity Dev" -v -e="random entropy for dev"`);

  // Step 4: Export verification key
  console.log("\n=== Step 4: Exporting verification key ===");
  const vkeyFile = path.join(BUILD_DIR, "verification_key.json");
  run(`npx snarkjs zkey export verificationkey ${zkeyFinal} ${vkeyFile}`);

  // Step 5: Export Solidity verifier
  console.log("\n=== Step 5: Exporting Solidity verifier ===");
  const verifierPath = path.join(CONTRACTS_DIR, "Groth16Verifier.sol");
  run(`npx snarkjs zkey export solidityverifier ${zkeyFinal} ${verifierPath}`);

  console.log("\n=== Circuit compilation complete! ===");
  console.log(`Circuit WASM: ${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm`);
  console.log(`Final zkey: ${zkeyFinal}`);
  console.log(`Verification key: ${vkeyFile}`);
  console.log(`Solidity verifier: ${verifierPath}`);
  console.log("\nYou can now deploy using: npm run deploy:local");
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
