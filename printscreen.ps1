# Smart Snap's Print Screen key. Started by main.js while "Use the Print Screen
# key" is on in Settings.
#
# Electron accepts "PrintScreen" as a shortcut but never asks Windows for it, so
# the key is claimed here instead, as other screenshot programs do: a system-wide
# hotkey for Print Screen alone. Writes one line on standard output:
#
#   ready     the key is Smart Snap's
#   held      another program has it already
#   pressed   each time the key is pressed
#
# Ends when its standard input closes: when Smart Snap quits, ends or is
# stopped. Windows then gives the key back.
$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public static class SnapPrintScreen {
  [StructLayout(LayoutKind.Sequential)]
  struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public int x; public int y; }

  [DllImport("user32.dll", SetLastError = true)] static extern bool RegisterHotKey(IntPtr hWnd, int id, uint modifiers, uint vk);
  [DllImport("user32.dll")] static extern bool UnregisterHotKey(IntPtr hWnd, int id);
  [DllImport("user32.dll")] static extern int GetMessage(out MSG msg, IntPtr hWnd, uint min, uint max);

  const uint MOD_NOREPEAT = 0x4000;   // one press, one snap, however long the key is held
  const uint VK_SNAPSHOT = 0x2C;      // Print Screen
  const uint WM_HOTKEY = 0x0312;

  public static void Run() {
    // Smart Snap closes this program's input when it quits or ends: stop then.
    Thread watch = new Thread(() => {
      try { while (Console.In.ReadLine() != null) { } } catch { }
      Environment.Exit(0);
    });
    watch.IsBackground = true;
    watch.Start();

    // Without a window, the hotkey's messages come to this thread's queue.
    if (!RegisterHotKey(IntPtr.Zero, 1, MOD_NOREPEAT, VK_SNAPSHOT)) {
      Console.WriteLine("held");
      return;
    }
    Console.WriteLine("ready");
    MSG msg;
    while (GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) {
      if (msg.message == WM_HOTKEY) Console.WriteLine("pressed");
    }
    UnregisterHotKey(IntPtr.Zero, 1);
  }
}
'@

[SnapPrintScreen]::Run()
