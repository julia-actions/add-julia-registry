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
  if (typeof name !== "undefined") {
    const registry_dir = path.join(DEPOT_PATH[0], "registries", name);
    fs.existsSync(registry_dir) && return
    await exec.exec(`git clone ${url} ${registry_dir}`);
  } else {
    const tmp_name = url.match(/([^\/]+)\.git$/)[1]
    const tmp_registry_dir = path.join(DEPOT_PATH[0], "registries", tmp_name);
    fs.existsSync(tmp_registry_dir) && return
    await exec.exec(`git clone ${url} ${tmp_registry_dir}`);
    name = getRegistryName(tmp_registry_dir)
    const registry_dir = path.join(DEPOT_PATH[0], "registries", name);
    if (fs.existsSync(registry_dir)) {
      fs.rmSync(tmp_registry_dir, { recursive: true, force: true });
    } else {
      fs.moveSync(tmp_registry_dir, registry_dir);
    }
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
  await cloneRegistry("git@github.com:JuliaRegistries/General.git", "General");
  await configureGit();
}

if (!module.parent) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
