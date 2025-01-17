const core = require("@actions/core");
const exec = require("@actions/exec");

async function unsetGitInsteadOfSsh() {
  await exec.exec(`git config --global --unset url."git@github.com:".insteadOf`);
}

async function unsetGitInsteadOfHttps(github_token) {
  await exec.exec(`git config --global --unset url."https://git:${github_token}@github.com/".insteadOf`);
}

async function stopSshAgent() {
  const { stdout } = await exec.getExecOutput("ssh-agent -k");
  stdout.split("\n").forEach(line => {
    const match = /unset (.*);/.exec(line);
    if (match) {
      core.exportVariable(match[1], "");
    }
  });
}

async function post() {
  const protocol = core.getInput("protocol", { required: true });
  const github_token = core.getInput("github-token", { required: protocol == "https" });

  if (protocol === "ssh") {
    await unsetGitInsteadOfSsh();
    await stopSshAgent();
  } else {
    await unsetGitInsteadOfHttps(github_token);
  }
}

if (!module.parent) {
  post().catch(e => {
    console.error(e);
  });
}
