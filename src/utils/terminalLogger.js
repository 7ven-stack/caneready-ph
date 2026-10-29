export function sendToTerminal(level, source, message, details = null) {
  const payload = {
    level,
    source,
    time: new Date().toLocaleTimeString(),
    message: String(message || ''),
    details: details ? String(details) : null,
  };

  try {
    fetch('/__terminal_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

let isInstalled = false;

export function installTerminalErrorForwarder() {
  if (isInstalled || typeof window === 'undefined') return;
  isInstalled = true;

  sendToTerminal('INFO', 'AppBoot', 'Browser-to-Antigravity Terminal Error Forwarder active.');

  window.addEventListener('error', (event) => {
    sendToTerminal(
      'ERROR',
      'WindowError',
      event.message || 'Uncaught runtime error',
      `${event.filename || ''}:${event.lineno || ''}:${event.colno || ''}\n${event.error?.stack || ''}`
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendToTerminal(
      'ERROR',
      'UnhandledPromise',
      event.reason?.message || String(event.reason || 'Promise rejected'),
      event.reason?.stack || null
    );
  });

  const origConsoleError = console.error;
  console.error = (...args) => {
    origConsoleError.apply(console, args);
    const text = args
      .map((a) => (a instanceof Error ? `${a.message}\n${a.stack}` : typeof a === 'object' ? JSON.stringify(a) : String(a)))
      .join(' ');
    sendToTerminal('ERROR', 'console.error', text);
  };
}
