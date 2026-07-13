import * as pdfjsLib from "./libs/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "libs/pdf.worker.min.mjs",
);

const statusEl = document.getElementById("status");
const containerEl = document.getElementById("pdf-container");

const SCALE = 1.4;

const LINE_TOLERANCE_RATIO = 0.55;

const SPACE_GAP_RATIO = 0.18;

let sentences = [];
let currentSentenceIndex = -1;

let highlightEls = [];

function getPdfUrlFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get("file");
  return file ? decodeURIComponent(file) : null;
}

function sortLineAware(indices, items) {
  const byTop = [...indices].sort((a, b) => items[a].top - items[b].top);

  const lines = [];
  let currentLine = [];
  let currentTop = null;

  for (const idx of byTop) {
    const g = items[idx];
    if (
      currentTop === null ||
      Math.abs(g.top - currentTop) <= LINE_TOLERANCE_RATIO * g.fontHeight
    ) {
      currentLine.push(idx);
      currentTop = currentTop === null ? g.top : (currentTop + g.top) / 2;
    } else {
      lines.push(currentLine);
      currentLine = [idx];
      currentTop = g.top;
    }
  }
  if (currentLine.length) lines.push(currentLine);

  const result = [];
  for (const line of lines) {
    line.sort((a, b) => items[a].left - items[b].left);
    result.push(...line);
  }
  return result;
}

function computeReadingOrder(items, pageWidth) {
  const indices = items.map((_, i) => i);
  if (items.length < 20) return sortLineAware(indices, items);

  const mid = pageWidth / 2;
  let crossing = 0;
  for (const it of items) {
    if (it.left < mid && it.left + it.width > mid) crossing++;
  }
  const crossRatio = crossing / items.length;

  if (crossRatio >= 0.08) {
    return sortLineAware(indices, items);
  }

  const colLeft = indices.filter(
    (i) => items[i].left + items[i].width / 2 < mid,
  );
  const colRight = indices.filter(
    (i) => items[i].left + items[i].width / 2 >= mid,
  );
  return [...sortLineAware(colLeft, items), ...sortLineAware(colRight, items)];
}

async function renderPage(pdfDoc, pageNumber, globalText) {
  const page = await pdfDoc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: SCALE });

  const pageDiv = document.createElement("div");
  pageDiv.className = "page";
  pageDiv.style.width = `${viewport.width}px`;
  pageDiv.style.height = `${viewport.height}px`;

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  pageDiv.appendChild(canvas);

  const textLayerDiv = document.createElement("div");
  textLayerDiv.className = "text-layer";
  textLayerDiv.style.width = `${viewport.width}px`;
  textLayerDiv.style.height = `${viewport.height}px`;
  pageDiv.appendChild(textLayerDiv);

  containerEl.appendChild(pageDiv);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const textContent = await page.getTextContent();

  const glyphItems = [];
  for (const item of textContent.items) {
    if (!item.str) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const angle = Math.atan2(tx[1], tx[0]);
    const fontHeight = Math.hypot(tx[2], tx[3]);

    const span = document.createElement("span");
    span.textContent = item.str;
    span.style.left = `${tx[4]}px`;
    span.style.top = `${tx[5] - fontHeight}px`;
    span.style.fontSize = `${fontHeight}px`;
    span.style.fontFamily = "sans-serif";
    if (angle !== 0) {
      span.style.transform = `rotate(${angle}rad)`;
    }
    textLayerDiv.appendChild(span);

    glyphItems.push({
      str: item.str,
      left: tx[4],
      top: tx[5] - fontHeight,
      fontHeight,
      span,
    });
  }

  for (const g of glyphItems) {
    g.width = g.span.offsetWidth || g.fontHeight * g.str.length * 0.55;
    g.height = g.span.offsetHeight || g.fontHeight * 1.2;
  }

  const order = computeReadingOrder(glyphItems, viewport.width);

  let prev = null;
  for (const idx of order) {
    const g = glyphItems[idx];

    if (prev) {
      const sameLine =
        Math.abs(g.top - prev.top) <=
        LINE_TOLERANCE_RATIO * Math.max(g.fontHeight, prev.fontHeight);

      if (!sameLine) {
        globalText.text += "\n";
      } else {
        const gap = g.left - (prev.left + prev.width);
        if (gap > SPACE_GAP_RATIO * g.fontHeight) {
          globalText.text += " ";
        }
      }
    }

    const startOffset = globalText.text.length;
    globalText.text += g.str;
    const endOffset = globalText.text.length;

    globalText.entries.push({
      startOffset,
      endOffset,
      left: g.left,
      top: g.top,
      width: g.width,
      height: g.height,
      pageDiv,
    });

    prev = g;
  }

  globalText.text += "\n\n";
}

function buildSentences(globalText) {
  const { text, entries } = globalText;

  const segmenter = new Intl.Segmenter(undefined, { granularity: "sentence" });

  const result = [];
  for (const { segment, index } of segmenter.segment(text)) {
    const trimmed = segment.trim();
    if (!trimmed) continue;

    const start = index;
    const end = index + segment.length;

    const rects = [];
    for (const e of entries) {
      if (e.endOffset <= start || e.startOffset >= end) continue;

      const itemLen = e.endOffset - e.startOffset;
      if (itemLen <= 0) continue;

      const overlapStart = Math.max(start, e.startOffset);
      const overlapEnd = Math.min(end, e.endOffset);
      const fracStart = (overlapStart - e.startOffset) / itemLen;
      const fracEnd = (overlapEnd - e.startOffset) / itemLen;

      rects.push({
        left: e.left + e.width * fracStart,
        top: e.top,
        width: Math.max(1, e.width * (fracEnd - fracStart)),
        height: e.height,
        pageDiv: e.pageDiv,
      });
    }

    if (rects.length > 0) {
      result.push({ rects, text: trimmed });
    }
  }
  return result;
}

function clearHighlight() {
  for (const el of highlightEls) el.remove();
  highlightEls = [];
}

function highlightSentence(index) {
  if (sentences.length === 0) return;
  clearHighlight();

  currentSentenceIndex =
    ((index % sentences.length) + sentences.length) % sentences.length;

  const current = sentences[currentSentenceIndex];
  for (const r of current.rects) {
    const box = document.createElement("div");
    box.className = "sentence-highlight-box";
    box.style.left = `${r.left}px`;
    box.style.top = `${r.top}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
    r.pageDiv.appendChild(box);
    highlightEls.push(box);
  }

  highlightEls[0].scrollIntoView({ block: "center", behavior: "smooth" });

  statusEl.textContent = `წინადადება ${currentSentenceIndex + 1} / ${sentences.length}`;
}

function setupKeyboardNavigation() {
  containerEl.addEventListener("keydown", (event) => {
    if (event.key !== "Tab") return;
    event.preventDefault();

    if (event.shiftKey) {
      highlightSentence(currentSentenceIndex - 1);
    } else {
      highlightSentence(currentSentenceIndex + 1);
    }
  });

  containerEl.focus();
}

async function main() {
  const pdfUrl = getPdfUrlFromQuery();
  if (!pdfUrl) {
    statusEl.textContent =
      "PDF ფაილი არ არის მითითებული. გახსენი .pdf ფაილი Chrome-ში.";
    return;
  }

  statusEl.textContent = "PDF იტვირთება...";

  try {
    const pdfDoc = await pdfjsLib.getDocument(pdfUrl).promise;
    const globalText = { text: "", entries: [] };

    for (let pageNumber = 1; pageNumber <= pdfDoc.numPages; pageNumber++) {
      statusEl.textContent = `მუშავდება გვერდი ${pageNumber} / ${pdfDoc.numPages}...`;
      await renderPage(pdfDoc, pageNumber, globalText);
    }

    sentences = buildSentences(globalText);
    setupKeyboardNavigation();

    if (sentences.length > 0) {
      highlightSentence(0);
    } else {
      statusEl.textContent = "ტექსტი ვერ მოიძებნა ამ დოკუმენტში.";
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = `შეცდომა PDF-ის ჩატვირთვისას: ${err.message}`;
  }
}

main();
