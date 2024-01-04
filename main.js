const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const tmp = require("tmp");
const toml = require("toml");

const core = require("@actions/core");
const exec = require("@actions/exec");
const io = require("@actions/io");

const HOME = os.homedir();
const DEPOT_PATH = (process.env.JULIA_DEPOT_PATH || path.join(HOME, ".julia")).split(path.delimiter);

async function startAgent() {
  const { stdout } = await exec.getExecOutput("ssh-agent");
  stdout.split("\n").forEach(line => {
    const match = /(.*)=(.*?);/.exec(line);
    if (match) {
      core.exportVariable(match[1], match[2]);
    }
  });
}

async function addKey(key) {
  const { name } = tmp.fileSync();
  fs.writeFileSync(name, key.trim() + "\n");
  await exec.exec(`ssh-add ${name}`);
  await io.rmRF(name);
}

async function updateKnownHosts() {
  const { stdout } = await exec.getExecOutput("ssh-keyscan github.com");
  await io.mkdirP(path.join(HOME, ".ssh"));
  fs.appendFileSync(path.join(HOME, ".ssh", "known_hosts"), stdout);
}

function getRegistryName(registry_dir) {
  const meta = toml.parse(fs.readFileSync(path.join(registry_dir, "Registry.toml")));
  return meta.name || registry.split("/").pop();
}

async function cloneRegistry(url, name) {
  const registry_name = name || url.match(/([^\/]+)\.git$/)[1]
  const registry_dir = path.join(DEPOT_PATH[0], "registries", registry_name);
  if (!fs.existsSync(registry_dir)) {
    await exec.exec(`git clone --no-progress ${url} ${registry_dir}`);
  }

  // When the registry name differs from the repo name we'll create a symlink for backwards
  // compatibility. When running `Pkg.Registry.update()` Julia will only update one of
  // these registries which avoids unnecessary overhead.
  const alt_registry_dir = path.join(DEPOT_PATH[0], "registries", getRegistryName(registry_dir));
  if (registry_dir != alt_registry_dir && !fs.existsSync(alt_registry_dir)) {
    fs.symlink(registry_dir, alt_registry_dir, "dir")
  }
};

async function configureGit() {
  await exec.exec("git config --global url.git@github.com:.insteadOf https://github.com/");
}

async function main() {
  const key = core.getInput("key", { required: true });
  const registry = core.getInput("registry", { required: true });

  await startAgent();
  await addKey(key);
  await updateKnownHosts();
  await cloneRegistry(`git@github.com:${registry}.git`);
  if (registry != "JuliaRegistries/General") {
    await cloneRegistry("git@github.com:JuliaRegistries/General.git", "General");
  }
  await configureGit();
}

if (!module.parent) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
