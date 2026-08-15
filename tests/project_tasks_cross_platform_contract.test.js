"use strict";

const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const projectTasks = require(path.join(root, "tools", "project_tasks.js"));
const linuxOcrSetup = require(path.join(root, "tools", "setup_linux_ocr.js"));
const pythonLauncher = require(path.join(root, "tools", "run_project_python.js"));

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const expectedTasks = [
  "setup",
  "sync-catalog-pdfs",
  "convert-catalogs",
  "convert-catalogs-force",
  "refresh-ocr-search",
  "r2-preview",
  "r2-sync",
  "bundle-site-r2",
  "deploy-cloudflare",
  "configure-r2-cors",
  "server",
  "server-check",
  "control-panel",
  "telemetry-report",
  "clean",
];
assert.deepEqual(Object.keys(projectTasks.TASKS), expectedTasks);
assert.deepEqual(projectTasks.parseCommandLine(["--dry-run", "r2-sync", "--no-delete"]), {
  help: false,
  context: { dryRun: true },
  task: "r2-sync",
  arguments: ["--no-delete"],
});
assert.equal(projectTasks.parseCommandLine(["build"]).task, "bundle-site-r2");
assert.equal(projectTasks.parseCommandLine(["deploy"]).task, "deploy-cloudflare");
assert.equal(projectTasks.npmCommand("win32"), "npm.cmd");
assert.equal(projectTasks.npmCommand("linux"), "npm");
assert.equal(projectTasks.npmCommand("darwin"), "npm");
assert.equal(projectTasks.shouldInstallLinuxOcr("linux", new Set()), true);
assert.equal(
  projectTasks.shouldInstallLinuxOcr("linux", new Set(["--skip-ocr-system-deps"])),
  false,
);
assert.equal(projectTasks.shouldInstallLinuxOcr("win32", new Set()), false);

assert.deepEqual([...linuxOcrSetup.REQUIRED_LANGUAGES], ["eng", "heb"]);
assert.deepEqual(
  [...linuxOcrSetup.APT_PACKAGES],
  ["tesseract-ocr", "tesseract-ocr-eng", "tesseract-ocr-heb"],
);
assert.deepEqual(
  [...linuxOcrSetup.parseTesseractLanguages(
    "List of available languages in /usr/share/tesseract-ocr/5/tessdata/ (3):\neng\nheb\nosd\n",
  )],
  ["eng", "heb", "osd"],
);
assert.deepEqual(
  linuxOcrSetup.privilegedAptInvocation(["update"], { isRoot: true }),
  {
    command: "env",
    args: ["DEBIAN_FRONTEND=noninteractive", "apt-get", "update"],
  },
);
assert.deepEqual(
  linuxOcrSetup.privilegedAptInvocation(["install", "-y", "tesseract-ocr"], { isRoot: false }),
  {
    command: "sudo",
    args: [
      "--",
      "env",
      "DEBIAN_FRONTEND=noninteractive",
      "apt-get",
      "install",
      "-y",
      "tesseract-ocr",
    ],
  },
);

let fakeOcrInstalled = false;
const fakeOcrCalls = [];
const fakeOcrRunner = (command, args) => {
  fakeOcrCalls.push([command, ...args]);
  if (command === "tesseract" && args[0] === "--version") {
    return fakeOcrInstalled
      ? { status: 0, stdout: "tesseract 5.5.0\n", stderr: "" }
      : { status: 1, stdout: "", stderr: "", error: new Error("not found") };
  }
  if (command === "tesseract" && args[0] === "--list-langs") {
    return { status: 0, stdout: "List of available languages (3):\neng\nheb\nosd\n", stderr: "" };
  }
  if (command === "apt-get" && args[0] === "--version") {
    return { status: 0, stdout: "apt 3.0\n", stderr: "" };
  }
  if (command === "sudo" && args[0] === "--version") {
    return { status: 0, stdout: "sudo 1.9\n", stderr: "" };
  }
  if (command === "sudo" && args.includes("apt-get")) {
    if (args.includes("install")) fakeOcrInstalled = true;
    return { status: 0, stdout: "", stderr: "" };
  }
  throw new Error(`Unexpected fake OCR command: ${command} ${args.join(" ")}`);
};
const fakeOcrLogs = [];
const fakeOcrState = linuxOcrSetup.ensureLinuxOcr({
  platform: "linux",
  runner: fakeOcrRunner,
  getuid: () => 1000,
  log: (message) => fakeOcrLogs.push(message),
});
assert.equal(fakeOcrState.available, true);
assert.deepEqual(fakeOcrState.missingLanguages, []);
assert.equal(fakeOcrCalls.some((call) => call.includes("update")), true);
assert.equal(fakeOcrCalls.some((call) => call.includes("tesseract-ocr-heb")), true);
assert.match(fakeOcrLogs.at(-1), /languages: eng, heb/);

const alreadyInstalledCalls = [];
const alreadyInstalledState = linuxOcrSetup.ensureLinuxOcr({
  platform: "linux",
  runner: (command, args) => {
    alreadyInstalledCalls.push([command, ...args]);
    if (command === "tesseract" && args[0] === "--version") {
      return { status: 0, stdout: "tesseract 5.5.0\n", stderr: "" };
    }
    if (command === "tesseract" && args[0] === "--list-langs") {
      return { status: 0, stdout: "List of available languages (2):\neng\nheb\n", stderr: "" };
    }
    throw new Error(`Idempotent OCR check attempted an installer command: ${command}`);
  },
  getuid: () => 1000,
  log: () => {},
});
assert.equal(alreadyInstalledState.available, true);
assert.deepEqual(alreadyInstalledState.missingLanguages, []);
assert.deepEqual(
  alreadyInstalledCalls.map((call) => call.slice(0, 2)),
  [
    ["tesseract", "--version"],
    ["tesseract", "--list-langs"],
  ],
);

const dryRunBundle = spawnSync(
  process.execPath,
  ["tools/project_tasks.js", "--dry-run", "bundle-site-r2", "--include-json"],
  { cwd: root, encoding: "utf8", shell: false, windowsHide: true },
);
assert.equal(dryRunBundle.status, 0, dryRunBundle.stderr);
assert.match(dryRunBundle.stdout, /verify_r2_catalog_sync_state\.py/);
assert.match(dryRunBundle.stdout, /build_deploy_bundle\.py/);
assert.match(dryRunBundle.stdout, /--external-assets-url https:\/\/cdn\.bargig-furniture\.com/);
assert.match(dryRunBundle.stdout, /--include-json/);
assert.match(dryRunBundle.stdout, /clean_project_artifacts\.py/);

const dryRunDeploy = spawnSync(
  process.execPath,
  ["tools/project_tasks.js", "--dry-run", "deploy-cloudflare", "--preview-branch", "test-name"],
  { cwd: root, encoding: "utf8", shell: false, windowsHide: true },
);
assert.equal(dryRunDeploy.status, 0, dryRunDeploy.stderr);
assert.match(dryRunDeploy.stdout, /verify_remote_catalog_assets\.py/);
assert.match(dryRunDeploy.stdout, /deploy_cloudflare_pages\.py/);
assert.match(dryRunDeploy.stdout, /--preview-branch test-name/);
assert.doesNotMatch(dryRunDeploy.stdout, /build_deploy_bundle\.py/);

const dryRunSetup = spawnSync(
  process.execPath,
  [
    "tools/project_tasks.js",
    "--dry-run",
    "setup",
    "--allow-node-version-mismatch",
    "--with-browser-deps",
  ],
  { cwd: root, encoding: "utf8", shell: false, windowsHide: true },
);
assert.equal(dryRunSetup.status, 0, dryRunSetup.stderr);
const npmExecutablePattern = escapeRegExp(projectTasks.npmCommand());
assert.match(
  dryRunSetup.stdout,
  new RegExp(`\\[dry-run\\] ${npmExecutablePattern} ci(?:\\r?\\n|$)`, "u"),
);
assert.match(dryRunSetup.stdout, /--system tools\/clean_project_artifacts\.py/);
assert.match(dryRunSetup.stdout, /--system tools\/setup_python_env\.py/);
if (process.platform === "linux") {
  assert.match(dryRunSetup.stdout, /tools\/setup_linux_ocr\.js/);
  assert.ok(
    dryRunSetup.stdout.indexOf("tools/setup_linux_ocr.js") <
      dryRunSetup.stdout.indexOf(`${projectTasks.npmCommand()} ci`),
    "Linux OCR prerequisites must be validated before npm installation",
  );
} else {
  assert.doesNotMatch(dryRunSetup.stdout, /tools\/setup_linux_ocr\.js/);
}
assert.match(
  dryRunSetup.stdout,
  new RegExp(`\\[dry-run\\] ${npmExecutablePattern} run setup:browsers:linux(?:\\r?\\n|$)`, "u"),
);

const dryRunSetupWithoutOptionalSystemSteps = spawnSync(
  process.execPath,
  [
    "tools/project_tasks.js",
    "--dry-run",
    "setup",
    "--allow-node-version-mismatch",
    "--skip-browsers",
    "--skip-ocr-system-deps",
  ],
  { cwd: root, encoding: "utf8", shell: false, windowsHide: true },
);
assert.equal(
  dryRunSetupWithoutOptionalSystemSteps.status,
  0,
  dryRunSetupWithoutOptionalSystemSteps.stderr,
);
assert.doesNotMatch(dryRunSetupWithoutOptionalSystemSteps.stdout, /setup_linux_ocr\.js/);
assert.doesNotMatch(dryRunSetupWithoutOptionalSystemSteps.stdout, /setup:browsers/);

const invocation = pythonLauncher.buildInvocation({
  system: true,
  script: "tools/clean_project_artifacts.py",
  arguments: ["--check"],
});
assert.equal(invocation.args.includes("tools/clean_project_artifacts.py"), true);
assert.equal(invocation.args.includes("tools/run_with_project_python.py"), false);
const managedInvocation = pythonLauncher.buildInvocation({
  script: "tools/clean_project_artifacts.py",
  arguments: ["--check"],
});
assert.equal(managedInvocation.args.includes("tools/run_with_project_python.py"), true);
const pythonCandidates = pythonLauncher.uniqueCandidates(pythonLauncher.PYTHON_BASELINE);
if (process.platform === "win32") {
  assert.equal(
    pythonCandidates.some((candidate) =>
      candidate.command === "py" &&
      candidate.prefix.includes("-3")
    ),
    true,
  );
} else {
  assert.equal(
    pythonCandidates.some((candidate) =>
      candidate.command === `python${pythonLauncher.PYTHON_BASELINE.text}`
    ),
    true,
  );
}

assert.equal(
  pythonLauncher.runtimeSatisfiesBaseline(
    pythonLauncher.PYTHON_BASELINE.major,
    pythonLauncher.PYTHON_BASELINE.minor + 1,
    pythonLauncher.PYTHON_BASELINE,
  ),
  true,
  "a newer Python minor in the supported major must be accepted",
);
assert.equal(
  pythonLauncher.runtimeSatisfiesBaseline(
    pythonLauncher.PYTHON_BASELINE.major,
    pythonLauncher.PYTHON_BASELINE.minor - 1,
    pythonLauncher.PYTHON_BASELINE,
  ),
  false,
  "a Python minor below the compatibility baseline must be rejected",
);

const simulatedNewerRuntime = pythonLauncher.probePython(
  {
    command: process.execPath,
    prefix: [
      "-e",
      `console.log(JSON.stringify([${pythonLauncher.PYTHON_BASELINE.major}, ${pythonLauncher.PYTHON_BASELINE.minor + 1}, "simulated-python"]))`,
      "--",
    ],
  },
  pythonLauncher.PYTHON_BASELINE,
);
assert.ok(simulatedNewerRuntime, "the launcher probe must accept a newer supported Python minor");
assert.equal(simulatedNewerRuntime.minor, pythonLauncher.PYTHON_BASELINE.minor + 1);

for (const [name, command] of Object.entries(packageJson.scripts)) {
  assert.doesNotMatch(command, /^python(?:3)?\s/u, `${name} bypasses the Python resolver`);
}
assert.equal(packageJson.scripts["catalogs:convert"], "node tools/project_tasks.js convert-catalogs");
assert.equal(packageJson.scripts["r2:sync"], "node tools/project_tasks.js r2-sync");
assert.equal(packageJson.scripts["site:bundle:r2"], "node tools/project_tasks.js bundle-site-r2");

const windowsMappings = {
  ".20-setup-windows.bat": "setup",
  "sync-catalog-pdfs.bat": "sync-catalog-pdfs",
  ".10-convert-catalogs.bat": "convert-catalogs",
  ".011-convert-catalogs-force.bat": "convert-catalogs-force",
  ".012-refresh-ocr-search.bat": "refresh-ocr-search",
  ".06-sync-r2-images-preview.bat": "r2-preview",
  ".07-sync-r2-images.bat": "r2-sync",
  ".01-bundle-site-r2.bat": "bundle-site-r2",
  ".02-bundle-site-r2-upload cloudflare.bat": "deploy-cloudflare",
  "configure-r2-cors.bat": "configure-r2-cors",
  ".05-start-server.bat": "server",
  ".03-check-and-start-server.bat": "server-check",
  ".04-catalog-control-panel.bat": "control-panel",
  ".20-telemetry-report.bat": "telemetry-report",
  ".020-clean-project-artifacts.bat": "clean",
};
for (const [filename, task] of Object.entries(windowsMappings)) {
  const source = fs.readFileSync(path.join(root, filename), "utf8");
  assert.equal(source.includes(`node tools\\project_tasks.js ${task} %*`), true, filename);
  assert.doesNotMatch(source, /activate\.bat|\.venv\\Scripts|py -3|python tools\\/i, filename);
}

const linuxLauncher = fs.readFileSync(path.join(root, "site.sh"), "utf8");
const linuxSetup = fs.readFileSync(path.join(root, "setup-linux.sh"), "utf8");
assert.match(linuxLauncher, /^#!\/usr\/bin\/env sh/m);
assert.match(linuxLauncher, /exec node tools\/project_tasks\.js "\$@"/);
assert.match(linuxSetup, /exec "\$SCRIPT_DIR\/site\.sh" setup "\$@"/);
assert.match(fs.readFileSync(path.join(root, ".gitattributes"), "utf8"), /^\*\.sh text eol=lf$/m);
assert.match(fs.readFileSync(path.join(root, ".gitattributes"), "utf8"), /^\*\.bat text eol=crlf$/m);

console.log("project_tasks_cross_platform_contract.test.js: PASS");
