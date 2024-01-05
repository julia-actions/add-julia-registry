const core = require("@actions/core");
const exec = require("@actions/exec");

async function undoGitConfig() {
  await exec.exec("git config --global --unset url.git@github.com:.insteadOf");
}

async function stopAgent() {
  const { stdout } = await exec.getExecOutput("ssh-agent -k");
  stdout.split("\n").forEach(line => {
    const match = /unset (.*);/.exec(line);
    if (match) {
      core.exportVariable(match[1], "");
    }
  });
}

async function post() {
  await undoGitConfig();
  await stopAgent();
}

if (!module.parent) {
  post().catch(e => {
    console.error(e);
  });
}
