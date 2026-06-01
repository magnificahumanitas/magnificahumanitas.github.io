// Coarse pointer ⇒ touch-primary (phones/tablets). Read once and memoize: the primary
// pointer does not change within a session.
let cached
export function isTouchPrimary() {
  if (cached === undefined) {
    try { cached = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches }
    catch { cached = false }
  }
  return cached
}
