pragma circom 2.1.5;

include "../node_modules/circomlib/circuits/poseidon.circom";

/*
 * IdentityVerifier Circuit
 * 
 * Proves: "I know (secret, faceHash) such that Poseidon(secret, faceHash) == commitment"
 * without revealing secret or faceHash.
 *
 * Inputs:
 *   - secret (private): User's secret key, generated during registration
 *   - faceHash (private): Hash of user's face embedding
 *   - commitment (public): Stored on-chain, equals Poseidon(secret, faceHash)
 *
 * Use cases:
 *   - Wallet recovery: prove identity to update wallet address on-chain
 *   - Identity verification: prove you are who you claim without revealing biometric data
 */
template IdentityVerifier() {
    // Private inputs - known only to the prover
    signal input secret;
    signal input faceHash;

    // Public input - stored on-chain
    signal input commitment;

    // Compute Poseidon hash of (secret, faceHash)
    component hasher = Poseidon(2);
    hasher.inputs[0] <== secret;
    hasher.inputs[1] <== faceHash;

    // Constraint: the hash must equal the public commitment
    commitment === hasher.out;
}

component main {public [commitment]} = IdentityVerifier();
