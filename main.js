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
  // Ensure that `known_hosts` always exists
  const known_hosts_path = path.join(HOME, ".ssh", "known_hosts");
  fs.ensureFileSync(known_hosts_path);
  
  // If we don't already have a mapping for `github.com`, get it automatically
  if ((await exec.exec("ssh-keygen", ["-F", "github.com"], { ignoreReturnCode: true })) != 0) {
    const { stdout } = await exec.getExecOutput("ssh-keyscan github.com");
    fs.appendFileSync(known_hosts_path, stdout);
  }
}

function getRegistryName(registry_dir) {
  const meta = toml.parse(fs.readFileSync(path.join(registry_dir, "Registry.toml")));
  return meta.name || registry.split("/").pop();
}

async function cloneRegistry(url, name) {
  // Use a consistent registry directory between CI jobs to ensure that this action works
  // well with CI caching.
  const repo_name = url.match(/([^\/]+)\.git$/)[1]
  const registry_dir = path.join(DEPOT_PATH[0], "registries", name || repo_name);
  if (!fs.existsSync(registry_dir)) {
    await exec.exec(`git clone --no-progress ${url} ${registry_dir}`);
  } else {
    await exec.exec(`git -C ${registry_dir} pull`);
  }

  // We have observed that toml parsing can be quite slow. We use the passed in name
  // to work around this problem.
  // https://github.com/julia-actions/add-julia-registry/pull/25#issuecomment-1877708220
  // Mainly, this exists for backwards compatibility.
  if (!name) {
    const registry_name = getRegistryName(registry_dir)
    const alt_registry_dir = path.join(DEPOT_PATH[0], "registries", registry_name);

    // Adding an alternate registry name via a symlink works well with Julia's
    // `Pkg.Registry.update()` as that call will only one of the registries and not both.
    if (registry_dir != alt_registry_dir && !fs.existsSync(alt_registry_dir)) {
      fs.symlink(registry_dir, alt_registry_dir, "dir")
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
