# PDF Sentence Navigator

A Chrome extension (Manifest V3) that lets you move through a PDF **one sentence at a time** with the keyboard:

- **Tab** — next sentence
- **Shift + Tab** — previous sentence

The active sentence is highlighted and scrolled into view, and the toolbar shows your position (`Sentence 4 / 37`). Everything runs locally in the browser — the PDF text is never sent anywhere.

*ქართული ვერსია ქვემოთ. / Georgian version below.*

## How it works
Chrome's built-in PDF viewer is rendered by the PDFium plugin, so content scripts can't reach its text. The extension therefore ships its own viewer:

1. A `declarativeNetRequest` dynamic rule in `background.js` redirects any `.pdf` URL (http, https or `file://`) to the extension's `viewer.html`.
2. `viewer.js` renders the document with a bundled copy of **pdf.js** (`libs/`, no runtime downloads) and builds a text layer for each page.
3. The page text is split into sentences with the [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter) API (`granularity: "sentence"`), which also handles Georgian text correctly.
4. Tab / Shift+Tab move the highlight across the matching `<span>`s and scroll it into view.

**Privacy:** `manifest.json` loads no remote scripts, and the only network request is fetching the PDF from the URL you opened — exactly what the browser would do anyway.

## Install (unpacked)
1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and select this folder.
3. Open any PDF — the address bar will change to `chrome-extension://<id>/viewer.html?file=…` and the first sentence will be highlighted.

## Tech
Vanilla JavaScript · Chrome Extensions Manifest V3 · `declarativeNetRequest` · pdf.js · `Intl.Segmenter`

## Ideas for next versions
- Keyboard shortcut to jump by paragraph or page
- Text-to-speech of the active sentence
- Remember the last position per document

---

# PDF Sentence Navigator

Chrome Extension (Manifest V3), რომელიც საშუალებას აძლევს მომხმარებელს PDF
დოკუმენტში **წინადადებებს შორის** გადაადგილდეს კლავიატურით:

- **TAB** — შემდეგი წინადადება
- **SHIFT + TAB** — წინა წინადადება

აქტიური წინადადება ყოველთვის ვიზუალურად მოინიშნება (ყვითელი) და
ავტომატურად ჩნდება ეკრანზე.

**ყველაფერი მუშაობს მხოლოდ ლოკალურად, ბრაუზერში.** PDF-ის ტექსტი არასდროს
იგზავნება რაიმე გარე სერვერზე — extension-ს არც ერთი ქსელური მოთხოვნა არ
გააქვს გარეთ.

## რატომ არსებობს ცალკე viewer.html

Chrome-ის ჩაშენებულ PDF ხედვას (built-in PDF viewer) content script-ები
პრაქტიკულად ვერ სწვდებიან — ტექსტი რენდერდება Chromium-ის შიდა PDFium
plugin-ის მიერ და არ არსებობს extension-ისთვის ღია API, რომ წინადადებების
დონეზე მოვნიშნოთ ტექსტი.

ამიტომ extension-ი:

1. აღმოაჩენს, როცა მომხმარებელი ხსნის `.pdf` ფაილს (http/https/file://).
2. ავტომატურად ამისამართებს ტაბს extension-ის საკუთარ გვერდზე
   (`viewer.html`), რომელიც PDF-ს ლოკალურად რენდერავს **pdf.js**-ის
   გამოყენებით (ბიბლიოთეკა ჩაშენებულია extension-ში, `libs/` ფოლდერში —
   ინტერნეტიდან არაფერი არ ჩამოთვირთავს runtime-ზე).
3. თითოეული გვერდისთვის ვაგებთ ტექსტურ ფენას (text layer) და
   [`Intl.Segmenter`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Segmenter)
   API-ს დახმარებით ვყოფთ მთლიან ტექსტს წინადადებებად (მუშაობს ქართული
   ტექსტისთვისაც).
4. `TAB` / `SHIFT+TAB` მოვინიშნავს შესაბამის წინადადებას შესაბამის
   span-ებზე.

## დაყენება Chrome-ში (Load unpacked)

1. გახსენი Chrome და გადადი: `chrome://extensions`
2. ჩართე ზედა მარჯვენა კუთხეში **Developer mode**.
3. დააჭირე **Load unpacked** და აირჩიე ეს პროექტის ფოლდერი
   (`pdf-sentence-nav/`).
4. Extension გამოჩნდება სიაში სახელით **PDF Sentence Navigator**.

## როგორ შემოწმდეს ფუნქციონალი

1. გახსენი ნებისმიერი PDF ფაილი Chrome-ში — მაგალითად:
   - `https://example.com/some-document.pdf` ან
   - ორმაგი წკაპი დისკზე შენახულ `.pdf` ფაილზე (თუ file-access ჩართული აქვს).
2. Extension-მა ავტომატურად უნდა გადაგამისამართოს ახალ ხედვაზე — მისამართის
   ველში დაინახავ რაღაც ამის მსგავსს:
   `chrome-extension://<extension-id>/viewer.html?file=...`
3. დოკუმენტი დაირენდერდება გვერდ-გვერდ, პირველი წინადადება ავტომატურად
   მოინიშნება ყვითლად.
4. დააჭირე **TAB** — მონიშვნა გადავიდეს შემდეგ წინადადებაზე, გვერდი
   ავტომატურად დასქროლდება იმ ადგილამდე.
5. დააჭირე **SHIFT + TAB** — მონიშვნა დაბრუნდეს წინა წინადადებაზე.
6. ზედა toolbar-ში ჩანს მიმდინარე მდგომარეობა, მაგ: `წინადადება 4 / 37`.

## ლოკალურობის გარანტია

- `manifest.json`-ში არ არსებობს არანაირი გარე (remote) სკრიპტი.
- `viewer.js` მხოლოდ ლოკალურ `libs/pdf.min.mjs`-ს იტვირთავს.
- ერთადერთი ქსელური მოთხოვნა, რომელსაც extension-ი აკეთებს, არის ორიგინალი
  PDF ფაილის გადმოწერა იმ URL-იდან, საიდანაც მომხმარებელმა თავადვე გახსნა
  (ანალოგიურად, როგორც ეს ჩვეულებრივ ბრაუზერშიც მოხდებოდა) — ტექსტის
  დამუშავება და მონიშვნა ხდება 100% ლოკალურად, browser-ის მეხსიერებაში.
