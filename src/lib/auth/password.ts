import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'
import { promisify } from 'node:util'

// `scrypt` is overloaded (with and without an options object) in a way
// `util.promisify`'s typings resolve to the wrong overload, so the options
// form is asserted explicitly here.
const scryptAsync = promisify(scrypt) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: ScryptOptions,
) => Promise<Buffer>

const COST = 16384 // N — CPU/memory cost factor
const BLOCK_SIZE = 8 // r — block size
const PARALLELISM = 1 // p — parallelization factor
const KEY_LENGTH = 64

// scrypt's memory usage is roughly 128 * N * r bytes. Cap N so a malicious or
// corrupted stored value can never make verifyPassword allocate an
// unreasonable amount of memory or block the event loop for an unreasonable
// time. The cost this module writes (16384) is comfortably under this.
const MAX_COST = 1 << 20 // 1,048,576
const MAX_BLOCK_SIZE = 1024
const MAX_PARALLELISM = 16

/**
 * Stored hash format: `scrypt$N$r$p$salt$key`, six `$`-separated fields:
 *   1. `scrypt`  — the KDF identifier, so the format can be extended later
 *   2. `N`       — CPU/memory cost factor used to produce this hash
 *   3. `r`       — block size used to produce this hash
 *   4. `p`       — parallelization factor used to produce this hash
 *   5. `salt`    — random per-password salt, base64
 *   6. `key`     — derived key, base64
 * Packing the parameters alongside the salt and hash means the cost can be
 * raised for new passwords later without invalidating hashes already stored
 * with the old parameters.
 */

/**
 * Hashes `password` with scrypt using a fresh random salt.
 * Returns the packed `scrypt$N$r$p$salt$key` string described above.
 * Rejects if `password` is empty. Never throws for a valid non-empty input,
 * though an extremely long password will take proportionally longer.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error('password must not be empty')
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, KEY_LENGTH, {
    N: COST,
    r: BLOCK_SIZE,
    p: PARALLELISM,
  })
  return [
    'scrypt',
    COST,
    BLOCK_SIZE,
    PARALLELISM,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$')
}

/**
 * Verifies `password` against a `stored` hash produced by `hashPassword`.
 * Always resolves to a boolean — never throws or rejects, even when
 * `stored` is empty, malformed, has non-numeric or implausible parameters,
 * or isn't a string at all — so a corrupted database row can never crash a
 * caller such as a login route. Uses `timingSafeEqual` to compare the
 * derived key against the stored one.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!password || !stored || typeof stored !== 'string') return false

  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, costRaw, blockRaw, parallelRaw, saltRaw, keyRaw] = parts
  const cost = Number(costRaw)
  const blockSize = Number(blockRaw)
  const parallelism = Number(parallelRaw)
  if (!Number.isInteger(cost) || !Number.isInteger(blockSize) || !Number.isInteger(parallelism)) {
    return false
  }
  if (cost <= 0 || blockSize <= 0 || parallelism <= 0) return false
  if (cost > MAX_COST || blockSize > MAX_BLOCK_SIZE || parallelism > MAX_PARALLELISM) return false

  try {
    const salt = Buffer.from(saltRaw, 'base64')
    const expected = Buffer.from(keyRaw, 'base64')
    if (salt.length === 0 || expected.length === 0) return false

    const actual = await scryptAsync(password, salt, expected.length, {
      N: cost,
      r: blockSize,
      p: parallelism,
    })

    return actual.length === expected.length && timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}
