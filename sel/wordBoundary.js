// Expand a (text, offset) to whole-word [start, end) node-local offsets. Prefer
// Intl.Segmenter (correct word boundaries incl. accents); fall back to a regex scan.

function viaSegmenter(text, offset) {
  if (typeof Intl === 'undefined' || !Intl.Segmenter) return null
  const lang = (typeof navigator !== 'undefined' && navigator.language) || 'en'
  const seg = new Intl.Segmenter(lang, { granularity: 'word' })
  const segments = [...seg.segment(text)] // { segment, index, isWordLike }
  // segment containing offset, or the one ending exactly at offset
  let hit = segments.find(s => offset >= s.index && offset < s.index + s.segment.length)
  if (!hit) hit = [...segments].reverse().find(s => s.index + s.segment.length === offset)
  if (!hit) return null
  if (!hit.isWordLike) {
    // on a space/punctuation: snap to the nearest word-like neighbour
    const idx = segments.indexOf(hit)
    hit = segments.slice(0, idx).reverse().find(s => s.isWordLike) || segments.slice(idx + 1).find(s => s.isWordLike) || hit
  }
  return { start: hit.index, end: hit.index + hit.segment.length }
}

function viaRegex(text, offset) {
  const isWord = (c) => c != null && /[^\s.,;:!?()"'\[\]{}—–-]/.test(c)
  let o = Math.max(0, Math.min(offset, text.length))
  // if offset sits just past the word (on a boundary), step back one
  if (!isWord(text[o]) && isWord(text[o - 1])) o -= 1
  if (!isWord(text[o])) {
    // on whitespace/punct: find nearest word char
    let l = o, r = o
    while (l >= 0 && !isWord(text[l])) l--
    while (r < text.length && !isWord(text[r])) r++
    o = (o - l) <= (r - o) && l >= 0 ? l : r
    if (o < 0 || o >= text.length || !isWord(text[o])) return { start: offset, end: offset }
  }
  let start = o, end = o
  while (start > 0 && isWord(text[start - 1])) start--
  while (end < text.length && isWord(text[end])) end++
  return { start, end }
}

export function expandToWord(text, offset) {
  return viaSegmenter(text, offset) || viaRegex(text, offset)
}
