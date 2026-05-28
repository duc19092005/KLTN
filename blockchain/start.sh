#!/bin/sh

if [ ! -d "node_modules" ]; then
  npm install
fi

# Start Hardhat local node in background
npx hardhat node > hardhat_node.log 2>&1 &
NODE_PID=$!

# Wait for node to be ready
echo "Waiting for Hardhat node to start..."
sleep 5

echo "Deploying IdentityRegistry..."
npx hardhat ignition deploy ./ignition/modules/IdentityRegistry.ts --network localhost

echo "Blockchain node is running!"
tail -f hardhat_node.log
