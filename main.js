const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const tmp = require("tmp");
const toml = require('toml');

const core = require("@actions/core");
const exec = require("@actions/exec");
const io = require("@actions/io");

const key = core.getInput("key", { required: true });
const registry = core.getInput("registry", { required: true });

const home = os.homedir();

const startAgent = async () => {
  const { stdout } = await exec.getExecOutput("ssh-agent");
  stdout.split("\n").forEach(line => {
    const match = /(.*)=(.*?);/.exec(line);
    if (match) {
      core.exportVariable(match[1], match[2]);
    }
  });
};

const addKey = async () => {
  const { name } = tmp.fileSync();
  fs.writeFileSync(name, key.trim() + "\n");
  await exec.exec(`ssh-add ${name}`);
  await io.rmRF(name);
};

const updateKnownHosts = async () => {
  // Ensure that `known_hosts` always exists
  const known_hosts_path = path.join(home, ".ssh", "known_hosts");
  fs.ensureFileSync(known_hosts_path);
  
  // If we don't already have a mapping for `github.com`, get it automatically
  if ((await exec.exec("ssh-keygen", ["-F", "github.com"], {ignoreReturnCode: true})) != 0) {
    const { stdout } = await exec.getExecOutput("ssh-keyscan github.com");
    fs.appendFileSync(known_hosts_path, stdout);
  }
}

const cloneRegistry = async () => {
  const tmpdir = tmp.dirSync().name;
  await exec.exec(`git clone git@github.com:${registry}.git ${tmpdir}`);
  const meta = toml.parse(fs.readFileSync(path.join(tmpdir, "Registry.toml")));
  const name = meta.name || registry.split("/")[1];
  const depot = process.env.JULIA_DEPOT_PATH || path.join(home, ".julia");
  const dest = path.join(depot, "registries", name);
  if (!fs.existsSync(dest)) {
    fs.moveSync(tmpdir, dest);
  }
  const general = path.join(depot, "registries", "General");
  if (!fs.existsSync(general)) {
    await exec.exec(`git clone git@github.com:JuliaRegistries/General.git ${general}`);
  }
};

const configureGit = async () => {
  await exec.exec("git config --global url.git@github.com:.insteadOf https://github.com/");
};

const main = async () => {
  await startAgent();
  await addKey();
  await updateKnownHosts();
  await cloneRegistry();
  await configureGit();
};

if (!module.parent) {
  main().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
