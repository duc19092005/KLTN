#!/bin/sh
set -e

npx hardhat node --hostname 0.0.0.0 &
NODE_PID=$!

echo "Waiting for local Hardhat JSON-RPC..."
sleep 4

echo "Deploying IdentityRegistry to local Hardhat node..."
npx hardhat run scripts/deploy.js --network localhost

echo "IdentityRegistry deployed. Hardhat node is ready."
wait "$NODE_PID"
