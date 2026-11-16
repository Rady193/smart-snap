# Smart Snap

Smart Snap takes screenshots that remember where they came from. Each snap records the application it was taken from, the window title and, for web browsers, the address of the page. Add a comment, mark a spot, and turn all your snaps into one PDF report.

Version 1.2.3 · Windows 10 and 11 (64-bit) · Published by SCAFFApps

The **[handbook](https://github.com/Rady193/smart-snap/releases/latest)** (`Smart-Snap-Handbook-<version>.pdf`, on the Releases page) explains everything, with pictures.

## Contents

- [Install](#install)
- [Quick start](#quick-start)
- [Taking a snap](#taking-a-snap)
- [What each snap records](#what-each-snap-records)
- [Working on a snap](#working-on-a-snap)
- [The PDF report](#the-pdf-report)
- [Updates](#updates)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Where things are saved](#where-things-are-saved)
- [What it does not do](#what-it-does-not-do)
- [Building from source](#building-from-source)
- [Project layout](#project-layout)
- [Licence](#licence)

## Install

Download `Smart-Snap-Setup-1.2.3.exe` from the [Releases page](https://github.com/Rady193/smart-snap/releases/latest) and run it, or install it from the **SCAFFApps Suite**. It installs for everyone on the computer, in `C:\Program Files\SCAFFApps\Smart Snap` unless you choose another folder, so Windows asks for administrator permission once. It adds a desktop shortcut and a Start menu shortcut in the **SCAFFApps** folder, and can be removed from Windows Settings. A copy installed by an earlier version in `C:\Program Files\Smart Snap` moves to the SCAFFApps folder when it updates.

Since 1.1.0 Smart Snap is installed, not portable. A portable copy from before cannot update itself to it: install it with the installer once, then delete the portable file.

The app is not code-signed, so the first time you run the installer Windows SmartScreen may show "Windows protected your PC". Choose **More info**, then **Run anyway**.

### Output folder

Everything the app produces goes into one folder that you choose:

A page of the installer titled "Output folder" asks where to save, after you pick the install location. It suggests `Documents\Smart Snap`. (Installed from the SCAFFApps Suite, without the installer's pages, the app asks once, the first time it starts.)

Inside that folder the app keeps two subfolders: `Screenshots` (pictures saved as PNG) and `Reports` (PDF reports). To change the folder, open **Settings** (the sliders icon) and choose **Change…**.

### The first start

The first SCAFFApps app to start on a Windows account asks for your **name** and **e-mail address**, once. Both are required; closing the window without them closes the app. The other SCAFFApps apps on that account (the SCAFFApps Suite, Multi Screens, Instant Share) use the same details and do not ask again. They are sent to SCAFFApps (`www.scaffapps.com`) with the app's name and version, the Windows version and a random number made for your Windows account, so SCAFFApps knows who uses its apps. Nothing else about you or the computer is sent, and nothing you snap.

## Quick start

1. Open Smart Snap. It also puts an icon in the tray, next to the clock.
2. Go to the program or web page you want to capture.
3. Press **Ctrl + Alt + S** and drag over the part of the screen you want, or click a window to take all of it.
4. A box opens beside the area: type what the reader should notice and press **Enter** (**Shift + Enter** starts a new line). The snap is saved and copied to the clipboard as a picture, ready to paste into a chat. To also mark a spot on the picture, choose **Save and open** instead, then click or drag on the picture in Smart Snap.
5. Repeat for as many snaps as you need.
6. Press **Create PDF report**.

Closing the window does not stop Smart Snap: it keeps running in the tray so the shortcuts work from any program. To stop it, right-click the tray icon and choose **Quit Smart Snap**.

## Taking a snap

| Kind | Shortcut | What it takes |
|---|---|---|
| Area | Ctrl + Alt + S, or PrtScn | The screen dims but stays live. **Press, drag and release** to take a rectangle; the picture is taken the moment you let go. **Click** a window to take that window, **Enter** for the whole display, **Esc** or right-click to cancel. While you move the mouse, the window under it is outlined in gold and its size is shown. Then the comment box opens beside the area (below). |
| Window | Ctrl + Alt + W | The window you are using, without its shadow. |
| Full screen | Ctrl + Alt + F | The whole display the mouse is on. |

The same three are buttons at the top of the Smart Snap window and items in the tray menu. When you use a button, Smart Snap hides itself first, so it takes the window you were using before.

**PrtScn** also snaps an area. Windows 11 gives that key to its Snipping Tool first: turn off **Use the Print screen key to open screen capture** in Windows Settings > Accessibility > Keyboard. Smart Snap's Settings says when it is on, with a button that opens that page. To leave PrtScn to Windows or another program, switch it off in Smart Snap's Settings.

**Keep on top.** The pin in the top bar keeps the Smart Snap window above other programs, for example beside the app you are testing, until you click it again; Smart Snap remembers it. The window is never in a snap: it steps aside while the picture is taken and comes back afterwards.

**The comment box.** Once an area is chosen, it stays outlined and a box beside it asks for the snap's comment, as Multi Screens asks for a note's. The picture is already taken: the box and the dimming are not in it. Type, then:

- **Save** (or **Enter**; **Shift + Enter** starts a new line) keeps the snap with its comment and copies it to the clipboard as a picture: that snap's part of the report alone (its number, application, comment, screenshot and details), ready to paste into a chat, an email or a document. The picture is there about a second later. Smart Snap stays out of the way, so you can go straight on to the next snap; the snap is in its list, and if its window is open it says the snap was copied.
- **Save and open** keeps it and opens Smart Snap on it, to mark a spot or an area on the picture.
- **Discard** (or **Esc**) throws the snap away.

The comment can be left empty and written later in Smart Snap. Window and full-screen snaps have no box: Smart Snap opens on them as before.

**Delay** (beside the buttons) waits 3, 5 or 10 seconds before taking the snap, so you can open a menu or hover over something first. The tray menu also has **Snap an area in 5 seconds**. After a delay, an area snap **freezes** the screen before you choose the area, as Windows' own Snipping Tool does: anything placed over the screen closes open menus and hover effects, so this is the way to snap them.

With more than one monitor, every monitor dims for an area snap and you can drag on any of them. A window spread across two monitors is cut at the edge of the one that shows most of it.

## What each snap records

| Item | Where it comes from |
|---|---|
| Application | The program that owns the window, by the name its maker gives it ("Microsoft Edge", "Visual Studio Code"), with its version, company and icon. For an area snap, it is the window in the middle of the area. |
| Window | The window's title, as shown in its title bar or taskbar button. |
| Link | For web browsers, the address in the address bar at the moment of the snap. Works with Chrome, Edge, Brave, Opera, Vivaldi, Firefox and similar browsers. |
| Folder | For File Explorer, the folder being shown. |
| Taken | Date and time, the kind of snap, the display, and the picture's size in pixels. |
| Program | The program file's location, for telling apart two programs with the same name. |

Chrome and Edge hide `https://` in the address bar. Smart Snap puts it back so the link works; addresses on your own network (`localhost`, `192.168.…`) get `http://`. If the address is wrong or missing, type the right one into the **Link** box. Clearing the box leaves the link out of the report.

## Working on a snap

The list on the left holds every snap, numbered in report order. Click one to work on it.

- **Comment:** type in the box under the picture. It is saved as you type.
- **Mark:** click the picture to circle a spot, or drag to box an area. A new mark replaces the old one; **Remove mark** takes it away.
- **Link:** correct or add the page address. The button beside it opens the address in your browser.
- **Copy picture** puts the picture on the clipboard (also Ctrl + C when you are not typing).
- **Save as PNG** saves the picture into the `Screenshots` folder, named after the application and time.
- **Up and down arrows** move the snap earlier or later in the report.
- **Delete** removes the snap. **Clear all** at the top of the list removes every snap after asking.

Snaps are kept until you create a report or delete them, including after closing Smart Snap or restarting the computer, so you can spread the work over several sessions.

## The PDF report

**Create PDF report** asks for:

- **Title**, printed at the top and used for the file name (default "Screenshot report").
- **Prepared by** (optional). Remembered for next time.
- **Keep the screenshots** after the report is made. Off by default: the snaps leave Smart Snap once they are in the PDF, ready for the next job.

The report is A4, with numbered pages. It contains:

1. A cover section with the title, who prepared it, when the snaps were taken, how many, and which applications, followed by a table of every snap: application, page or window, and time. Links in it can be clicked.
2. One section per snap: the application's icon and name, the window title, your comment, the picture with its mark, a close-up of the marked spot or area, and the details listed under [What each snap records](#what-each-snap-records).

After it is created, choose **Open** or **Show in folder**. Reports are saved in the `Reports` folder.

**Copy as picture**, in the same window and in the bar beside **Create PDF report**, puts the whole report (every snap, not only the last one saved with **Enter**) on the clipboard as one tall picture instead, to paste into a chat, an email or a document. It uses the title and name typed in the form (the last ones typed, from the bar), saves nothing, and keeps the screenshots in Smart Snap whatever **Keep the screenshots** says, so you can still create the PDF afterwards. A very long report is drawn smaller so it fits in one picture.

## Updates

Smart Snap asks the SCAFFApps website (GitHub if the website does not answer) for a newer version a few seconds after it starts and once a day while it runs. Nothing is downloaded until you choose to.

- When a new version is out, a message says so once, and the **Settings** button (the sliders icon) carries a gold dot. The SCAFFApps Suite shows the same and can install it.
- **Settings → Updates** shows what is new and offers **Update now**. **Check for updates** there (or in the tray menu) asks straight away.
- The download is checked against the SHA-256 checksum published with the release before it is used. If it does not match, it is not installed.
- Windows asks for permission, then Smart Snap closes, installs the new version (in `C:\Program Files\SCAFFApps\Smart Snap`, or the folder you chose) and opens again. The downloaded installer is removed once the update is done.
- Settings and snaps waiting for a report are kept.
- Turn off **Check for updates automatically** in Settings to stop the automatic checks. Only the version number is asked for: nothing about you or your snaps is sent.

## Keyboard shortcuts

| Keys | Where | Action |
|---|---|---|
| Ctrl + Alt + S | Anywhere | Snap an area or a window |
| PrtScn | Anywhere | The same (see [Taking a snap](#taking-a-snap) for Windows 11) |
| Ctrl + Alt + W | Anywhere | Snap the window in front |
| Ctrl + Alt + F | Anywhere | Snap the full screen |
| Esc / right-click | While choosing an area | Cancel |
| Enter | While choosing an area | Take the whole display |
| Up / Down | Smart Snap window | Previous or next snap |
| Ctrl + C | Smart Snap window | Copy the picture |

If another program already uses one of the shortcuts, Settings says so; use the buttons or the tray menu for that one.

## Where things are saved

| What | Where |
|---|---|
| Pictures saved with **Save as PNG** | `Screenshots` in your output folder |
| PDF reports | `Reports` in your output folder |
| Snaps waiting for a report, with their pictures | `%APPDATA%\Smart Snap\snaps` |
| Settings, including the output folder | `%APPDATA%\Smart Snap\settings.json` |
| The program | `C:\Program Files\SCAFFApps\Smart Snap` (or the folder you chose) |
| Your registration (name and e-mail, shared by every SCAFFApps app) | `%APPDATA%\SCAFFApps\registration.json` |

Deleting `%APPDATA%\Smart Snap` resets the app and deletes snaps not yet reported. Reports already created are not affected.

## What it does not do

- **Pages are not scrolled.** A snap holds what is on screen, not the whole length of a web page.
- **The link is what the address bar shows.** If you were typing in the address bar at the moment of the snap, the typed text is taken instead; a page open in a browser's app mode (no address bar) gives no link. Correct it in the **Link** box.
- **Other programs' documents.** For programs other than web browsers and File Explorer, the window title is recorded but not the document's file location.
- **Programs run as administrator.** Their name and icon may be missing when Smart Snap itself is not run as administrator. The picture is taken as normal.
- **Protected content.** Windows shows some video players, and windows marked as private, as black in every screenshot.
- **Windows only.** Smart Snap depends on Windows to name the window and read the browser's address.

## Building from source

You need Node.js 20 or newer.

```bash
npm install
npm start
```

To produce the installer in the `release` folder:

```bash
npm run dist
```

- With recent npm versions, `npm install` may skip Electron's download step. If `npm start` reports that Electron failed to install, run `node node_modules/electron/install.js` once, or copy `node_modules\electron\dist` from another project using the same Electron version and create `node_modules\electron\path.txt` containing `electron.exe`.
- When running from a VS Code terminal, clear `ELECTRON_RUN_AS_NODE` first, otherwise Electron starts as plain Node.js.
- If the project is in a synced folder (OneDrive) and a build fails with a file-in-use error, pause syncing or build to a folder outside it: `npx electron-builder --win -c.directories.output=C:\some\other\folder`.
- To change the icon, edit `build/icon.svg` and run `node_modules\electron\dist\electron.exe build\make-icon.js`.

## Project layout

| Path | Purpose |
|---|---|
| `main.js` | Tray, shortcuts, taking pictures of the screens, the area selection windows, keeping the snaps, and building the PDF report. |
| `windows.ps1` | Runs in the background for the app's lifetime. Lists the windows on screen and, for one window, names its application and reads the address from a browser's address bar (Windows UI Automation). |
| `preload.js` | The fixed set of functions the app window may call in `main.js`. |
| `registration.js`, `registration-preload.js`, `app/registration.html` | The name and e-mail registration, the same files in every SCAFFApps Electron app. |
| `overlay-preload.js` | The same for the area selection windows. |
| `app/index.html`, `app/style.css`, `app/renderer.js` | The app window. |
| `app/overlay.html` | The dimmed screen on which an area is chosen: see-through over the live screen, or the frozen picture after a delay. |
| `app/theme-early.js` | Applies the saved light or dark appearance before the window is first drawn. |
| `handbook/` | `handbook.html`, its pictures, the shared `kit.py`, and `build_handbook.py`, which takes the pictures and prints the handbook to `release\Smart-Snap-Handbook-<version>.pdf`, its only copy: `C:\venvs\studio\Scripts\python.exe handbook\build_handbook.py`. |
| `build/` | Icon files and the script that draws them, the packaging hook, and `installer.nsh`, the installer page that asks for the output folder and moves an install from the old folder. |

## Licence

Copyright © 2026 SCAFFApps. All rights reserved.

The released program is free to download and use. The source code is published for reference only; it may not be copied, changed or redistributed without written permission from SCAFFApps. See [LICENSE](LICENSE) for the full terms.
