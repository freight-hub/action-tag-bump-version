# Action: SemVer bump from tags (with PR comment!)

This action will fetch the latest tag/release created and bump the version with the level specific in the label of the PR.
If no label is found, we will use a 'patch' bump.

## Inputs

### `token`

**Required** The secret used to access github

### `build_number`

Used to build the pre-release version (Default: `0`)

### `fallback_tag`

If no tag has been found (in the tags), this tag will be used. Should be a Semantic Version valid tag.
If no tag can be found, and no fallback_tag is provided, we will throw an error.

### `disable_inform`

If true, we will not post a message on the pull_request. (Default: `false`)

## Outputs

### `old_version`

The current version that we found (could be the fallback version provided if none is found)

### `new_version`

The next version we will build, based on semVer with the {inputs.level} as bump parameter

### `pre_release_version`

The next pre-release version tag ({new_version}-alpha.{inputs.build_number})

## Example usage

Get the tag by using the action:

```yaml
name: Bump version from tag
id: tag
uses: freight-hub/action-tag-bump-version@v1.3
with:
  token: ${{ secrets.GITHUB_TOKEN }}
  build_number: ${{ github.run_number }}
  fallback_tag: 0.0.1
  disable_inform: false
```

Update the yarn version with the output:

```yaml
- run: yarn version --new-version ${{ steps.tag.outputs.new_version }} --no-git-tag-version
- run: yarn version --new-version ${{ steps.tag.outputs.pre_release_version }} --no-git-tag-version
```

## Contributing

When contributing to this library there are some points to note:

1. Please run `yarn format` & `yarn build` BEFORE pushing to the repository.
2. The `dist` folder is checked in (we compile the node_modules into it with `@vercel/ncc`)
   - this is because we need to include the complete script in the repository for github
3. Please keep this readme up to date
3. After you have comitted, you can tag the repository to 'build' a new version for use in actions