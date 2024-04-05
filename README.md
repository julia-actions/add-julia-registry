# Add Julia Registry

If your package depends on private packages registered in a private registry, you need to handle authentication to that registry and the package repositories in a fully automated way, since you can't manually enter credentials in a CI environment.
This action will deal with all of that for you, all you need is an SSH private key.

```yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: julia-actions/setup-julia@v2
        with:
          version: 1
      - uses: julia-actions/cache@v1
      - uses: julia-actions/add-julia-registry@v2
        with:
          key: ${{ secrets.SSH_KEY }}
          registry: MyOrg/MyRegistry
      - uses: julia-actions/julia-runtest@v1
```

This action does the following:

- Starts [ssh-agent](https://linux.die.net/man/1/ssh-agent)
- Adds your private key to the agent
- Configures Git to rewrite HTTPS URLs (`https://github.com/foo/bar`) to SSH URLs (`git@github.com:foo/bar`)
- Downloads the registry you specify and [General](https://github.com/JuliaRegistries/General)

Therefore, when Pkg tries to download packages from the HTTPS URLs in the registry, it will do so over SSH, using your private key as authentication.
