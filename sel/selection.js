function findParagraph(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && el !== document.body) {
    if (el.tagName === 'P' && el.hasAttribute('data-paragraph-idx')) return el
    el = el.parentElement
  }
  return null
}

function isInsideNumberSpan(node) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && el.tagName !== 'P') {
    if (el.style && el.style.userSelect === 'none') return true
    el = el.parentElement
  }
  return false
}

function getTextOffset(paragraphEl, targetNode, targetOffset) {
  let offset = 0
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement.style && node.parentElement.style.userSelect === 'none') continue
    if (node === targetNode) return offset + targetOffset
    offset += node.textContent.length
  }
  return offset
}

function getParagraphTextLength(paragraphEl) {
  let len = 0
  const walker = document.createTreeWalker(paragraphEl, NodeFilter.SHOW_TEXT)
  let node
  while ((node = walker.nextNode())) {
    if (node.parentElement.style && node.parentElement.style.userSelect === 'none') continue
    len += node.textContent.length
  }
  return len
}

// Compute annotation info from a DOM Range. Single source of truth for BOTH the native
// selection path and the custom touch path. The 5-char minimum and number-span/paragraph
// rejection live HERE only.
export function getRangeInfo(range) {
  if (!range) return null
  const selectedText = range.toString().trim()
  if (selectedText.length < 5) return null

  if (isInsideNumberSpan(range.startContainer)) return null

  const para = findParagraph(range.startContainer)
  if (!para) return null

  const paragraphIdx = parseInt(para.getAttribute('data-paragraph-idx'), 10)
  const startOffset = getTextOffset(para, range.startContainer, range.startOffset)
  const maxLen = getParagraphTextLength(para)

  let endOffset
  const endPara = findParagraph(range.endContainer)
  if (!endPara || endPara !== para) {
    endOffset = maxLen
  } else {
    endOffset = getTextOffset(para, range.endContainer, range.endOffset)
  }

  endOffset = Math.min(endOffset, maxLen)

  return { paragraphIdx, startOffset, endOffset, selectedText, rect: range.getBoundingClientRect() }
}

export function getSelectionInfo() {
  const sel = window.getSelection()
  return sel && sel.rangeCount ? getRangeInfo(sel.getRangeAt(0)) : null
}
