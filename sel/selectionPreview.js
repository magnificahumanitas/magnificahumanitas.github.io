// Transient selection highlight for a Range with NO DOM mutation of the text.
// Primary: CSS Custom Highlight API. Fallback: position:fixed overlay rects from
// getClientRects() — viewport coords, NO scrollTop (unlike the buggy ShareTooltip).
const HL_NAME = 'mh-pending'
const PREVIEW_BG = 'rgba(139,35,50,0.22)'

let styleInjected = false
function ensureHighlightStyle() {
  if (styleInjected) return
  styleInjected = true
  const s = document.createElement('style')
  s.textContent = `::highlight(${HL_NAME}) { background-color: ${PREVIEW_BG}; }`
  document.head.appendChild(s)
}

export function createSelectionPreview() {
  let layer = null
  let activeRange = null

  const supportsHighlight = () =>
    typeof CSS !== 'undefined' && CSS.highlights && typeof Highlight !== 'undefined'

  function renderOverlay(range) {
    if (!layer) {
      layer = document.createElement('div')
      layer.setAttribute('data-mh-preview', '')
      layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:550;'
      document.body.appendChild(layer)
    }
    layer.innerHTML = ''
    for (const r of range.getClientRects()) {
      const cell = document.createElement('div')
      cell.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;background:${PREVIEW_BG};border-radius:2px;`
      layer.appendChild(cell)
    }
  }

  const onScrollResize = () => { if (activeRange) renderOverlay(activeRange) }

  function set(range) {
    activeRange = range
    if (supportsHighlight()) {
      ensureHighlightStyle()
      CSS.highlights.set(HL_NAME, new Highlight(range))
      return
    }
    renderOverlay(range)
    const sc = document.getElementById('scroll-container')
    sc && sc.addEventListener('scroll', onScrollResize, { passive: true })
    window.addEventListener('resize', onScrollResize)
  }

  function clear() {
    activeRange = null
    if (supportsHighlight()) { try { CSS.highlights.delete(HL_NAME) } catch {} }
    if (layer) { layer.remove(); layer = null }
    const sc = document.getElementById('scroll-container')
    sc && sc.removeEventListener('scroll', onScrollResize)
    window.removeEventListener('resize', onScrollResize)
  }

  return { set, clear }
}
