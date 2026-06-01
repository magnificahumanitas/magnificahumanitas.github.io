// Transient selection highlight for a Range. Renders an overlay of translucent rects over
// the selection's getClientRects() — a separate position:fixed layer, NO mutation of the
// text and NO dependency on the CSS Custom Highlight API (which iOS Safari refuses to paint
// over user-select:none text, the exact case here). Rects are viewport-relative and used
// directly with NO scrollTop offset.
const PREVIEW_BG = 'rgba(139,35,50,0.28)'
const Z = 500 // above the reading text, below the popover (z-index 600)

export function createSelectionPreview() {
  let layer = null
  let activeRange = null

  function ensureLayer() {
    if (layer) return
    layer = document.createElement('div')
    layer.setAttribute('data-mh-preview', '')
    layer.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;pointer-events:none;z-index:' + Z + ';'
    document.body.appendChild(layer)
  }

  function render(range) {
    ensureLayer()
    layer.innerHTML = ''
    const rects = range.getClientRects()
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i]
      if (!r.width && !r.height) continue
      const cell = document.createElement('div')
      cell.style.cssText = 'position:fixed;left:' + r.left + 'px;top:' + r.top + 'px;width:' + r.width +
        'px;height:' + r.height + 'px;background:' + PREVIEW_BG + ';border-radius:2px;pointer-events:none;'
      layer.appendChild(cell)
    }
  }

  const onScrollResize = () => { if (activeRange) render(activeRange) }

  function set(range) {
    activeRange = range
    render(range)
    const sc = document.getElementById('scroll-container')
    if (sc) sc.addEventListener('scroll', onScrollResize, { passive: true })
    window.addEventListener('scroll', onScrollResize, { passive: true })
    window.addEventListener('resize', onScrollResize)
  }

  function clear() {
    activeRange = null
    if (layer) { layer.remove(); layer = null }
    const sc = document.getElementById('scroll-container')
    if (sc) sc.removeEventListener('scroll', onScrollResize)
    window.removeEventListener('scroll', onScrollResize)
    window.removeEventListener('resize', onScrollResize)
  }

  return { set, clear }
}
