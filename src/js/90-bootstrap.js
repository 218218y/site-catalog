/**
 * Source module: 90-bootstrap.js
 * Minimal startup entry point. Application behavior is composed in 80-app-shell.js.
 */

import { markAppReady } from "./00-navigation.js";
import { requireFeatureInterface } from "./10-app-state.js";

function init() {
  return requireFeatureInterface("app-shell").initialize();
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
