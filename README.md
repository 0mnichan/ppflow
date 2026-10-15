# PSF-20 Printer

A fast, no-nonsense label and receipt designer for the **PSF-20** Bluetooth thermal printer, and for most ESC/POS printers with a 48 mm (384-dot) print head.
It runs in the browser: there is nothing to install, no account and no ads, and nothing leaves your device.

- **One canvas for everything.** Add text, images, QR codes, barcodes, boxes, circles and lines, then drag, resize and rotate them freely.
- **Real text boxes.** Text wraps to the box, can auto-size to fill it, and supports any font installed on your device and any script (தமிழ், 你好, ₹, emoji).
- **Label or receipt paper.** Use label size presets or a custom size, with gap handling, or a continuous roll that trims itself to the content.
- **Batch printing.** Print copies with an auto-incrementing counter `{n}`, plus `{date}` and `{time}` placeholders.
- **What you see is what prints.** The eye button shows the exact 1-bit dots the printer will receive.
- **Works offline** once loaded (installable PWA). Designs auto-save and can be saved by name or exported as files.

---

## Contents

1. [Quick start](#quick-start)
2. [Which browsers work](#which-browsers-work)
3. [Using the editor](#using-the-editor)
4. [Paper setup](#paper-setup)
5. [Printing, copies and counters](#printing-copies-and-counters)
6. [Saving designs](#saving-designs)
7. [Keyboard shortcuts](#keyboard-shortcuts)
8. [Troubleshooting](#troubleshooting)
9. [Hosting it yourself](#hosting-it-yourself)
10. [How it works](#how-it-works)

---

## Quick start

1. Open the app in **Chrome or Edge** (Android, Windows, macOS, ChromeOS or Linux). It must be served over `https://` or from `http://localhost`.
2. Switch the printer on. Make sure no other phone or app is connected to it.
3. Tap **Connect** and pick `PSF-20-…` from the list.
4. Tap the paper chip at the bottom left (e.g. *Label 40 × 30 mm*) and choose your paper.
5. Add things with the toolbar (**Text**, **Image**, **QR**, **Barcode**, **Box**, **Circle**, **Line**) and arrange them.
6. Tap **Print**. If you are not connected yet, Print connects first.

> Want a head start? **Designs → Start from** has ready-made templates: price tag, asset tag, address label and shop receipt.

## Which browsers work

The app talks to the printer with **Web Bluetooth**.

| Works | Does not work |
|---|---|
| Chrome, Edge, Opera on **Android** | Any browser on **iPhone / iPad** (Apple does not allow Web Bluetooth) |
| Chrome, Edge on **Windows, macOS, ChromeOS** | **Firefox**, **Safari** |
| Chrome on **Linux** (see [Linux notes](#linux)) | |

**Printer → Connection** runs a self-check and tells you exactly what is missing.

## Using the editor

### Selecting, moving, resizing, rotating

| Do this | To |
|---|---|
| Tap / click an element | Select it. Its properties appear in the panel. |
| Drag it | Move it. Pink guide lines appear when it lines up with the label's edges or centre, or with other elements. Hold **Alt** to move without snapping. |
| Drag a **square handle** | Resize. Corner handles keep proportions for images and QR codes (hold **Shift** for free resize). |
| Drag the **round handle** above it | Rotate freely. It clicks to 0/45/90°…; hold **Shift** for 15° steps. You can also type an angle or use **Rotate 90°**. |
| Double-tap text (or press **Enter**) | Jump to its text field so you can type. |
| Tap empty paper | Deselect and show the paper settings. Dragging empty paper scrolls. |
| Pinch, or Ctrl + scroll | Zoom. The **⛶** button fits the label to the screen. |

The panel's top row has **Duplicate**, **Bring forward**, **Send backward**, **Lock** (stops accidental moves) and **Delete**.
**Position and size** takes exact millimetres and has buttons to snap the element to any edge or the centre of the label.

### Text

- **Wrap lines to the box width.** Long text flows onto new lines as you narrow the box. Turn it off to break lines only where you press Enter.
- **Fit text to the box (auto size).** The font grows or shrinks to fill the box exactly. Drag the handles and the text scales with them. Great for prices and names of varying length.
- **Grow the box with the text.** The box height follows the content. It turns off when you drag the top or bottom handle yourself.
- Font: Sans, Serif, Mono, Condensed, Rounded, Script, or **Other installed font…** for any font on your device by name (e.g. `Impact`, `Noto Sans Tamil`).
- Bold, italic, underline, strikethrough, left/centre/right alignment, top/middle/bottom placement, line and letter spacing, and **white text on black**.

Text is drawn as a picture, so any language or emoji your device can display will print.

### Images

Add an image from the toolbar, by pasting (Ctrl+V), or by dropping a file onto the canvas. Choose how it becomes black and white:

| Style | Best for |
|---|---|
| Photo, smooth (Floyd–Steinberg) | Photos, gradients |
| Photo, crisp (Atkinson) | Photos with strong contrast, faces |
| Halftone pattern | A newspaper-style look; prints evenly |
| Black and white | Logos, line art, screenshots of text |

Fine-tune with **Brightness**, **Contrast** and **Cut-off**, or **Invert** it. Transparent areas stay blank, so a logo can sit on top of a box.
Images are scaled down to 1000 px when added to keep designs small.

### QR codes

Type a link, text, phone number, Wi-Fi string, UPI link and so on. Higher **Error fix** levels survive scratches but make the code denser.
The panel shows how many dots each square gets and warns you when the code is too small to scan reliably (aim for 2+ dots per square).

### Barcodes

Code 128 (any plain text), Code 39 (capitals, digits, `- . $ / + %` and spaces), EAN-13, EAN-8 and UPC-A.
For EAN and UPC you can leave out the last (check) digit and it is calculated for you. If you type it, it is verified.
Bars are snapped to whole printer dots so they scan reliably. The panel tells you if the barcode is too narrow. Leave some white space on both sides for scanners.

### Shapes

**Box** (outline or filled, rounded corners), **Circle/ellipse**, and **Line** (solid or dashed, any thickness, any angle). They are handy for borders, dividers and cut marks.

### Placeholders

Type these into any text, QR code or barcode:

| Placeholder | Becomes |
|---|---|
| `{date}` | Today's date, in your device's format |
| `{time}` | The current time (hh:mm) |
| `{n}` | The counter. It goes up by one for every copy printed. |

## Paper setup

Tap the paper chip at the bottom left, or tap empty paper.

### Label paper

- **Size**: pick a preset or type any width × height in mm. The print head is 48 mm wide. On wider labels, the part that cannot be printed is shaded red.
- **Gap**: the blank space between labels. After each label the printer feeds exactly this much.
- **Use the printer's gap sensor**: sends the ESC/POS *next label* command (`GS FF`) instead of feeding a fixed distance. Turn it on if your labels slowly drift out of position; turn it off if a blank label comes out after every print (not all firmware supports it). **Printer → Next label** lets you test it.

### Receipt paper (continuous roll)

- **Length**: how much paper the design has. It grows automatically as you place things near the end.
- **Cut off blank space at the end**: prints only down to your last element, which saves paper.
- **Feed after**: extra paper fed after printing, so the receipt clears the tear bar.

### Printing options (both)

- **Darkness**: how much of the edges of text and shapes turns black. Raise it for bolder text, lower it for crisper small text. Images have their own controls.
- **Shift right**: moves everything sideways (negative values move left). Use it if your labels are not centred under the head.
- **Next {n}** and **{n} digits**: the counter's next value and its zero padding (e.g. 4 digits → `0007`).

## Printing, copies and counters

Set the number of copies next to the Print button and tap **Print**. While printing, the button becomes **Cancel**.
If the design uses `{n}`, every copy gets the next number and the counter remembers where it stopped, which is ideal for asset tags, tickets and serial labels.

## Saving designs

- Your current design **auto-saves** in the browser and is there when you come back.
- **Designs → Save** stores it by name. Saving with an existing name replaces that design.
- **Export design file** downloads a `.psf20.json` file (images included) to back up or move to another device. **Import design file** opens one.
- **Undo / Redo** (the arrows at the top) cover every change, including loading a template.

Everything is stored locally in your browser. Clearing site data deletes saved designs, so export the important ones.

## Keyboard shortcuts

| Keys | Action |
|---|---|
| `T` `I` `Q` `B` `R` `E` `L` | Add text, image, QR, barcode, box, ellipse, line |
| Arrow keys | Nudge 1 dot (⅛ mm); with **Shift**, 1 mm |
| `Delete` / `Backspace` | Delete selected |
| `Enter` | Edit the selected element's text |
| `Esc` | Deselect, or leave a text field |
| `Ctrl+Z`, `Ctrl+Shift+Z` / `Ctrl+Y` | Undo, redo |
| `Ctrl+D` | Duplicate |
| `Ctrl+C`, `Ctrl+X`, `Ctrl+V` | Copy, cut, paste elements (pasting an image file adds it) |
| `[` / `]` | Send backward / bring forward |
| `+` `-` `0` | Zoom in, out, fit |
| `P` | Toggle print preview |
| `Ctrl+P` | Print |
| `Ctrl+S` | Open Designs |

On macOS use `Cmd` instead of `Ctrl`.

## Troubleshooting

**The printer is not in the list.** It is probably still connected to another phone or app (the official app, nRF Connect, a script). Disconnect it there or switch the printer off and on. If it still does not show up, tick **Printer → Show all Bluetooth devices**.

**"No Web Bluetooth" / self-check fails.** Use a browser from the [list above](#which-browsers-work), and open the page over `https://` or `http://localhost`.

<a id="linux"></a>**Linux.** BlueZ must be in LE-only mode for this printer:

```sh
sudo btmgmt power off; sudo btmgmt bredr off; sudo btmgmt power on
```

If the self-check still fails, enable `chrome://flags/#enable-experimental-web-platform-features` and restart Chrome.

**Prints have skipped or garbled bands.** The Bluetooth link is dropping data. In **Printer → Transfer**, lower **Chunk bytes** (20 always works), add a **Delay**, or tick **Write with response**. **Speed and integrity test** prints a checkerboard so you can compare settings. On a good link, 100 to 185-byte chunks are much faster.

**Labels drift or print across the gap.** Check the label height and gap match your roll exactly, or try the gap sensor option. **Shift right** fixes sideways misalignment.

**A QR code or barcode does not scan.** Make it bigger (the panel shows dots per square or bar), keep it unrotated or at 90° steps, use a lower error-fix level for long content, and leave white space around it.

**Text looks too thin or blobby.** Adjust **Darkness**, use bold, or increase the size. Below about 6 pt, the printer's 0.125 mm dots limit detail.

## Hosting it yourself

It is a static site with no build step and no dependencies. Serve the `psf20-app/` folder from anywhere that supports HTTPS.

- **Vercel / Netlify / GitHub Pages / Cloudflare Pages**: point the project at `psf20-app/` as the root directory. (`vercel.json` keeps the service worker from being cached too long.)
- **Locally**: browsers allow Web Bluetooth on `localhost` without HTTPS:

  ```sh
  cd psf20-app
  python3 -m http.server 8080     # or: npx http-server -p 8080
  # open http://localhost:8080
  ```

Opening `index.html` directly as a file will not work, because browsers block both modules and Bluetooth on `file://`.
To use it from your phone, host it on HTTPS (the free tiers above are enough) and use **Add to Home screen** to install it as an app.

## How it works

```
psf20-app/
├── index.html          page layout and icons
├── app.css             styles (light and dark)
├── sw.js               offline cache (network first, cache as fallback)
└── js/
    ├── app.js          editor: canvas interaction, properties panel, undo, storage, printing
    ├── render.js       document model and drawing of each element in printer dots
    ├── printer.js      Bluetooth LE connection and ESC/POS commands
    ├── raster.js       grayscale → 1-bit dithering and packing into printer rows
    ├── qr.js           QR code encoder (versions 1–40, L/M/Q/H)
    ├── barcode.js      Code 128 / Code 39 / EAN-13 / EAN-8 / UPC-A encoders
    └── templates.js    built-in templates
```

- **Model.** A design is JSON: `paper` settings, a list of `els` (each with `type`, `x`, `y`, `w`, `h`, `rot` in printer dots, 8 dots = 1 mm, rotation around the centre) and `assets` (images as data URLs).
- **Rendering.** The design is drawn onto a canvas at exactly 8 px/mm, then every pixel becomes a dot by threshold (text and shapes) or dithering (images, done per element so the preview matches). The result is centred on the 384-dot head, plus *Shift right*.
- **Bluetooth.** The app uses the GATT service `49535343-fe7d-4ae5-8fa9-9fafd205e455`: it writes to characteristic `…8841…` and listens for printer replies on `…1e4d…` (shown in **Printer → Log**). Data goes out in chunks set under **Transfer**.
- **ESC/POS.** `ESC @` resets, `GS v 0` sends the raster in bands, `ESC J n` feeds *n* dots, and `GS FF` feeds to the next label. The test page uses the printer's built-in QR command.
- **Other printers.** Any ESC/POS printer that accepts `GS v 0` raster over BLE should work if you change the service/characteristic UUIDs and the `PSF-20` name filter in `js/printer.js` (and `DOTS` for a different head width).

Privacy: the app makes no network requests except loading itself. There are no analytics or trackers, and your designs never leave the browser.
