import * as argon2 from 'argon2';

/**
 * Hash a password using Argon2id (memory-hard, GPU-resistant).
 * Argon2id is recommended over bcrypt for new applications.
 */
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iterations
    parallelism: 4,    // 4 threads
  });
}

/**
 * Verify a password against an Argon2id hash.
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/**
 * Check if a hash needs to be rehashed (e.g., after updating Argon2 parameters).
 */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
    parallelism: 4,
  });
}
