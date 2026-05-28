import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const IdentityRegistryModule = buildModule("IdentityRegistryModule", (m) => {
  const identityRegistry = m.contract("IdentityRegistry", []);

  return { identityRegistry };
});

export default IdentityRegistryModule;
