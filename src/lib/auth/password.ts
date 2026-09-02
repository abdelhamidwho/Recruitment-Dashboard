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

// Node's own `scrypt` already refuses to run when the requested parameters
// would exceed its default 32MB `maxmem` (memory usage is roughly
// 128 * N * r bytes), so in practice that check is the first line of
// defence against an absurd stored N/r/p and is what actually stops
// something like N=999999999 before it ever costs real time or memory.
// These bounds are belt-and-braces on top of that: they guard against a
// future call site passing a larger explicit `maxmem`, or a Node/OpenSSL
// change to the default, silently reopening the door. They are not
// currently reachable in this module's own tests (Node's default `maxmem`
// rejects first), which is expected and fine.
//
// INVARIANT: MAX_COST must never be set below any COST value that has ever
// been used to produce a live stored hash. Lowering it below a value still
// in use would make verifyPassword reject that hash as "implausible" and
// lock out every user whose password was hashed with it — a silent,
// total-outage footgun. Only raise COST going forward; if MAX_COST is ever
// tightened, confirm no stored hash uses a cost above the new ceiling first.
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
    // A stored key of any other length was never produced by hashPassword —
    // reject it outright rather than deriving against whatever length a
    // tampered row happens to carry (e.g. a one-byte key would otherwise be
    // compared against a one-byte derived key and could verify).
    if (expected.length !== KEY_LENGTH) return false

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
