const { exec } = require("@actions/exec");

const post = async () => {
  await exec("git config --global --unset url.git@github.com:.insteadOf");
  await exec("ssh-agent -k");
};

if (!module.parent) {
  post().catch(e => {
    console.error(e);
    process.exit(1);
  });
}
