// Word-granular touch selection — framework-agnostic DOM controller. No React import, so
// it is usable from a plain-browser test fixture. The React hook lives in touchSelection.js.
//
// iOS NOTE: the reading text is `user-select:none` (to kill the system selection menu), and
// iOS Safari REFUSES to hit-test non-selectable text with caretRangeFromPoint — it returns a
// caret in some *other* selectable element instead. So we resolve the touch point to a text
// offset ourselves with elementFromPoint + a per-character rect map (both work regardless of
// user-select). caretRangeFromPoint is kept only as a fast path, accepted ONLY when it lands
// inside the touched paragraph (true on Android/desktop, false on iOS-under-user-select:none).
import { expandToWord } from './wordBoundary.js'
import { getRangeInfo } from './selection.js'
import { createSelectionPreview } from './selectionPreview.js'

const LONG_PRESS_MS = 400
const MOVE_CANCEL_PX = 20        // raised from 10: a resting finger jitters ~12–15px on iOS
const SKIP_SELECTOR = '[style*="background-color"], [data-no-select]'

export function paragraphAtPoint(x, y) {
  const el = document.elementFromPoint(x, y)
  return el && el.closest ? el.closest('[data-paragraph-idx]') : null
}

// Per-character rect map for a paragraph's selectable text. Independent of user-select.
export function buildCharMap(para) {
  const map = []
  const walker = document.createTreeWalker(para, NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement && node.parentElement.closest('[data-no-select]')) continue
    const len = node.textContent.length
    for (let i = 0; i < len; i++) {
      range.setStart(node, i); range.setEnd(node, i + 1)
      const r = range.getBoundingClientRect()
      if (r.width || r.height) map.push({ node, offset: i, left: r.left, right: r.right, top: r.top, bottom: r.bottom })
    }
  }
  return map
}

// Nearest character to (x,y) in the map: exact hit if inside a char rect, else the nearest
// char on the same visual line (so dragging past the line end snaps to the last word).
export function charAtPointInMap(map, x, y) {
  let best = null, bestDist = Infinity
  for (const c of map) {
    if (y >= c.top && y <= c.bottom) {
      if (x >= c.left && x <= c.right) return c
      const dist = x < c.left ? c.left - x : x - c.right
      if (dist < bestDist) { bestDist = dist; best = c }
    }
  }
  return best
}

// Resolve a point to { node, offset } within `para`, robust under user-select:none.
export function caretInfoFromMap(x, y, para, map) {
  if (document.caretRangeFromPoint) {
    const r = document.caretRangeFromPoint(x, y)
    if (r && r.startContainer.nodeType === 3) {
      const cp = r.startContainer.parentElement && r.startContainer.parentElement.closest('[data-paragraph-idx]')
      if (cp === para) return { node: r.startContainer, offset: r.startOffset } // fast path (Android/desktop)
    }
  }
  const c = charAtPointInMap(map, x, y) // iOS / user-select:none path
  return c ? { node: c.node, offset: c.offset } : null
}

export function wordRangeFromCaret(node, offset) {
  const { start, end } = expandToWord(node.textContent, offset)
  if (end <= start) return null
  const r = document.createRange(); r.setStart(node, start); r.setEnd(node, end); return r
}

// Order-independent span covering both word ranges.
export function orderedRange(a, b) {
  const aFirst = a.compareBoundaryPoints(Range.START_TO_START, b) <= 0
  const startR = aFirst ? a : b, endR = aFirst ? b : a
  const r = document.createRange()
  r.setStart(startR.startContainer, startR.startOffset)
  r.setEnd(endR.endContainer, endR.endOffset)
  return r
}

function shouldSkip(target) {
  const el = target && (target.nodeType === Node.TEXT_NODE ? target.parentElement : target)
  return !el || !el.closest || !!el.closest(SKIP_SELECTOR)
}

// Attach the gesture controller to `document`. Returns a detach function.
export function attachTouchWordSelection() {
  const preview = createSelectionPreview()
  let phase = 'idle'              // idle | pressing | selecting
  let timer = null
  let startX = 0, startY = 0
  let para = null, charMap = null
  let anchorRange = null, currentRange = null

  const reset = () => {
    if (timer) { clearTimeout(timer); timer = null }
    phase = 'idle'; para = null; charMap = null; anchorRange = null; currentRange = null
  }

  const onTouchStart = (e) => {
    const tch = e.touches[0]; if (!tch) return
    if (shouldSkip(e.target)) return       // highlight / number / footnote spans keep native tap
    preview.clear()                        // clear any prior preview on a new interaction
    startX = tch.clientX; startY = tch.clientY
    phase = 'pressing'
    timer = setTimeout(() => {
      if (phase !== 'pressing') return
      para = paragraphAtPoint(startX, startY)
      if (!para) { reset(); return }       // not on a paragraph → no selection
      charMap = buildCharMap(para)         // built once; scroll is locked while selecting, so it stays valid
      const c = caretInfoFromMap(startX, startY, para, charMap)
      if (!c) { reset(); return }
      const wr = wordRangeFromCaret(c.node, c.offset)
      if (!wr) { reset(); return }
      phase = 'selecting'; anchorRange = wr; currentRange = wr
      preview.set(wr)
      if (e.cancelable) e.preventDefault()  // suppress iOS magnifier
    }, LONG_PRESS_MS)
  }

  const onTouchMove = (e) => {
    const tch = e.touches[0]; if (!tch) return
    if (phase === 'pressing') {
      if (Math.hypot(tch.clientX - startX, tch.clientY - startY) > MOVE_CANCEL_PX) reset() // it's a scroll
      return
    }
    if (phase !== 'selecting') return
    if (e.cancelable) e.preventDefault()    // lock scroll while selecting (needs passive:false)
    const c = caretInfoFromMap(tch.clientX, tch.clientY, para, charMap)
    if (!c) return
    const wr = wordRangeFromCaret(c.node, c.offset)
    if (!wr) return
    currentRange = orderedRange(anchorRange, wr)
    preview.set(currentRange)
  }

  const onTouchEnd = () => {
    if (phase === 'selecting' && currentRange) {
      const info = getRangeInfo(currentRange)
      if (info) document.dispatchEvent(new CustomEvent('annotation-create', { detail: { info } }))
      else preview.clear()
    } else {
      preview.clear()
    }
    reset()
  }

  const onClearPreview = () => preview.clear()

  const opts = { passive: false }
  document.addEventListener('touchstart', onTouchStart, opts)
  document.addEventListener('touchmove', onTouchMove, opts)
  document.addEventListener('touchend', onTouchEnd)          // may stay passive
  document.addEventListener('annotation-clear-preview', onClearPreview)
  return () => {
    document.removeEventListener('touchstart', onTouchStart, opts)
    document.removeEventListener('touchmove', onTouchMove, opts)
    document.removeEventListener('touchend', onTouchEnd)
    document.removeEventListener('annotation-clear-preview', onClearPreview)
    preview.clear()
    if (timer) clearTimeout(timer)
  }
}
