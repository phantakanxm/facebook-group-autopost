// Emit a notification request that Electron main (listening on worker stdout)
// will turn into a native OS notification. Using stdout as the IPC channel
// avoids adding a new DB table or socket just for this.
//
// Format: "__NOTIFY__<json>\n" on stdout. sidecars.ts parses each line.

export function notifyDesktop(title: string, body: string): void {
  // Guard: truncate body to keep native notifications readable (macOS ~256).
  const safeBody = body.length > 240 ? `${body.slice(0, 237)}...` : body;
  const payload = JSON.stringify({ title, body: safeBody });
  // eslint-disable-next-line no-console
  console.log(`__NOTIFY__${payload}`);
}
