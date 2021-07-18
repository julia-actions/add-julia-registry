const exec = require("@actions/exec");

const post = async () => {
  await exec.exec("git config --global --unset url.git@github.com:.insteadOf");
  await exec.exec("ssh-agent -k");
};

if (!module.parent) {
  post().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
