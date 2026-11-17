# Release notes

## 1.3.0 — 18 November 2026

Record a video of an area, a window or the whole screen: it remembers where it came from, as a snap does.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.3.0.exe` | 71.1 MB | `827448D0B0A39CB46D895CE940F41FE996EE2D18AA5BB9A45BC0D7959DCA429A` |
| `Smart-Snap-Handbook-1.3.0.pdf` | 4.3 MB | `5B86DE62A3B7B86F5E546BAF19461E4AFB27C0474EB89AAE55E327C670C9D500` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Added

- **Record a video.** **Record** in the bar, **Ctrl + Alt + R** anywhere, or **Record a video** in the tray menu. The area is chosen as for an area snap: drag an area, click a window, or Enter for the whole display. A bar beside it offers **Computer sound** and **Microphone** (remembered for the next video), then **Start recording** (or Enter), which counts down three seconds. While it records, the area is outlined in red and the bar shows the time, with **Pause** / **Resume**, **Stop** and **Discard** (two clicks). The outline and the bar are never in the video, and the mouse goes through to your programs everywhere except on the bar. **Stop**, Ctrl + Alt + R again or **Stop recording** in the tray menu ends it.
- **The comment box after a video**, as after an area snap: **Enter** (or **Save**) keeps the video with its comment and copies the video file to the clipboard, to paste into a chat, an email or a folder; **Save and open** opens Smart Snap on it; **Esc** (or **Discard**) throws it away, its file to the Recycle Bin.
- **MP4 videos in a new Recordings folder** in the output folder (H.264 and AAC sound, at the area's own resolution, 30 frames a second), named after the application and the time. An area larger than 4096 × 2304 pixels is saved as WebM.
- **A video is a snap**: in the list with its first picture and its length, and with the application, window, link and comment a snap has. It plays in Smart Snap's window, where **Copy video** and **Show in folder** take the place of Copy picture and Save as PNG; **Delete** moves its file to the Recycle Bin. In the PDF report (and Copy as picture) it is its first picture, with a play sign and its length, opening the video file; the details name the file and its sound.
- **Quitting while recording** (from the tray, or for an update) saves the video first.

### Changed

- **The window opens 1400 pixels wide** where the screen allows (it was 1280), so the bar, with Record added, still shows every shortcut beside its button. In a narrower window the shortcuts leave the buttons first, as before, then the words of Copy as picture, then Record's word.
- **The list is headed "Snaps"**, as it holds videos too.
- **The handbook**, `Smart-Snap-Handbook-1.3.0.pdf`: a new chapter, Recording a video, with its pictures; the window's pictures retaken with Record in the bar; Ctrl + Alt + R and the Recordings folder where they belong. 13 pages.

### Updating from 1.2.4 or earlier

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- From the source code in a test profile, at 150 % display scaling, recording only an area covered by a test pattern (red, green, blue and yellow quarters and a moving white bar): the MP4 (H.264 and AAC) is 932 × 512 pixels, the area's own size; its four quarters and all four corner pixels are the pattern's colours at the start, the middle and the end, so the area is cut exactly, and the video's first picture is the same.
- Pause and Resume: 2 seconds, a 1-second pause, 2 more seconds give a video of about 4 seconds without the pause (3.7 to 4.0 s across the test runs). The bar's time, the comment box, the list and the player agree on its length.
- Sound: with Computer sound alone and nothing playing, the sound runs the whole video (3.75 s of sound for 3.73 s of picture). With Chromium's test microphone as well, the two are mixed into one stereo track that carries the test tone.
- Stop opens the comment box ("Video 1 · 0:04 · Electron"). Save and open keeps the comment and opens Smart Snap on the video, which plays; the list shows its first picture and length; Copy video and Show in folder are there, the mark bar is not.
- The PDF report: the video's section with its first picture, the play sign, its length, the file name as a link and "sound from the computer"; the summary tags it "Video 0:04" and counts "1 video".
- Discard while recording (two clicks): no snap, nothing in Recordings, no part file left behind.
- Quit from the tray's code while recording: the video and its snap are saved, then Smart Snap closes.
- Delete on a video that Smart Snap's player has open: its file goes to the Recycle Bin, and the window says so.
- The window helper's new command puts a file on the clipboard as Explorer's Copy does (read back as a file list); it refuses a file that does not exist.
- The area snap's selection page after the changes: the hint, dragging an area, the comment box, Enter saving, and clicking a window, as in 1.2.4.
- The bar at every window width from 820 to 1400 pixels: nothing runs past its right edge; at 1400 every shortcut shows.
- The packaged program starts as 1.3.0 with Record and its shortcut. Microsoft Defender finds nothing in the installer.

### Not tested

- **Recording driven by the real keyboard and mouse.** Enter and Ctrl + Alt + R were not pressed (the tests called the function the keys call), Enter in the comment box (which copies the video file) was not used, so as to leave the clipboard alone, and a real mouse going through the overlay to the program underneath, and back onto the bar, was not driven: tests do not take over the keyboard and mouse of a computer in use.
- A real microphone, Windows' microphone setting switched off, more than one display, displays at different scales, an area larger than 4096 × 2304 (WebM), long recordings, and Windows 10 before version 2004 (where the outline and bar are hidden while recording).
- This installer over 1.2.4.

## 1.2.4 — 17 November 2026

Every snapped program shows its own icon, the SCAFFApps apps' included.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.2.4.exe` | 71.1 MB | `AA90E57D04595B32735DF82E70D2D06C758D3631F6B459EEF43D341E0FD7238E` |
| `Smart-Snap-Handbook-1.2.4.pdf` | 3.7 MB | `25B04E8FD869F02367159FD1277AB965F9B1BE5D3BE087EEB8C4B040FAEA05C9` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Fixed

- **A snap of a program whose icon is stored as PNG pictures now shows that program's icon**, not Windows' plain program icon. This includes the SCAFFApps Suite, Smart Snap, Instant Share, Multi Screens and many other programs, and it applies in the list, in the snap's details, in the PDF report and in Copy as picture. Windows now draws the icon, as Explorer and the taskbar do, at 64 pixels so it stays sharp in print. The icon reader built into Smart Snap's engine (Chromium) cannot read PNG icons and handed back the plain one; it is now used only when Windows cannot answer. Snaps taken before this version keep the icon they were saved with.

### Changed

- **The handbook**, `Smart-Snap-Handbook-1.2.4.pdf`: 1.2.3's pages and pictures, unchanged.

### Updating from 1.2.3 or earlier

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- Smart Snap's window helper asked for the icons of the SCAFFApps Suite, Smart Snap, Instant Share, Multi Screens, Microsoft Edge and Notepad: each came back as the program's own icon, 64 × 64 with transparent corners. A program without an icon (curl.exe) and a missing file answer with nothing.
- Smart Snap's own code for this (starting the helper, asking it, the fallback), run in a signed-in Windows session: the SCAFFApps Suite, Smart Snap and Edge got their own icons. The first answer took about 0.3 s while the helper started, later ones about 2 ms. Programs without an icon still got Windows' plain icon from the fallback.
- The cause, proven: the same SCAFFApps Suite program file was stamped once with bitmap icon pictures and once with PNG ones. Chromium's reader gave the real icon for the first and the plain one for the second.
- Installed over 1.2.3 on a working computer the way the SCAFFApps Suite updates it (silently, with Windows' permission): Windows lists 1.2.4, Smart Snap opened again, and its window helper runs with the new icon command.
- Microsoft Defender finds nothing in the installer.

### Not tested

- **A real snap of a SCAFFApps app after updating** was not driven by a test (tests never snap the screen of the computer they run on); it saves through the same code tested above.

## 1.2.3 — 16 November 2026

Enter copies the snap as a picture, and the report's pictures stay inside their cards.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.2.3.exe` | 71.1 MB | `9E7E89C985BF7A3AEB5744696F6E04979546C63C812B505056AD3FE34621312D` |
| `Smart-Snap-Handbook-1.2.3.pdf` | 3.7 MB | `13914E3C59889D35EEF96178FFA1D8D8FC8B51AFC858655131888827603F66C2` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### New

- **Enter in the comment box also copies the snap as a picture.** Enter (or Save) keeps the snap with its comment, as before, and puts that one snap on the clipboard as a picture: its part of the report alone (number, application, comment, screenshot, close-up and details), ready to paste into a chat, an email or a document. It is there about a second later; the next snap can start at once, and when several are saved one after another the last one saved is left on the clipboard. The box says so ("Enter saves and copies it as a picture"), and Smart Snap's window, when it is open, says "Snap N copied as a picture". **Save and open** and **Discard** copy nothing.

### Fixed

- **A wide screenshot no longer runs past the right edge of its card** in the PDF report and in Copy as picture. Screenshots are drawn at most 171 mm wide, the room inside the card; wide ones are about 6% smaller than in 1.2.2, small ones are unchanged.

### Changed

- **Copy as picture** in the bar and in the report form still copies the whole report, every snap.
- **The handbook**, `Smart-Snap-Handbook-1.2.3.pdf`: Enter in the comment box, and the report pages and the comment box pictured again.

### Updating from 1.2.2 or earlier

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- The one-snap picture and the whole report's picture drawn by Smart Snap's own report code from sample snaps: the one-snap picture holds that snap alone, as tall as its card; a snap removed before its turn copies nothing; the whole report copied twice in a row gives the same picture both times; the PDF's pages keep every screenshot inside its card.
- Installed over 1.2.2 on a working computer the way the SCAFFApps Suite updates it (silently, with Windows' permission): Windows lists 1.2.3, Smart Snap opened again and holds the Print Screen key.
- Microsoft Defender finds nothing in the installer.

### Not tested

- **Enter pressed in the comment box after a real snap** was not driven by a test (tests never snap the screen of the computer they run on); it saves through the same path as before, then draws the picture tested above.

## 1.2.2 — 16 November 2026

In step with the other SCAFFApps apps: Quit Smart Snap, and the keyboard's place shown.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.2.2.exe` | 71.1 MB | `EEC01E2CFE05E2C8C01EFA4D155FEA135706917EAB77107B5D19F8C51E5729AF` |
| `Smart-Snap-Handbook-1.2.2.pdf` | 3.7 MB | `56DA5995AE32F6DF91AAEC015021FD118C1AFA88065DCE6FD6F1B7525D8E4C2D` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **The tray menu's last item is "Quit Smart Snap"**, the way Instant Share and the SCAFFApps Suite name themselves in theirs.
- **Moving with Tab shows where you are**: a gold ring (purple in the light appearance) round the button or box, as in the other SCAFFApps apps; never on a click.
- **The appearance button says what it does**: "Switch to light appearance" or "Switch to dark appearance".
- **The handbook**, `Smart-Snap-Handbook-1.2.2.pdf`: 1.2.1's pages and pictures, with Quit Smart Snap.

### Updating from 1.2.1 or earlier

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- The SCAFFApps design-language check: colours, scrollbars, the focus ring, the title bar, the appearance button, the tray menu and its Quit, the shared files.
- Installed over 1.2.1 on a working computer the way the SCAFFApps Suite updates it (silently, with Windows' permission): Windows lists 1.2.2 and Smart Snap opened again.
- Microsoft Defender finds nothing in the installer.

## 1.2.1 — 16 November 2026

The Print Screen key really snaps an area.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.2.1.exe` | 78.0 MB | `DC4B20973834D8B7EC9C088FAA8DDA9FCEEF6990331B80ACD6C36BAA91BCCE0F` |
| `Smart-Snap-Handbook-1.2.1.pdf` | 3.7 MB | `B4F260D24D2D965048EC1D16F2B810DEC3955FBE9F8D7C1BAF5EBE44E24F5003` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Fixed

- **Print Screen snaps an area.** In 1.2.0 the key did nothing: Electron accepted it as a shortcut but never asked Windows for it. Smart Snap now claims the key from Windows itself, as other screenshot programs do, and gives it back when it quits. If another program has the key, Smart Snap asks for it again a few times (an older copy may still be closing after an update), and Settings names the key as taken.

### Changed

- **The handbook**, `Smart-Snap-Handbook-1.2.1.pdf`: 1.2.0's pages, which already describe Print Screen, with its pictures retaken, mixed between the dark and light appearance, and the SCAFFApps Suite on the back page as it is in 1.0.3.

### Updating from 1.2.0 or 1.1.5

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- Installed on a working computer: Windows lists 1.2.1, and Smart Snap holds the Print Screen key (Windows gave it the key, and it keeps it while it runs).
- Microsoft Defender finds nothing in the installer.

### Not tested

- **Print Screen pressed on a keyboard** was not driven by a test: it takes the same path as Ctrl + Alt + S.

## 1.2.0 — 16 November 2026

Print Screen snaps an area, and a pin keeps the window on top.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.2.0.exe` | 78.0 MB | `0F0067B2123725FCF3FE809EA075A1FC28386035A1ACE489F019B829F14CF6C8` |
| `Smart-Snap-Handbook-1.2.0.pdf` | 3.6 MB | `F97B9327983889790E71621CC9F6A6700B4FD560B39C927A6D4BE245ABF14D96` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Added

- **Print Screen snaps an area**, as Ctrl + Alt + S does, in every program. Windows 11 gives the key to its Snipping Tool first: turn off **Use the Print screen key to open screen capture** in Windows Settings > Accessibility > Keyboard. Smart Snap's Settings says when it is on and opens that page. A switch there leaves the key to Windows or another program.
- **Keep on top**: the pin in the bar keeps the Smart Snap window above other programs until you click it again, and is remembered. The window is never in a snap: it steps aside while the picture is taken and comes back afterwards.

### Changed

- **The handbook**, `Smart-Snap-Handbook-1.2.0.pdf`, with Print Screen and the pin.

### Updating from 1.1.5

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- From the source code in a test profile: Settings finds Windows' Print Screen setting on, and shows its notice; once it is off, the notice goes (the handbook's Settings picture). The switch gives the key back and takes it again. The pin sets and clears "always on top" and is remembered.
- Pinned, with another program in front: a full-screen snap hides the window while it is taken, and it comes back, still on top.
- 1.2.0 installed offers a newer version (the handbook's update picture). This installer over 1.1.5 on a working computer, Smart Snap quit from the tray first: installed in 5 seconds, Windows lists 1.2.0, and it starts in the tray again.
- Microsoft Defender finds nothing in the installer.

### Not tested

- **Print Screen pressed on a keyboard**, and an area snap with the window pinned: while an area is being chosen, Smart Snap takes Esc and Enter for the whole system, so these were not driven on a computer in use. They take the same paths as Ctrl + Alt + S and the full-screen snap above.

## 1.1.5 — 16 November 2026

Enter saves the comment, the comment box opens at once, Copy as picture in the bar, and sharper snaps.

### Downloads

| File | Size | SHA-256 |
|---|---|---|
| `Smart-Snap-Setup-1.1.5.exe` | 78.0 MB | `BDA944D3A875EB3C11729CBFC4620DE1E0E4A56040FDFA985C05A43451724378` |
| `Smart-Snap-Handbook-1.1.5.pdf` | 3.6 MB | `EE0A9408B5769103EDFF092E91D7E2B1CB9A202A983031068F8CFDA19565D725` |

For 64-bit Windows 10 and 11. Not code-signed, so Windows SmartScreen may ask for confirmation on first run.

### Changed

- **Enter saves the comment**; Shift + Enter starts a new line.
- **The comment box opens the moment you let go** of the mouse (it waited about half a second for the picture before); the picture is taken meanwhile.
- **Copy as picture in the bar**, beside Create PDF report: the whole report on the clipboard as one picture, with the title and name last typed in the report form.
- **A narrow window**: the bar's shortcut labels make way first, then Copy as picture keeps only its icon, so the bar fits down to the smallest window.

### Fixed

- **A faint light edge around area snaps** (1.1.4): the selection, meant to be left out of the picture, was not, because Windows ignores that setting for a window not yet on screen. It is now set once the window shows.
- **Slightly stretched snaps on a scaled display**: a 2560 × 1600 display at 150% came out 2562 × 1601, a little soft, because every display was captured at one shared size and Electron rounds a scaled size. Each display is now captured at its own exact size, and only the display being snapped.

### Updating from 1.1.4

- Settings > Updates > **Update now**, or **Update** in the SCAFFApps Suite.

### Tested

- The packaged app on two displays (2560 × 1600 at 150% and 3440 × 1440), each covered by a test window of coded colours: a live area, a frozen area and a full-screen snap on each were exact, pixel for pixel, with nothing of the selection or the comment box in them.
- With the real mouse and keyboard on both displays: a comment typed over two lines (Shift + Enter) and saved with Enter; the box appeared about 20 ms after the release.
- Copy as picture, from the bar and from the report form; Create report.
- Microsoft Defender finds nothing in the installer.

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
