import { argon2id, argon2Verify } from 'hash-wasm';

/**
 * Track: offline-first architecture, offline PIN authentication
 * (docs/superpowers/specs/2026-07-11-platform-roadmap-design.md).
 *
 * RFC 9106's second recommended parameter set (for constrained/interactive
 * environments): 19 MiB memory, 2 iterations, 1 lane. Chosen over the
 * primary recommendation (2 GiB) because this needs to complete quickly
 * enough on a terminal that could be modest hardware, while still being
 * genuinely expensive to brute-force offline if a device's local cache is
 * ever extracted -- the entire point of hashing the PIN at all instead of
 * comparing it in plaintext.
 *
 * Uses hash-wasm rather than the argon2id npm package: the latter's WASM
 * loader requires a caller-supplied {env: {memory}} imports object at
 * instantiation time, which is incompatible with vite-plugin-wasm's
 * auto-instantiation mode (already active in this project for PowerSync's
 * wa-sqlite) -- the build failed with "Rollup failed to resolve import
 * env". hash-wasm inlines its WASM binaries as base64 strings decoded at
 * runtime, sidestepping ES-module WASM imports (and this whole class of
 * bundler incompatibility) entirely.
 *
 * "Encoded" output format (PHC string, e.g. "$argon2id$v=19$m=...,t=...,
 * p=...$<salt>$<hash>") is self-describing -- salt and parameters travel
 * with the hash, so only one string needs to be cached per employee, and
 * argon2Verify() handles the comparison internally rather than needing a
 * hand-rolled constant-time comparison here.
 */
const MEMORY_SIZE_KIB = 19456; // 19 MiB
const ITERATIONS = 2;
const PARALLELISM = 1;
const HASH_LENGTH = 32; // 256-bit output
const SALT_LENGTH = 16;

/** Hashes a PIN with a freshly-generated random salt, embedded in the returned encoded string. */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return argon2id({
    password: pin,
    salt,
    iterations: ITERATIONS,
    parallelism: PARALLELISM,
    memorySize: MEMORY_SIZE_KIB,
    hashLength: HASH_LENGTH,
    outputType: 'encoded',
  });
}

export async function verifyPin(pin: string, encodedHash: string): Promise<boolean> {
  return argon2Verify({ password: pin, hash: encodedHash });
}
