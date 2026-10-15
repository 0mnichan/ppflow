# PSF-20 Printer

A small web app for designing and printing labels and receipts on a **PSF-20 Bluetooth thermal printer**. It runs in the browser, so there's nothing to install. It is a single HTML file with no frameworks, no accounts and no tracking.

Open it, put text, images, QR codes and barcodes where you want them, and press **Print**.

---

## Contents

- [What it can do](#what-it-can-do)
- [Which browsers work](#which-browsers-work)
- [Quick start](#quick-start)
- [Using the editor](#using-the-editor)
- [Paper: receipts and labels](#paper-receipts-and-labels)
- [Live fields: dates and counters](#live-fields-dates-and-counters)
- [Printing](#printing)
- [Saving and sharing designs](#saving-and-sharing-designs)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Host your own copy](#host-your-own-copy)
- [Troubleshooting](#troubleshooting)
- [How it works](#how-it-works)
- [Project layout](#project-layout)

---

## What it can do

- **Free-form editor.** Every item is a box you can move, resize and rotate freely. It snaps to the edges, the centre and other items.
- **Text** in any font your device has, in any language or script (Tamil, Chinese, Arabic, emoji…). It supports bold, italic, underline, left/centre/right alignment, line wrapping, line and letter spacing, and white-on-black.
- **Images** from a file, a paste or a drag-and-drop, converted to black and white. There are three styles (smooth photo, crisp photo, black and white) plus brightness, contrast and cutoff controls.
- **QR codes** with four error-correction levels.
- **Barcodes:** Code 128, Code 39, EAN-13 and UPC-A, with the check digit added for you.
- **Shapes:** lines (solid or dashed), boxes with optional rounded corners, and circles, each outlined or filled.
- **Receipt rolls or labels**, in any length, portrait or landscape.
- **Live fields:** today's date, the time, a date N days ahead, and an auto-incrementing counter for serial numbers and asset tags.
- **Multiple copies** in one go, with the counter going up on each copy.
- **Templates:** receipt, price tag, shipping label, asset tag and cable flag.
- **Undo and redo**, plus automatic saving of your current design.
- **Save designs** on the device, **export or import** them as files, or **save a PNG** of the print.
- **What you see is what prints.** The preview is the real 1-bit image sent to the printer, dot for dot.
- **Works offline** once loaded, and can be installed to your home screen as an app.
- **Printer tools:** feed, test page, a speed test and a raw hex console for tinkering.

## Which browsers work

Printing uses **Web Bluetooth**, which only some browsers have.

| Device | Works? |
| --- | --- |
| Android: Chrome, Edge, Opera, Samsung Internet | Yes |
| Windows, macOS, ChromeOS: Chrome, Edge, Opera | Yes |
| Linux: Chrome | Yes, after turning on a flag (see [Troubleshooting](#troubleshooting)) |
| iPhone and iPad (every browser) | No. Apple doesn't allow Web Bluetooth |
| Firefox, Safari (any platform) | No |

You can still **design, save and export** in any browser. Only printing needs Web Bluetooth.

The page must be opened over **https://**, or over **http://localhost** for development.

## Quick start

1. Switch the printer on. Make sure nothing else is connected to it, such as the vendor app on your phone.
2. Open the app in Chrome on Android or a computer.
3. Press **Connect** and pick `PSF-20-…` from the list.
4. Press **Text**, type something, and press **Print**.

You can skip step 3: if you aren't connected, **Print** connects you first.

## Using the editor

### Adding things

The toolbar at the top adds an item to the page:

| Button | Adds |
| --- | --- |
| Text | A text box, ready for typing |
| Image | Opens the file picker. You can also **paste** an image or **drop** one onto the page |
| QR | A QR code |
| Barcode | A Code 128 barcode (switch the type in its settings) |
| Line, Box, Circle | Shapes |

On receipts, new items go below the last one. On labels, they go in the middle.

### Selecting and changing items

- **Tap** an item to select it. A blue frame with handles appears, and its settings open in the panel (below the page on phones, on the right on computers).
- **Drag** the item to move it. Pink guide lines show when it lines up with the edges, the centre or another item. Hold <kbd>Alt</kbd> to turn snapping off.
- **Drag a square handle** to resize.
  - Text: the side handles change the box width, so long lines wrap. The corner handles scale the font.
  - Images and QR codes keep their shape when you use a corner. Hold <kbd>Shift</kbd> to keep the shape of anything else.
- **Drag the round handle** to rotate. It sticks at 0°, 45°, 90° and so on. Hold <kbd>Shift</kbd> for 15° steps.
- **Tap a selected text box again** to type straight into it. Tap a selected QR code or barcode again to edit its content.
- Tap an empty area to deselect.

### The settings panel

With an item selected, the panel shows:

- **Quick actions:** duplicate, bring forward, send backward, rotate 90°, centre across, centre top-to-bottom, full width, and delete.
- **Exact position and size** in millimetres, plus the angle.
- **Settings for the item type**, such as font and alignment for text, style and contrast for images, or type and content for barcodes.

To use a font that isn't in the list, pick **Other font…** and type its name exactly as installed, for example `Comic Sans MS`.

## Paper: receipts and labels

Open **Paper** in the panel.

| Setting | What it does |
| --- | --- |
| Receipt roll | Continuous paper. With **Auto length** on, the print stops just after the last item (shown by the dashed "print ends here" line). Turn it off to print a fixed length. |
| Labels | Die-cut labels. Set the **length** of one label and the **gap** between labels. The app adds the gap as blank paper after each label, so the next one starts in the right place. |
| Portrait / Landscape | Landscape turns the design sideways. Use it for labels that are longer than they are wide, or for text that runs along the strip. |

The **width is fixed at 48 mm** (384 dots), which is the PSF-20's printable width. At 8 dots per mm, 1 mm is 8 dots.

## Live fields: dates and counters

Type these into any text, QR code or barcode. They're filled in when you print:

| Field | Prints |
| --- | --- |
| `{date}` | Today's date in your device's format |
| `{time}` | The current time |
| `{datetime}` | Date and time |
| `{date+30}` | The date 30 days from now (any number works, including `{date-7}`) |
| `{n}` | The counter: 1, 2, 3… |
| `{n:4}` | The counter padded to 4 digits: 0001, 0002… |

In a text box, **+ Insert a live field…** adds them for you.

**The counter** starts at the number in **Print options → Counter starts at** and goes up by one per copy. After printing, it carries on from where it stopped, so the next batch continues the sequence. The **Asset tag** template shows this in action.

## Printing

- Set **copies** with − and + next to the Print button.
- **Print options → Darkness** controls how bold text and shapes come out. Images have their own controls.
- **Blank lines after a receipt** feeds paper after a receipt so you can tear it off. Labels don't need this, because the gap is fed automatically.
- If a QR code or barcode can't be printed (too small, or invalid digits), it shows crossed out on the page with an explanation in its settings, and Print tells you what to fix.

## Saving and sharing designs

Open **Designs and templates**:

- **Start from a template** replaces the current design. **Undo** brings your old one back.
- **Save** keeps a design on this device under a name. Saved designs are listed with **Open** and **Delete**.
- **Export file** downloads a `.psf20.json` file you can send to someone or move to another device. **Import file** opens one.
- **Save as PNG** downloads the exact image that would print.
- **New blank** clears the page. Undo works here too.

Your current design is also saved automatically in the browser, so closing the tab doesn't lose it.

## Keyboard shortcuts

| Keys | Action |
| --- | --- |
| <kbd>Ctrl</kbd>+<kbd>Z</kbd> | Undo |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Z</kbd> or <kbd>Ctrl</kbd>+<kbd>Y</kbd> | Redo |
| <kbd>Ctrl</kbd>+<kbd>D</kbd> | Duplicate |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Delete the selected item |
| Arrow keys | Nudge by 1 dot (hold <kbd>Shift</kbd> for 1 mm) |
| <kbd>Enter</kbd> | Edit the selected text |
| <kbd>Esc</kbd> | Stop editing, or deselect |
| <kbd>Ctrl</kbd>+<kbd>V</kbd> | Paste an image or text as a new item |

On a Mac, use <kbd>Cmd</kbd> instead of <kbd>Ctrl</kbd>.

## Host your own copy

The app is plain static files in [`psf20-app/`](psf20-app). There's no build step.

### Vercel

1. Import this repository in Vercel.
2. Set **Root Directory** to `psf20-app`. This is the one setting people miss: without it, Vercel finds no `index.html` and shows a 404.
3. Leave the framework preset as **Other**, with no build command and no output directory.
4. Deploy.

`vercel.json` stops the service worker from being cached, so updates reach people straight away.

### Any other static host

Upload the contents of `psf20-app/` to GitHub Pages, Netlify, Cloudflare Pages, your own server, or anywhere else that serves files over **https**.

### On your own computer

```sh
cd psf20-app
python3 -m http.server 8000
```

Then open <http://localhost:8000> in Chrome. Web Bluetooth works on `localhost` without https.

## Troubleshooting

**"This browser can't talk to Bluetooth printers."**
You're on a browser without Web Bluetooth. See [Which browsers work](#which-browsers-work). The **Printer and connection** panel shows a connection check telling you exactly what's missing.

**Linux Chrome shows Web Bluetooth as FAIL.**
Open `chrome://flags/#enable-experimental-web-platform-features`, set it to **Enabled** and restart Chrome. Make sure Bluetooth is running (`systemctl status bluetooth`). Some packaged builds (snap, Flatpak) have Bluetooth blocked, so try Google's official `.deb` if it still fails.

**The printer doesn't appear in the list.**
- Make sure it's on and **not connected to anything else**: the vendor app, another browser tab, or nRF Connect. A BLE printer accepts only one connection.
- Tick **Show all Bluetooth devices in the picker** under *Printer and connection*.

**Linux: "Connection attempt failed" or "br-connection-profile-unavailable".**
BlueZ is trying a classic Bluetooth connection. Switch the adapter to LE-only:

```sh
sudo btmgmt power off
sudo btmgmt bredr off
sudo btmgmt power on
```

**The print has skipped or garbled bands.**
Under *Printer and connection → Transfer settings*, lower **Chunk bytes** (20 always works), add a few ms of **Delay**, or tick **Write with response**. Then use **Speed and integrity test** to check: it should print an even checkerboard.

**A QR code or barcode won't scan.**
Make it bigger. QR codes need squares at least 2 dots wide, and the app warns you below that. Leave some white space around codes, and try a lower error-correction level to make a QR code's squares larger.

**The text looks too thin or too blotchy.**
Change **Print options → Darkness**.

## How it works

Everything happens in the browser:

1. **Rendering.** The design is drawn onto a 384-dot-wide canvas. Text and shapes are drawn normally, then turned into pure black and white using the Darkness level. Images are dithered on their own (Floyd–Steinberg, Atkinson, or a plain threshold). QR codes and barcodes are drawn with whole-dot modules so they stay sharp. The QR encoder and barcode encoders are built in, with no libraries.
2. **Packing.** The black-and-white image becomes 1-bit rows of 48 bytes (384 dots ÷ 8).
3. **Sending.** The app talks to the printer over Bluetooth Low Energy using standard ESC/POS commands:

| What | Value |
| --- | --- |
| BLE service | `49535343-fe7d-4ae5-8fa9-9fafd205e455` |
| Write characteristic | `49535343-8841-43f4-a8d4-ecbe34729bb3` |
| Notify characteristic | `49535343-1e4d-4bd9-ba61-23c647249616` |
| Reset | `ESC @` (`1B 40`) |
| Image band | `GS v 0` (`1D 76 30 00 30 00 nL nH` + rows), sent in bands of 128 rows by default |
| Feed lines | `ESC d n` (`1B 64 n`) |

Data is written in chunks (20 bytes by default) without waiting for a response, which you can change under Transfer settings. Messages from the printer show in the Log.

Landscape designs are rotated 90° before packing. For labels, the gap is added as blank rows.

## Project layout

```
psf20-app/
  index.html            The whole app: layout, styles and script
  sw.js                 Service worker (offline use; network first, so updates arrive)
  manifest.webmanifest  Lets you install it as an app
  icon-192.png, icon-512.png
  vercel.json           Stops caching of sw.js on Vercel
```

`index.html` is split into commented sections (Bluetooth, Bitmaps, QR code, Barcodes, Document, Rendering, Editing, Printing…), so you can jump to the part you want to change.

### Contributing

Issues and pull requests are welcome. Please keep to the spirit of the app: one file, no dependencies, no build step, and nothing that gets between you and printing.
