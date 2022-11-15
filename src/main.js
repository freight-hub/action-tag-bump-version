const github = require("@actions/github");
const core = require("@actions/core");
const semver = require("semver");

const validLevels = ['major', 'minor', 'patch']

const message = `Thank you for contributing to this repository!
If you would like to bump the version more than just a patch, use the 'minor' or 'major' label`
const message_includes = `Thank you for contributing to this repository`


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

async function execute() {
    // -- Input
    const {repo, owner, gitHubSecret, level, fallbackTag, buildNumber, prNumber, disableInform} = getAndValidateInput()

    // -- Action
    const tag = getLastTag(gitHubSecret, repo, owner, fallbackTag)

    if (!tag) throw new Error('No tag found in repository, and no fallback tag provided.')
    if (!semver.valid(tag)) throw new Error(`${tag} is not a valid version`)

    const newVersion = semver.inc(tag, level)
    const preReleaseVersion = `${newVersion}-alpha.${buildNumber}`
    console.log(`Incremented ${tag} with level ${level} to ${newVersion}, alpha: ${preReleaseVersion}`)

    if (!disableInform) {
        console.log(`Commenting on the PR to inform user about minor and major labels.`)
        await upsertComment(gitHubSecret, repo, owner, prNumber)
    }

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
    let disableInform = core.getInput("disable_inform", {required: false}) === 'true'

    const repo = github.context.repo;
    const prNumber = github.context.payload.pull_request?.number;

    return {
        owner: repo.owner,
        repo: repo.repo,
        gitHubSecret,
        level,
        fallbackTag,
        buildNumber,
        prNumber,
        disableInform
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

async function upsertComment(gitHubSecret, repo, owner, prNumber) {
    const octokit = github.getOctokit(gitHubSecret)

    let comment = undefined;
    for await (const {data: comments} of octokit.paginate.iterator(octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: prNumber,
    })) {
        comment = comments.find((comment) => comment?.body?.includes(message_includes));
        if (comment) break;
    }

    if (comment) {
        await octokit.rest.issues.updateComment({
            repo,
            owner,
            comment_id: comment.id,
            body: message,
        });
    } else {
        await octokit.rest.issues.createComment({
            repo,
            owner,
            issue_number: prNumber,
            body: message,
        });
    }
}


(async () => {
    await run();
})();