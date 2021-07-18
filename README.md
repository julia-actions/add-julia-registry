# Add Julia Registry

This action adds a private Julia registry with an SSH key and configures Git to use it to add packages.

```yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: julia-actions/add-julia-registry@main
        with:
          key: ${{ secrets.SSH_KEY }}
          registry: MyOrg/MyRegistry
      - uses: julia-actions/setup-julia@v1
        with:
          version: 1
      - uses: julia-actions/julia-runtest@v1
```
