# Release notes

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
