/**
 * 轻量级内存缓存，用于缓存代价高的聚合查询结果。
 * TTL 默认 1 小时；缓存 key 支持带参数区分。
 */

const store = new Map(); // key -> { data, expiresAt }

function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
}

function set(key, data, ttlMs = 60 * 60 * 1000) {
  store.set(key, { data, expiresAt: Date.now() + ttlMs });
}

/**
 * 若缓存命中直接返回，否则执行 fn() 并缓存结果。
 * @param {string} key
 * @param {() => Promise<any>} fn
 * @param {number} ttlMs
 */
async function getOrSet(key, fn, ttlMs = 60 * 60 * 1000) {
  const cached = get(key);
  if (cached !== null) return cached;
  const result = await fn();
  set(key, result, ttlMs);
  return result;
}

function invalidate(keyPrefix) {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

module.exports = { get, set, getOrSet, invalidate };
