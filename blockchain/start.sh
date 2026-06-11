#!/bin/sh
set -eu

npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

cleanup() {
  kill "$NODE_PID" 2>/dev/null || true
}
trap cleanup INT TERM

echo "Waiting for local Hardhat JSON-RPC..."
until wget -qO- http://127.0.0.1:8545 >/dev/null 2>&1; do
  if ! kill -0 "$NODE_PID" 2>/dev/null; then
    echo "Hardhat node exited before becoming ready."
    wait "$NODE_PID"
    exit 1
  fi
  sleep 1
done

echo "Deploying IdentityRegistry to local Hardhat node..."
npx hardhat run scripts/deploy.js --network localhost

echo "IdentityRegistry deployed. Hardhat node is ready."
wait "$NODE_PID"
