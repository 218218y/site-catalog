/**
 * Source module: 90-bootstrap.js
 * Minimal startup entry point. Application behavior is composed in 80-app-shell.js.
 */

function init() {
  return getFeatureInterface("app-shell")?.initialize() ?? true;
}

let initResult = true;
try {
  initResult = init();
} catch (error) {
  console.error("Application initialization failed", error);
  initResult = false;
} finally {
  if (initResult !== false) markAppReady();
}
