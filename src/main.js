const github = require("@actions/github");
const core = require("@actions/core");
const semver = require("semver");

const validLevels = ['major', 'minor', 'patch']

async function run() {
    try {
        // todo @lennart: See if we can get the labels from the context
        console.log(github.context)

        const gitHubSecret = core.getInput("github_secret")

        // setup
        if (!gitHubSecret) {
            core.setFailed(`No github secret found`)
            return
        }

        const octokit = github.getOctokit(gitHubSecret)
        const {owner: currentOwner, repo: currentRepo} = github.context.repo;
        console.log(`Owner: ${currentOwner}, Repo: ${currentRepo}`)

        const level = core.getInput("level")
        if (validLevels.indexOf(level) === -1) {
            core.setFailed(`Not a valid level. Must be one of: ${validLevels.join(", ")}`)
            return;
        }
        console.log(`Level: ${level}`)

        const fallbackTag = core.getInput("fallback_tag", {required: false})

        let buildNumber = core.getInput("build_number", {required: false})

        if (!buildNumber) {
            buildNumber = 0
        }
        console.log(`buildNumber: ${buildNumber}`)

        let tagResponse = null
        try {
            // get tags
            tagResponse = await octokit.rest.repos.listTags({
                owner: currentOwner,
                repo: currentRepo,
                per_page: 1,
                page: 1
            });
        } catch (e) {
            core.setFailed(`Could not fetch tags for repo.`)
            return
        }
        let tag = null
        if (tagResponse.data?.length > 0) {
            console.log("Using latest tag from repository")

            tag = tagResponse.data[0].name
            console.log(tag)
        } else {
            tag = fallbackTag
        }

        if (!tag) {
            core.setFailed(`no tags found, and fallback is not provided.`)
            return;
        }

        if (!semver.valid(tag)) {
            core.setFailed(`${tag} is not a valid version`)
            return;
        }

        const newVersion = semver.inc(tag, level)
        core.setOutput("old_version", tag)
        core.setOutput("new_version", newVersion)
        core.setOutput("pre_release_version", `${newVersion}-alpha.${buildNumber}`)

    } catch
        (error) {
        core.setFailed(error.message);
    }
}

(async () => {
    await run();
})();