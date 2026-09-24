/**
 * Anonymous browser scoping key for durable showcase cases (spec 0002).
 *
 * A random lowercase version 4 UUID kept in localStorage. It scopes which cases
 * this browser can read; it is not authentication. The Radar iframe is served
 * from the same origin without a `sandbox` attribute, so it shares this key.
 * When storage is blocked or `crypto.randomUUID` is unavailable (outside a
 * secure context), there is no key: runs still work, they are just not saved.
 */

const STORAGE_KEY = "showcase-browser-id"
const BROWSER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

export const SHOWCASE_BROWSER_ID_HEADER = "X-Showcase-Browser-Id"

/** Return this browser's key, creating it once, or null when unavailable. */
export function getShowcaseBrowserId(): string | null {
  try {
    const existing = window.localStorage.getItem(STORAGE_KEY)
    if (existing && BROWSER_ID.test(existing)) return existing
    if (typeof globalThis.crypto?.randomUUID !== "function") return null
    const created = globalThis.crypto.randomUUID()
    window.localStorage.setItem(STORAGE_KEY, created)
    return created
  } catch {
    // Private mode, blocked site data, or a sandboxed frame: no durable key.
    return null
  }
}

/** Return the header that scopes a request to this browser's cases, if any. */
export function showcaseBrowserHeaders(): Record<string, string> {
  const browserId = getShowcaseBrowserId()
  return browserId ? { [SHOWCASE_BROWSER_ID_HEADER]: browserId } : {}
}
