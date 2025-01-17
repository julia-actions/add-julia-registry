# Add Julia Registry

Handles Git authentication to private Julia packages and registries such that they can be used within a CI environment. After running this action any GitHub HTTPS request made by Pkg will be automatically authenticated.

Currently, this action only support private packages hosted within GitHub.

Access to private packages requires you to create a [SSH private key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh) or a [personal access token](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) (with the proper repository access) in GitHub.

## SSH Access

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: julia-actions/setup-julia@v2
        with:
          version: "1"
      - uses: julia-actions/cache@v2
      - uses: julia-actions/add-julia-registry@v3
        with:
          registry: MyOrg/MyRegistry
          ssh-key: ${{ secrets.SSH_KEY }}
      - uses: julia-actions/julia-runtest@v1
```

When using the SSH protocol this action performs the following steps:

- Starts [`ssh-agent`](https://linux.die.net/man/1/ssh-agent).
- Adds the supplied private key to the SSH agent.
- Configures Git to rewrite HTTPS URLs to SSH URLs (e.g. `https://github.com/foo/bar` to `git@github.com:foo/bar`).
- Downloads the specified registry and the [General](https://github.com/JuliaRegistries/General) registry.

## HTTPS Access

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: julia-actions/setup-julia@v2
        with:
          version: "1"
      - uses: julia-actions/cache@v2
      - uses: julia-actions/add-julia-registry@v3
        with:
          registry: MyOrg/MyRegistry
          protocol: https
          github-token: ${{ secrets.GITHUB_TOKEN }}  # Using `${{ github.token }}` won't work for most use cases.
      - uses: julia-actions/julia-runtest@v1
```

When using the HTTPS protocol this action performs the following steps:

- Configures Git to rewrite unauthenticated HTTPS URLs to authenticated HTTPS URLs (e.g. `https://github.com/foo/bar` to `https://git:ghp_*****@github.com/foo/bar`)
- Downloads the specified registry and the [General](https://github.com/JuliaRegistries/General) registry.
