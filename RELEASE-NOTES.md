# Release notes

## 1.1.4 — 16 November 2026

Write the comment right beside the area you snap, as in Multi Screens.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.4.exe` | 78.0 MB | `E2EA98FF5E7166953EABE325E473952C785704CECBD0147D2D7D8E207510C15D` |
| `Smart-Snap-Handbook-1.1.4.pdf` | 3.6 MB | `D23DB9BC79FDA6BF337BB6489ECE7DB8FDEF67C94AF03D9E2632F61847257B3A` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **The comment box**: once an area is chosen (dragged, a window clicked, or Enter), it stays outlined and a box beside it asks for the snap's comment. The picture is already taken, without the box or the dimming. **Save** or **Ctrl + Enter** keeps the snap with its comment; **Save and open** also opens Smart Snap on it, to mark a spot; **Discard** or **Esc** throws it away. It follows the dark or light appearance.
- **Smart Snap stays out of the way** after an area snap saved from the box, so the next snap can follow at once; the snap waits in its list. Window and full-screen snaps open Smart Snap as before.
- **The handbook**: its picture of an area snap shows the comment box.

### Updating from 1.1.3

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- The packaged app, with the real mouse and keyboard, over a test window of known colours (keys sent only while the app under test had the keyboard): a live area with a typed comment and Ctrl + Enter was saved with that comment, in the window's own colours, with the box to the right of the area and Smart Snap staying hidden; a frozen area (after a delay) and Esc was discarded; Save and open saved the snap and opened Smart Snap on it.
- Copy as picture and Create report as in 1.1.3.
- Microsoft Defender finds nothing in the installer.

## 1.1.3 — 16 November 2026

Area snaps on the live screen, a smooth press-drag-release, and the report copied as one picture.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.3.exe` | 78.0 MB | `F7974E06DCE9ADD4CC6C7C2F54C774BD9E6707B50484FE59BD420782CED947F8` |
| `Smart-Snap-Handbook-1.1.3.pdf` | 3.6 MB | `D482B2ED201E1AFD6505B24946E05E491CAE9F5F304387AD8716F93A0C662CF3` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **Area snaps on the live screen**: Ctrl + Alt + S (or Area) dims the screen at once but keeps it live, and the picture is taken the moment you let go. The program you were using stays in front. Before, every display was copied first and the area chosen on that copy, which took about a second to appear.
- **After a Delay the screen still freezes** before you choose, as Windows' own Snipping Tool does: anything placed over the screen closes open menus and hover effects, so this is the way to snap them.
- **Copy as picture** in the report form: the whole report on the clipboard as one tall picture, to paste into a chat, an email or a document. It uses the title and name in the form, saves nothing, and keeps the snaps.

### Fixed

- **Dragging out an area**: the drag could pick up the screen's picture and lose the release, so finishing needed another click. Now it is press, drag, release, even when the mouse leaves the display while dragging.
- **Esc in the report form** after an earlier report no longer counts as Create report.

### Updating from 1.1.2

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- The packaged app, with the real mouse, over a test window of known colours: an area chosen live and one after a delay were both exactly the size dragged, in the window's own colours, without the dimming or the outline.
- Copy as picture in the packaged app: the whole report on the clipboard (1588 × 5332 pixels for three snaps); the snaps stayed and no PDF was made. Create report still makes the PDF and clears the snaps.
- Microsoft Defender finds nothing in the installer.
- The handbook's report and selection pictures were retaken from this version, in a test profile.

## 1.1.2 — 16 November 2026

The handbook in the SCAFFApps style, and scrollbars in the SCAFFApps colours.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.2.exe` | 78.0 MB | `D2243F9F80E16B54C25CF555066BDAC14C3F7A40F0E9CC9AA2DCFAD7CA795A31` |
| `Smart-Snap-Handbook-1.1.2.pdf` | 3.6 MB | `98A18DF33F0931C33563959B2E9AD43306AFC9FC8ECE75B4BB526B8BE4AFCD3A` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **The handbook**, `Smart-Snap-Handbook-1.1.2.pdf`: 12 pages with pictures in the SCAFFApps brochure style. The SCAFFApps Suite opens it from Handbooks.
- **"Published by SCAFFApps - www.scaffapps.com"** at the end of Settings and of the sign-up window.
- **Scrollbars in the SCAFFApps style**: a slim purple bar on no track, wider under the pointer; never the grey Windows bar with its arrows.

### Updating from 1.1.1

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- Updated from 1.1.1 by the installed SCAFFApps Suite 1.0.1, against a stand-in for GitHub offering this installer: downloaded, checked against both published checksums, Windows' permission, installed in 9 seconds; Windows lists 1.1.2.
- Microsoft Defender finds nothing in the installer.
- The handbook's pictures were taken from this version, in a test profile, with snaps of a sample site (never the real screen).

## 1.1.1 — 16 November 2026

A shorter sign-up window, and "Published by SCAFFApps" at the end of Settings.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.1.exe` | 78.0 MB | `44F8CACAB29A5B9B3D869AFCDF2A11A1E651DDCD57C33CFB629CB39AFE4DB7CF` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **The sign-up window** (your name and e-mail, asked once) ends with "Published by **SCAFFApps** · www.scaffapps.com", without the paragraph above it.
- **Settings** ends with the same line; the Updates heading shows "Version 1.1.1".

### Updating from 1.1.0

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite. Windows asks for permission; Smart Snap closes, is updated and opens again.

### Tested

- The SCAFFApps Suite 1.0.0 updated Smart Snap 1.1.0 to 1.1.1 with its own button, against a stand-in for GitHub offering this installer, while Smart Snap was open: downloaded, checked against both checksums, Smart Snap closed, Windows' permission, installed, Smart Snap opened again; Windows lists 1.1.1. Microsoft Defender finds nothing in the installer.
- Settings in the new build: the line at the end, SCAFFApps in bold.

## 1.1.0 — 16 November 2026

Installed, not portable, in the SCAFFApps folder; the SCAFFApps colours; your name and e-mail asked once.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.0.exe` | 78.0 MB | `A59D0DC80BEB5626608A5B80391A6E51543827D3FD7F9146AC1CC0598940790A` |

### Changed

- **Installed only.** One installer, no portable file. New installs go to `C:\Program Files\SCAFFApps\Smart Snap`, with the Start menu shortcut in a **SCAFFApps** folder. A copy in `C:\Program Files\Smart Snap` moves there when it updates; the old folder is removed.
- **The SCAFFApps colours.** No more blue: buttons and switches in SCAFFApps purple, highlights and the update dot in gold, the area being snapped outlined in gold. The light appearance is white, with cream only behind the snap. The PDF report's links and numbers are purple.
- **Your name and e-mail, once.** The first SCAFFApps app to start on a Windows account asks for them, even when it starts hidden with Windows; the others (the SCAFFApps Suite, Multi Screens, Instant Share) do not ask again. They are sent to SCAFFApps (`www.scaffapps.com`) with the app's name and version, the Windows version and a random number made for the Windows account. Nothing else is sent, and nothing you snap.
- **The SCAFFApps Suite** installs, opens and updates Smart Snap.

### Updating from 1.0

- **Installed copy:** Settings > Updates > **Update now**. Windows asks for permission; the new version is installed in `C:\Program Files\SCAFFApps\Smart Snap` and opens.
- **Portable copy:** there is no 1.1.0 portable file, so it offers only the release page. Run the installer once, then delete the portable file.

### Tested

- Installed without pages, as Update now runs it: in `C:\Program Files\SCAFFApps\Smart Snap`, Start menu and desktop shortcuts, Windows lists 1.1.0. Microsoft Defender finds nothing in the installer or the program.
- From the source code with a fresh profile, after Multi Screens had registered: Smart Snap did not ask again and sent its own registration.
- The dark and light appearances, looked over for any blue left.

### Not tested

- **Update now** from an installed 1.0 copy through Windows' permission prompt, and the move from `C:\Program Files\Smart Snap` (the same steps as Multi Screens 1.8.0, tested there).

## 1.0.2 — 15 November 2026

A new icon in the SCAFFApps colours. Nothing else has changed.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.0.2.exe` | 78.0 MB | `2A493100340415BBA3784E72488DA338598BFEA2B36ECD7F0C1AE8F0595CC9B5` |
| `Smart-Snap-1.0.2-portable.exe` | 77.7 MB | `6B6823B31714BFF1DF0B8CC9089FFDB53D4CF7406CAC6F3788D9D56268934621` |
| `Smart-Snap-Handbook-1.0.2.pdf` | 2.0 MB | `33807AA7D67C254780BD88EED6145B7536133E57DCC07BA744744F73CD9D458A` |

### Changed

- **New icon.** The same picture, a snap in front of its report page, now in the SCAFFApps colours: a purple tile with cream and gold, like Instant Share and Multi Screens; the red marker is now gold. It shows on the window, the tray, the taskbar, the Start menu and desktop shortcuts, the installer and the PDF report.
- The handbook shows the new icon on its cover and in its pictures.

### Tested

- The installer, the portable file and the program inside them carry the new icon (read back from the built files).
- The portable file started with a fresh profile and showed the new icon in its window and on the "Take a snap" page.

### Not tested

- Installing with the installer, and updating to this version from 1.0.1 in Settings.

### Updating from 1.0.1

Settings > Updates offers this version, and the daily check announces it. A shortcut pinned to the taskbar may keep the old picture until Windows refreshes its icons; unpinning it and pinning it again shows the new one.

## 1.0.1 — 15 November 2026

A handbook, and portable updates that tidy up after themselves.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.0.1.exe` | 78.0 MB | `918E795563C19C2F3C37AF724BF5A1B25DD6438164D47B37A1F90B5799D4635E` |
| `Smart-Snap-1.0.1-portable.exe` | 77.8 MB | `DD3772C463E48BD314A434A5EA61D12C200BAC18CB1AF223B4E7CE6BF1C0EDAD` |
| `Smart-Snap-Handbook-1.0.1.pdf` | 2.0 MB | `9D022D1D4FBA058FBE0F51BC3B8CF1A6359E31401659B4403054749C0CBE10D1` |

### New

- **Handbook.** A 12-page guide with pictures: taking snaps, what each snap records, working on snaps, the report, settings and updates.

### Fixed

- **Updating a portable copy left nothing running.** The new version found the old one still open and closed itself, and then the old one closed too. The old copy now hands over before it starts the new one.
- **The old portable file is deleted** once the new version has taken over, instead of being left beside it. After an update with the installer, the downloaded installer is removed.

### Tested

- A portable 1.0.0 built from this code updated itself to 1.0.1 from a stand-in for GitHub: the download was checked, 1.0.1 took over and stayed open, and the 1.0.0 file was deleted about five seconds later.

### Not tested

- Updating with the installer.

### Updating from 1.0.0

The fix is in the new version, but the hand-over happens in the old one. A **portable 1.0.0** that updates itself downloads 1.0.1 correctly but may then close without opening it: open `Smart-Snap-1.0.1-portable.exe` yourself, and delete the 1.0.0 file. Installed copies are not affected.

## 1.0.0 — 15 November 2026

The first release.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.0.0.exe` | 78.0 MB | `FCF73321115F5E3FFB097673DF41F7819A1B47C5CF82B71CAD4387D1C372147C` |
| `Smart-Snap-1.0.0-portable.exe` | 77.8 MB | `98BD123027E6F5A8BA1E441C241E122E8DF681A1E9EE8DAD71E5DC9BB4CAE1CF` |

Both are for 64-bit Windows 10 and 11 and are not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Features

- **Three kinds of snap** from anywhere, by shortcut, tray menu or button: an area (or a window clicked on the frozen screen), the window in front, or the full screen. Optional 3, 5 or 10 second delay.
- **Where it came from:** each snap records the application (name, version, company, icon, program file), the window title, the page address for web browsers (Chrome, Edge, Brave, Opera, Vivaldi, Firefox and similar), and the folder for File Explorer.
- **Comment and mark** each snap; correct or add its link; reorder snaps; copy a picture or save it as PNG.
- **PDF report:** title and author, a summary table with clickable links, then each snap with its comment, mark, close-up and source details. Reported snaps are cleared unless you choose to keep them.
- **Updates:** checks GitHub for a new version at start and once a day (can be turned off), shows what is new, and installs it on request after checking its published checksum. Also from the tray menu.
- Runs in the tray; can start with Windows. Light and dark appearance in the same colours as Multi Screens and Instant Share (VS Code Dark 2026 for dark). Output folder chosen in the installer or on first start.

### Tested

- Window and full-screen snaps of Microsoft Edge record "Microsoft Edge 157", the window title and `https://watchdog.scaffapps.com/status` from the address bar.
- Window, full-screen and area snaps of Visual Studio Code, including the area overlay with a drag.
- A PDF report with comments, an area mark, a spot mark and close-ups; its links open the page.
- The packaged program starts its window helper from inside the app archive, and its file properties show publisher SCAFFApps and version 1.0.0.

- The update check against a stand-in for GitHub offering 1.1.0 (notes, red dot, one-time message), and against GitHub itself, which answers that no release is published yet.

### Not tested

- Downloading and installing an update: possible only once a second version is published.

- Clicking through the installer and uninstaller by hand.
- Firefox, Chrome, Brave, Opera and Vivaldi address reading (they use the same method as Edge, but have not been tried).
- More than one monitor, and monitors with different scaling.
