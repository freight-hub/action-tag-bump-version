const github = require("@actions/github");
const core = require("@actions/core");
const semver = require("semver");

const validLevels = ['major', 'minor', 'patch']

async function run() {
    try {
        // todo @lennart: See if we can get the labels from the context
        console.log(github.context)

        await execute();
    } catch
        (error) {
        core.setFailed(error.message);
    }
}

function execute() {
    // -- Input
    const {repo, owner, gitHubSecret, level, fallbackTag, buildNumber} = getAndValidateInput()

    // -- Action
    const tag = getLastTag(gitHubSecret, repo, owner, fallbackTag)

    if (!tag) throw new Error('No tag found in repository, and no fallback tag provided.')
    if (!semver.valid(tag)) throw new Error(`${tag} is not a valid version`)

    const newVersion = semver.inc(tag, level)
    const preReleaseVersion = `${newVersion}-alpha.${buildNumber}`
    console.log(`Incremented ${tag} with level ${level} to ${newVersion}, alpha: ${preReleaseVersion}`)

    // -- Output
    core.setOutput("old_version", tag)
    core.setOutput("new_version", newVersion)
    core.setOutput("pre_release_version", preReleaseVersion)

}

function getAndValidateInput() {
    const gitHubSecret = core.getInput("github_secret")
    if (!gitHubSecret) throw new Error(`No github secret found`)

    const level = core.getInput("level")
    if (validLevels.indexOf(level) === -1) throw new Error(`Not a valid level. Must be one of: ${validLevels.join(", ")}`)

    const fallbackTag = core.getInput("fallback_tag", {required: false})
    let buildNumber = core.getInput("build_number", {required: false}) ?? 0

    const repo = github.context.repo;

    return {
        owner: repo.owner,
        repo: repo.repo,
        gitHubSecret,
        level,
        fallbackTag,
        buildNumber
    }
}

async function getLastTag(gitHubSecret, owner, repo, fallbackTag) {
    const octokit = github.getOctokit(gitHubSecret)

    try {
        const request = {
            owner,
            repo,
            per_page: 1,
            page: 1
        };

        const tagResponse = await octokit.rest.repos.listTags(request);

        if (tagResponse.data?.length > 0) {
            console.log(`Using latest tag from repository: ${tagResponse.data[0].name}`)
            return tagResponse.data[0].name
        } else {
            console.log(`No tag found in repository, using fallback: ${fallbackTag}`)
            return fallbackTag
        }
    } catch (e) {
        throw new Error(`could not create release: ${e.message}`)
    }
}


(async () => {
    await run();
})();