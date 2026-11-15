# Smart Snap window helper. Started once by main.js and kept running, so each
# snap does not pay PowerShell's start-up time.
#
# Reads one command per line on standard input and answers each with one line
# of JSON on standard output:
#
#   snapshot      the visible top-level windows, topmost first, and which one
#                 is in front (taken the moment a snap starts)
#   info <hwnd>   details of one window: application name, program file, window
#                 title, and the page address when the window is a web browser
#                 (or the folder, for File Explorer)
#
# Positions are in physical screen pixels (the script is DPI-aware).
param([int]$OwnPid = 0)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding $false

Add-Type -ReferencedAssemblies UIAutomationClient, UIAutomationTypes, WindowsBase -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Windows.Automation;

public class SnapWin {
  public long Hwnd; public int Pid; public string Title; public string Class;
  public int X; public int Y; public int W; public int H;
}

public static class SnapNative {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L, T, R, B; }
  delegate bool EnumProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumChildWindows(IntPtr h, EnumProc f, IntPtr p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
  [DllImport("user32.dll")] static extern int GetWindowLong(IntPtr h, int i);
  [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out int pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out RECT r, int size);
  [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h, int a, out int v, int size);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool QueryFullProcessImageName(IntPtr h, int flags, StringBuilder s, ref int size);

  // Windows that are part of the desktop itself, never "the application".
  static readonly string[] ShellClasses = { "Progman", "WorkerW", "Shell_TrayWnd", "Shell_SecondaryTrayWnd", "NotifyIconOverflowWindow", "TopLevelWindowForOverflowXamlIsland", "XamlExplorerHostIslandWindow", "Windows.UI.Core.CoreWindow" };

  public static void DpiAware() {
    try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch { }
  }

  public static string Text(IntPtr h) { var s = new StringBuilder(1024); GetWindowText(h, s, s.Capacity); return s.ToString(); }
  public static string ClassOf(IntPtr h) { var s = new StringBuilder(256); GetClassName(h, s, s.Capacity); return s.ToString(); }
  public static int PidOf(IntPtr h) { int p; GetWindowThreadProcessId(h, out p); return p; }

  // The window's outline as drawn on screen, without the invisible resize border.
  public static RECT Bounds(IntPtr h) {
    RECT r;
    if (DwmGetWindowAttribute(h, 9, out r, Marshal.SizeOf(typeof(RECT))) != 0) GetWindowRect(h, out r);
    return r;
  }

  static bool Cloaked(IntPtr h) {
    int v;
    return DwmGetWindowAttribute(h, 14, out v, 4) == 0 && v != 0;
  }

  public static bool IsShell(string cls) { return Array.IndexOf(ShellClasses, cls) >= 0; }

  public static List<SnapWin> Visible(int ownPid) {
    var list = new List<SnapWin>();
    EnumWindows((h, p) => {
      if (!IsWindowVisible(h) || IsIconic(h) || Cloaked(h)) return true;
      int pid = PidOf(h);
      if (pid == ownPid) return true;
      string cls = ClassOf(h);
      if (IsShell(cls)) return true;
      // Tool windows without a title are tooltips, menus and shadows.
      bool tool = (GetWindowLong(h, -20) & 0x80) != 0;
      string title = Text(h);
      if (tool && title.Length == 0) return true;
      RECT r = Bounds(h);
      if (r.R - r.L < 40 || r.B - r.T < 40) return true;
      list.Add(new SnapWin { Hwnd = h.ToInt64(), Pid = pid, Title = title, Class = cls, X = r.L, Y = r.T, W = r.R - r.L, H = r.B - r.T });
      return true;
    }, IntPtr.Zero);
    return list;
  }

  public static long Foreground() {
    IntPtr h = GetForegroundWindow();
    if (h == IntPtr.Zero) return 0;
    IntPtr root = GetAncestor(h, 2);
    return (root == IntPtr.Zero ? h : root).ToInt64();
  }

  public static bool Exists(long h) { return IsWindow(new IntPtr(h)); }

  public static string ExePath(int pid) {
    IntPtr p = OpenProcess(0x1000, false, pid);
    if (p == IntPtr.Zero) return "";
    try {
      var s = new StringBuilder(1024); int n = s.Capacity;
      return QueryFullProcessImageName(p, 0, s, ref n) ? s.ToString() : "";
    } finally { CloseHandle(p); }
  }

  // Store apps are hosted by ApplicationFrameHost; the real app owns a child window.
  public static int HostedPid(IntPtr h, int framePid) {
    int found = 0;
    EnumChildWindows(h, (c, p) => {
      int pid = PidOf(c);
      if (pid != framePid) { found = pid; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }

  static readonly string[] Chromium = { "chrome", "msedge", "brave", "opera", "opera_gx", "vivaldi", "chromium", "yandex", "browser", "thorium", "arc", "comet", "dia" };
  static readonly string[] Gecko = { "firefox", "waterfox", "librewolf", "floorp", "zen", "palemoon", "tor" };

  public static bool IsBrowser(string process) {
    string p = process.ToLowerInvariant();
    return Array.IndexOf(Chromium, p) >= 0 || Array.IndexOf(Gecko, p) >= 0;
  }

  // The address shown in a browser's address bar, read through UI Automation.
  // Given at most `ms` milliseconds, so a busy browser cannot hold up a snap.
  public static string BrowserUrl(long hwnd, string process, int ms) {
    string result = "";
    string p = process.ToLowerInvariant();
    bool gecko = Array.IndexOf(Gecko, p) >= 0;
    var t = new Thread(() => {
      try {
        var root = AutomationElement.FromHandle(new IntPtr(hwnd));
        AutomationElement bar = null;
        if (gecko) {
          bar = root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.AutomationIdProperty, "urlbar-input"));
        } else {
          // The address bar is the first text box in the browser's own toolbar,
          // which comes before the page in the tree.
          bar = root.FindFirst(TreeScope.Descendants, new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Edit));
        }
        if (bar == null) return;
        object pattern;
        if (bar.TryGetCurrentPattern(ValuePattern.Pattern, out pattern)) result = ((ValuePattern)pattern).Current.Value ?? "";
      } catch { }
    });
    t.IsBackground = true;
    t.SetApartmentState(ApartmentState.MTA);
    t.Start();
    t.Join(ms);
    return result;
  }
}
'@

[SnapNative]::DpiAware()
$shellApp = $null

function Get-Snapshot {
  $wins = [SnapNative]::Visible($OwnPid)
  $fg = [SnapNative]::Foreground()
  # The window in front may be the taskbar, the desktop, or Smart Snap itself;
  # then the topmost ordinary window stands in for it.
  $front = $wins | Where-Object { $_.Hwnd -eq $fg } | Select-Object -First 1
  if (-not $front) { $front = $wins | Select-Object -First 1 }
  [ordered]@{
    foreground = if ($front) { $front.Hwnd } else { 0 }
    windows = @($wins | ForEach-Object { [ordered]@{ hwnd = $_.Hwnd; pid = $_.Pid; title = $_.Title; x = $_.X; y = $_.Y; w = $_.W; h = $_.H } })
  }
}

function Get-Info([long]$hwnd) {
  if (-not [SnapNative]::Exists($hwnd)) { return @{ error = 'gone' } }
  $h = [IntPtr]$hwnd
  $procId = [SnapNative]::PidOf($h)
  $exe = [SnapNative]::ExePath($procId)
  if ($exe -match '\\ApplicationFrameHost\.exe$') {
    $hosted = [SnapNative]::HostedPid($h, $procId)
    if ($hosted) { $procId = $hosted; $exe = [SnapNative]::ExePath($procId) }
  }
  $process = if ($exe) { [IO.Path]::GetFileNameWithoutExtension($exe) } else { '' }
  if (-not $process) { try { $process = (Get-Process -Id $procId).ProcessName } catch { } }
  $name = ''; $company = ''; $version = ''
  if ($exe) {
    try {
      $v = [Diagnostics.FileVersionInfo]::GetVersionInfo($exe)
      $name = ($v.FileDescription, $v.ProductName | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1)
      $company = $v.CompanyName; $version = $v.ProductVersion
    } catch { }
  }
  if (-not $name) { $name = $process }
  $r = [SnapNative]::Bounds($h)
  $info = [ordered]@{
    hwnd = $hwnd; pid = $procId; process = $process; exe = $exe
    name = "$name".Trim(); company = "$company".Trim(); version = "$version".Trim()
    title = [SnapNative]::Text($h)
    x = $r.L; y = $r.T; w = $r.R - $r.L; h = $r.B - $r.T
    url = ''; location = ''; browser = $false
  }
  if ($process -and [SnapNative]::IsBrowser($process)) {
    $info.browser = $true
    $info.url = [SnapNative]::BrowserUrl($hwnd, $process, 2500)
  } elseif ($process -eq 'explorer') {
    try {
      if (-not $shellApp) { $script:shellApp = New-Object -ComObject Shell.Application }
      foreach ($w in $shellApp.Windows()) {
        if ([long]$w.HWND -eq $hwnd) { $info.location = $w.Document.Folder.Self.Path; break }
      }
    } catch { }
  }
  $info
}

[Console]::Out.WriteLine('{"ready":true}')
[Console]::Out.Flush()

while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break }
  $line = $line.Trim()
  try {
    if ($line -eq 'snapshot') { $out = Get-Snapshot }
    elseif ($line -match '^info (\d+)$') { $out = Get-Info ([long]$Matches[1]) }
    elseif ($line -eq 'quit') { break }
    else { $out = @{ error = 'unknown command' } }
  } catch {
    $out = @{ error = "$($_.Exception.Message)" }
  }
  [Console]::Out.WriteLine(($out | ConvertTo-Json -Compress -Depth 4))
  [Console]::Out.Flush()
}
