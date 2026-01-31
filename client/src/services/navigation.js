let navigateImpl = null;

export function setNavigate(fn) {
  navigateImpl = typeof fn === 'function' ? fn : null;
}

export function navigateTo(path, options) {
  if (!navigateImpl) return;
  try {
    navigateImpl(path, options);
  } catch {
    void 0;
  }
}
