const DEFAULT_TIMEOUT = 20000;

export function announce(msg, opts = {}) {
  const { timeout = DEFAULT_TIMEOUT } = opts;
  let container = document.getElementById('announce-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'announce-container';
    container.className = 'announce-container';
    document.body.appendChild(container);
  }
  const banner = document.createElement('div');
  banner.className = 'announce-banner';
  banner.textContent = msg;
  container.appendChild(banner);
  requestAnimationFrame(() => banner.classList.add('show'));
  setTimeout(() => {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 500);
  }, timeout);
}
