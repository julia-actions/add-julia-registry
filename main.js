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
  const { stdout } = await exec.getExecOutput("ssh-keyscan github.com");
  await io.mkdirP(path.join(home, ".ssh"));
  fs.appendFileSync(path.join(home, ".ssh", "known_hosts"), stdout);
}

const cloneRegistry = async () => {
  const { name: tmpdir, removeCallback: tmpdirCleanup } = tmp.dirSync({ unsafeCleanup: true });
  await exec.exec(`git clone git@github.com:${registry}.git ${tmpdir}`);
  const meta = toml.parse(fs.readFileSync(path.join(tmpdir, "Registry.toml")));
  const name = meta.name || registry.split("/")[1];
  const depot = process.env.JULIA_DEPOT_PATH || path.join(home, ".julia");
  const user_depot = depot.split(path.delimiter)[0];
  const dest = path.join(user_depot, "registries", name);
  if (fs.existsSync(dest)) {
    tmpdirCleanup();
  } else {
    fs.moveSync(tmpdir, dest);
  }
  const general = path.join(user_depot, "registries", "General");
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
