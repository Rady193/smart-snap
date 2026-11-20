"""Makes the Smart Snap handbook: release/Smart-Snap-Handbook-<version>.pdf, its only copy (the name the SCAFFApps
Suite looks for; attached to the GitHub release).

    python handbook\\build_handbook.py              retake the pictures, then print
    python handbook\\build_handbook.py --no-shots   print with the pictures as they are
    python handbook\\build_handbook.py --preview    also a PNG of every page, in handbook\\preview

The pictures are taken from Smart Snap itself, run from this folder's source in a test profile of its own. Its snaps are
made from the sample site in handbook\\demo (never the real screen), and choosing an area is shown over a made-up desktop
(demo\\desktop.html) with the app's own selection page. Needs the app's node_modules (npm install), Python with
playwright, pillow and pypdfium2, and Microsoft Edge. The layout and every word are in handbook.html, in the SCAFFApps
brochure style; kit.py, brochure.css and handbook.css are the same in every SCAFFApps app.
"""
import argparse
import base64
import json
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(HERE))
import kit  # noqa: E402

IMG = HERE / "img"
INSTALLED = Path(r"C:\Program Files\SCAFFApps\Smart Snap\Smart Snap.exe")   # for the update offer, as users see it
EXAMPLE_FOLDER = r"C:\Users\Alex\Documents\Smart Snap"                      # shown instead of the test folder
EDGE = Path(r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe")
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]


def pad(r, p=14):
    return {"x": max(r["x"] - p, 0), "y": max(r["y"] - p, 0), "width": r["w"] + 2 * p, "height": r["h"] + 2 * p}


def union(*rs, p=14):
    x1, y1 = min(r["x"] for r in rs), min(r["y"] for r in rs)
    x2, y2 = max(r["x"] + r["w"] for r in rs), max(r["y"] + r["h"] for r in rs)
    return pad({"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1}, p)


# ------------------------------------------------------------------------------------------- the sample material
def sample_material(work, demo):
    """Three snaps of the sample site (area snaps, as if taken in a browser), and a made-up desktop for choosing an area."""
    from playwright.sync_api import sync_playwright
    out = {}
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        page = b.new_page(viewport={"width": 1280, "height": 800}, device_scale_factor=1.25)
        for name, path, clip in (("home", "", {"x": 0, "y": 0, "width": 1280, "height": 560}),
                                 ("orders", "orders.html", {"x": 0, "y": 52, "width": 820, "height": 420}),
                                 ("signin", "signin.html", {"x": 360, "y": 52, "width": 560, "height": 420})):
            page.goto(demo + path, wait_until="networkidle")
            page.wait_for_timeout(300)
            out[name] = work / f"snap-{name}.png"
            page.screenshot(path=str(out[name]), clip=clip)
        desk = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1.5)
        desk.goto(demo + "desktop.html", wait_until="networkidle")
        desk.wait_for_timeout(500)
        out["desktop"] = work / "desktop.png"
        desk.screenshot(path=str(out["desktop"]))
        b.close()
    return out


def edge_icon(work):
    """The browser's own icon, as Smart Snap keeps it with a snap (None when Edge is not there)."""
    if not EDGE.exists():
        return None
    png = work / "edge-icon.png"
    subprocess.run(["powershell", "-NoProfile", "-Command",
                    f"Add-Type -AssemblyName System.Drawing; [System.Drawing.Icon]::ExtractAssociatedIcon('{EDGE}').ToBitmap().Save('{png}')"],
                   capture_output=True)
    return png if png.exists() else None


def seed(profile, material, icon):
    """The snaps waiting in the test profile: two with a comment and a mark, one without."""
    from PIL import Image
    snaps = profile / "snaps"
    snaps.mkdir(parents=True, exist_ok=True)
    now = int(time.time() * 1000)
    edge = {"name": "Microsoft Edge", "process": "msedge.exe", "exe": str(EDGE), "company": "Microsoft Corporation",
            "version": "", "browser": True, "location": ""}
    rows = [("home", "Sample site - Microsoft Edge", "http://localhost:3000/",
             "The cards sit too close to the purple band: add some room above them.",
             {"type": "area", "x": 0.02, "y": 0.62, "w": 0.96, "h": 0.36}),
            ("orders", "Orders · Sample site - Microsoft Edge", "http://localhost:3000/orders.html",
             "Status: \"Ordered\" should stand out more than \"On site\".", {"type": "point", "x": 0.70, "y": 0.62}),
            ("signin", "Sign in · Sample site - Microsoft Edge", "http://localhost:3000/signin.html", "", None)]
    out = []
    for i, (name, title, url, text, mark) in enumerate(rows):
        sid = str(uuid.uuid4())
        shutil.copy(material[name], snaps / f"{sid}.png")
        if icon:
            shutil.copy(icon, snaps / f"{sid}-icon.png")
        w, h = Image.open(material[name]).size
        out.append({"id": sid, "time": now - (len(rows) - i) * 95_000, "mode": "area", "imgW": w, "imgH": h, "display": "Display 1",
                    "app": dict(edge, title=title, detectedUrl=url.replace("http://", "")), "url": url, "text": text,
                    "mark": mark, "hasIcon": bool(icon)})
    (snaps / "snaps.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


# ------------------------------------------------------------------------------------------- the pictures
# The selection page's bridge to Smart Snap (overlay-preload.js), stood in for: it is shown the made-up desktop as
# Smart Snap shows it the frozen screen (raw pixels, blue first), then revealed.
OVERLAY_BRIDGE = ("window.overlay = { onImage: (cb) => { window.__image = cb }, onWindows: () => {}, ready: () => {},"
                  " onReveal: (cb) => { window.__reveal = cb }, revealed: () => {}, done: () => {},"
                  " onComment: (cb) => { window.__comment = cb }, onApp: (cb) => { window.__app = cb }, commentDone: () => {},"
                  " spelling: async () => ({ mistakes: [] }),"
                  " onRecord: (cb) => { window.__record = cb }, record: () => {}, pointer: () => {} }")
FREEZE = """async ([src, windows, purpose]) => {
  const img = new Image(); img.src = src; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  for (let i = 0; i < d.length; i += 4) { const r = d[i]; d[i] = d[i + 2]; d[i + 2] = r; }
  window.__image({ pixels: new Uint8Array(d.buffer), width: c.width, height: c.height, scale: devicePixelRatio, windows, purpose });
  window.__reveal();
}"""


def overlay_pictures(material):
    """Choosing an area: the app's own selection page (app/overlay.html) over the made-up desktop, the window under the
    mouse outlined; then an area dragged and let go, with its comment being written in the box beside it."""
    from playwright.sync_api import sync_playwright
    src = "data:image/png;base64," + base64.b64encode(material["desktop"].read_bytes()).decode()
    wins = [{"x": 560, "y": 70, "w": 960, "h": 700, "title": "Sample site - Microsoft Edge"},
            {"x": 70, "y": 150, "w": 860, "h": 560, "title": "Orders · Sample site - Microsoft Edge"}]
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        page = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1.5)
        page.add_init_script(OVERLAY_BRIDGE)
        page.goto((ROOT / "app" / "overlay.html").as_uri())
        page.evaluate(FREEZE, [src, wins, "snap"])
        page.wait_for_timeout(500)
        page.mouse.move(1180, 420)
        page.wait_for_timeout(300)
        page.screenshot(path=str(IMG / "overlay-window.png"))
        # the area and its comment box in the light appearance (the handbook mixes the two)
        page.evaluate("document.documentElement.dataset.theme = 'light'")
        # (in this test browser a picture can be dragged away, which would end the selection's drag at once)
        page.evaluate("document.getElementById('shot').draggable = false")
        page.mouse.move(600, 430)
        page.mouse.down()
        page.mouse.move(900, 560, steps=8)
        page.mouse.move(1150, 690, steps=12)
        page.wait_for_timeout(200)
        page.mouse.up()
        page.evaluate("window.__comment({ area: null, number: 4 }); window.__app('Microsoft Edge')")
        page.keyboard.type("The cards sit too close together: add some room between them.")
        page.mouse.move(1300, 820)
        page.wait_for_timeout(400)
        page.screenshot(path=str(IMG / "overlay-area.png"))
        b.close()


def record_pictures(material):
    """Recording a video: the app's own selection page (app/overlay.html) over the made-up desktop, an area dragged and
    let go, with the bar asking for Start, the computer's sound on; then the same area recording, its time running."""
    from playwright.sync_api import sync_playwright
    src = "data:image/png;base64," + base64.b64encode(material["desktop"].read_bytes()).decode()
    with sync_playwright() as p:
        b = p.chromium.launch(channel="msedge", headless=True)
        page = b.new_page(viewport={"width": 1600, "height": 900}, device_scale_factor=1.5)
        # (the page's clock can be put forward, so the time reads as it does a while into a recording)
        page.add_init_script("(() => { const now = performance.now.bind(performance); window.__ahead = 0;"
                             " performance.now = () => now() + window.__ahead; })();" + OVERLAY_BRIDGE)
        page.goto((ROOT / "app" / "overlay.html").as_uri())
        page.evaluate(FREEZE, [src, [], "record"])
        page.wait_for_timeout(500)
        page.evaluate("document.getElementById('shot').draggable = false")
        page.mouse.move(610, 190)
        page.mouse.down()
        page.mouse.move(1000, 450, steps=8)
        page.mouse.move(1470, 690, steps=12)
        page.wait_for_timeout(200)
        page.mouse.up()
        page.evaluate("window.__record({ stage: 'ready', sound: { system: true, mic: false } })")
        page.mouse.move(1560, 880)
        page.wait_for_timeout(400)
        page.screenshot(path=str(IMG / "record-ready.png"))
        # recording, in the light appearance (the handbook mixes the two)
        page.evaluate("document.documentElement.dataset.theme = 'light'")
        page.evaluate("window.__record({ stage: 'recording', sound: { system: true, mic: false } }); window.__ahead = 42000")
        page.wait_for_timeout(600)
        page.screenshot(path=str(IMG / "record-live.png"))
        b.close()


def main_session(work, material, icon, api):
    env = kit.registration(work / "registration.json", "smart-snap", VERSION)
    env.update(SMART_SNAP_OUTPUT_DIR=str(work / "out"), SMART_SNAP_UPDATE_API=api)
    profile = work / "profile"
    seed(profile, material, icon)
    port = kit.free_port()
    proc = kit.start_electron(ROOT, profile, port, env)
    try:
        w = kit.window(port, "index.html")
        w.front()
        time.sleep(2)
        w.js("document.querySelectorAll('#list li')[0].click()")
        time.sleep(1)
        # the pictures in both appearances, mixed through the handbook
        w.shot(IMG / "main-dark.png")
        top = w.rect("#report-btn")
        w.shot(IMG / "bar.png", {"x": 0, "y": 0, "width": w.js("innerWidth"), "height": top["y"] + top["h"] + 12})
        w.js("document.getElementById('theme-btn').click()")
        time.sleep(0.8)
        w.js("document.querySelectorAll('#list li')[1].click()")
        time.sleep(0.8)
        w.shot(IMG / "main-light.png")
        w.js("document.querySelectorAll('#list li')[0].click()")
        time.sleep(0.6)
        w.shot(IMG / "details.png", union(w.rect("#app-icon"), w.rect("#app-title"), w.rect("#link"), w.rect("#taken"), p=12))
        w.js("document.getElementById('theme-btn').click()")
        time.sleep(0.8)

        # the report: the form, then the PDF (the snaps kept, for the pictures that follow)
        w.click("#report-btn")
        w.wait("document.getElementById('report-dlg').open")
        time.sleep(0.6)
        w.js("document.getElementById('r-title').value = 'Website review'; document.getElementById('r-author').value = 'Alex Morgan';"
             "document.getElementById('r-keep').checked = true; true")
        w.shot(IMG / "report-dialog.png", pad(w.rect("#report-dlg"), 16))
        w.click("#r-create")
        reports, end = [], time.time() + 60
        while time.time() < end and not reports:
            time.sleep(1)
            reports = sorted((work / "out" / "Reports").glob("*.pdf")) if (work / "out" / "Reports").exists() else []
        if reports:
            time.sleep(1.5)
            kit.pdf_page_png(reports[-1], IMG / "report-page1.png", 0, 1400)
            kit.pdf_page_png(reports[-1], IMG / "report-page2.png", 1, 1400)
            from PIL import Image                 # the details at the foot of a snap's section, on their own
            pg = Image.open(IMG / "report-page2.png")
            pg.crop((int(pg.width * .08), int(pg.height * .472), int(pg.width * .93), int(pg.height * .64))).save(IMG / "report-details.png")
        else:
            print("!! no report was made")
        w.js("document.getElementById('toast') && (document.getElementById('toast').hidden = true)")

        # settings (light): the test folder shown as an example one; no warning about shortcuts this test copy shares
        # with the Smart Snap already running on this computer
        w.js("document.getElementById('theme-btn').click()")
        time.sleep(0.8)
        w.click("#settings-btn")
        w.wait("document.getElementById('settings-dlg').open")
        time.sleep(1)
        w.replace_text(str(work / "out"), EXAMPLE_FOLDER)
        w.js("document.getElementById('s-problems').hidden = true")
        w.shot(IMG / "settings.png", pad(w.rect("#settings-dlg"), 16))
        w.close()
    finally:
        kit.stop(proc)


def update_session(work):
    """A newer version on a stand-in for GitHub: what Settings shows when an update is waiting, from the installed copy
    when there is one (it offers Update now; a copy run from source can only point to the release)."""
    # The example offer: the next minor version, newer than the installed copy even when this release is
    # installed already (a fixed number, or this version, would then read "You have the latest version").
    major, minor = VERSION.split(".")[:2]
    example = f"{major}.{int(minor) + 1}.0"
    rel = kit.release(work / "release", example, "Smart Snap", f"Smart-Snap-Setup-{example}.exe")
    with kit.Serve(rel) as api:
        env = kit.registration(work / "registration.json", "smart-snap", VERSION)
        env.update(SMART_SNAP_OUTPUT_DIR=str(work / "out"), SMART_SNAP_UPDATE_API=api.url + "latest")
        port = kit.free_port()
        if INSTALLED.exists():
            proc = kit.start_exe(INSTALLED, work / "profile-update", port, env)
        else:
            print("!! Smart Snap is not installed: the update picture shows the copy run from source")
            proc = kit.start_electron(ROOT, work / "profile-update", port, env)
        try:
            w = kit.window(port, "index.html")
            w.front()
            time.sleep(8)
            w.shot(IMG / "toolbar-dot.png", union(w.rect("#report-btn"), w.rect("#theme-btn"), p=10))   # the gold dot
            w.js("document.getElementById('theme-btn').click()")              # the update offer: light
            time.sleep(0.8)
            w.click("#settings-btn")
            w.wait("document.getElementById('settings-dlg').open")
            time.sleep(1.2)
            w.js("document.getElementById('s-updates').scrollIntoView()")
            time.sleep(0.4)
            w.shot(IMG / "updates.png", pad(w.rect("#s-updates"), 12))
            w.close()
        finally:
            kit.stop(proc)


def signup_session(work):
    """The first start on a Windows account: the sign-up window."""
    env = kit.registration(work / "registration-new.json", "smart-snap", VERSION, registered=False)
    env.update(SMART_SNAP_OUTPUT_DIR=str(work / "out"), SMART_SNAP_UPDATE_API="http://127.0.0.1:1/")
    port = kit.free_port()
    proc = kit.start_electron(ROOT, work / "profile-new", port, env)
    try:
        w = kit.window(port, "registration.html")
        w.front()
        time.sleep(1)
        w.shot(IMG / "signup.png")
        # signed up (test details, nothing sent): the window before the first snap
        w.js("document.getElementById('name').value = 'Alex Morgan'; document.getElementById('email').value = 'alex@example.com';"
             "document.getElementById('form').requestSubmit(); true")
        w.close()
        time.sleep(2.5)
        w = kit.window(port, "index.html")
        w.front()
        time.sleep(1.5)
        w.js("document.getElementById('theme-btn').click()")              # before the first snap: light
        time.sleep(0.8)
        w.shot(IMG / "empty.png")
        w.close()
    finally:
        kit.stop(proc)


def shots(only=None):
    work = Path(tempfile.mkdtemp(prefix="ss-handbook-"))
    try:
        current = kit.release(work / "current", VERSION, "Smart Snap")       # GitHub, saying this is the newest
        with kit.Serve(HERE / "demo", 3000) as demo, kit.Serve(current) as api:
            material = sample_material(work, demo.url)
            icon = edge_icon(work)
            for name, run in [("overlay", lambda: overlay_pictures(material)), ("record", lambda: record_pictures(material)),
                              ("main", lambda: main_session(work, material, icon, api.url + "latest")),
                              ("update", lambda: update_session(work)), ("signup", lambda: signup_session(work)),
                              # the back cover, the same in every SCAFFApps handbook: the apps' icons, the Suite's views
                              ("family", lambda: (kit.family_icons(IMG, ROOT.parent), kit.suite_pictures(IMG, ROOT.parent)))]:
                if only and name not in only:
                    continue
                print(f"pictures: {name}", flush=True)
                run()
    finally:
        shutil.rmtree(work, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-shots", action="store_true")
    ap.add_argument("--only", nargs="*", help="overlay, record, main, update, signup, family")
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--chromium", help="a Chromium to print with, instead of Edge")
    a = ap.parse_args()
    if not a.no_shots:
        shots(a.only)
    # printed in handbook/build (never open anywhere), then moved into release/, named for the release: the only
    # copy (the name the SCAFFApps Suite looks for, attached to the GitHub release)
    (HERE / "build").mkdir(exist_ok=True)
    pdf = kit.print_pdf(HERE / "handbook.html", HERE / "build" / "Smart Snap Handbook.pdf",
                        HERE / "preview" if a.preview else None, chromium=a.chromium)
    kit.to_release(pdf, ROOT / "release" / f"Smart-Snap-Handbook-{VERSION}.pdf")
    # release/ keeps only the newest handbook; the earlier ones stay on their GitHub releases
    newest = tuple(int(x) for x in VERSION.split("."))
    for old in (ROOT / "release").glob("Smart-Snap-Handbook-*.pdf"):
        v = old.stem.rsplit("-", 1)[-1]
        if v.replace(".", "").isdigit() and tuple(int(x) for x in v.split(".")) < newest:
            old.unlink(missing_ok=True)
            print(f"removed the older {old.name}")


if __name__ == "__main__":
    main()
