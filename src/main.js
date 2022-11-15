const github = require('@actions/github')
const core = require('@actions/core')
const semver = require('semver')

const validLevels = ['major', 'minor', 'patch']

const preMessageLines = [
    '# Bumping Minor or Major versions',
    'Thank you for contributing to this repository!',
    "If you would like to bump the version more than just a patch, use the 'minor' or 'major' label.",
    '# Release Plan',
    '| Previous version | New version | Pre-release version',
    '|--|--|--|',
]

const postMessageLines = [
    '# What will happen?',
    'The pacakge.json will be updated to the NEXT stable version (provided by labels)',
    'Please use the Pre-release version to test out any functionality.',
    'Once this PR is merged, a release will be created with the NEXT version ready for your services to consume!',
]

// Used to match the message that was already created so we don't post multiple times
const message_includes = preMessageLines[0]

async function run() {
    try {
        await execute()
    } catch (error) {
        core.setFailed(error.message)
    }
}

async function execute() {
    // -- Input
    const { repo, owner, gitHubSecret, fallbackTag, buildNumber, prNumber, disableInform } = getAndValidateInput()

    // -- Action
    const level = await getAndValidateLevel(gitHubSecret, owner, repo, prNumber)
    const tag = await getLastTag(gitHubSecret, owner, repo, fallbackTag)

    if (!tag) throw new Error('No tag found in repository, and no fallback tag provided')
    if (!semver.valid(tag)) throw new Error(`${tag} is not a valid version`)

    const newVersion = semver.inc(tag, level)
    const preReleaseVersion = `${newVersion}-alpha.${buildNumber}`
    console.log(`Incremented ${tag} with level ${level} to ${newVersion}, alpha: ${preReleaseVersion}`)

    if (!disableInform) {
        console.log(`Commenting on the PR to inform user about minor and major labels`)
        await upsertComment(gitHubSecret, owner, repo, prNumber, tag, newVersion, preReleaseVersion)
    }

    // -- Output
    core.setOutput('old_version', tag)
    core.setOutput('new_version', newVersion)
    core.setOutput('pre_release_version', preReleaseVersion)
}

function getAndValidateInput() {
    const gitHubSecret = core.getInput('github_secret', { required: true })
    if (!gitHubSecret) throw new Error(`No github secret found`)

    const fallbackTag = core.getInput('fallback_tag', { required: false })
    let buildNumber = core.getInput('build_number', { required: false }) ?? 0
    let disableInform = core.getInput('disable_inform', { required: false }) === 'true'

    const repo = github.context.repo
    const prNumber = github.context.payload.pull_request?.number

    return {
        owner: repo.owner,
        repo: repo.repo,
        gitHubSecret,
        fallbackTag,
        buildNumber,
        prNumber,
        disableInform,
    }
}

async function getAndValidateLevel(gitHubSecret, owner, repo, prNumber) {
    let level = null

    const labels = await getLabelsForPullRequest(gitHubSecret, owner, repo, prNumber)

    if (labels.length === 1) {
        level = labels[0]
        console.log(`using ${level} from labels on repository`)
    } else if (labels.length > 0) {
        validLevels.forEach((validLevel, idx) => {
            if (labels.indexOf(validLevel) > -1) {
                level = labels[idx]
                console.log(`using ${level} from labels on repository`)
            }
        })
    }
    if (!level) {
        console.log(`No label found, using 'patch' level`)
    }

    if (validLevels.indexOf(labels[0]) === -1) {
        throw new Error(`Label is not a valid semVer inc. must be one of ${validLevels.join(', ')}`)
    }

    return level
}

async function getLastTag(gitHubSecret, owner, repo, fallbackTag) {
    const octokit = github.getOctokit(gitHubSecret)

    try {
        const request = {
            owner,
            repo,
            per_page: 1,
            page: 1,
        }

        const tagResponse = await octokit.rest.repos.listTags(request)

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

async function getLabelsForPullRequest(gitHubSecret, owner, repo, prNumber) {
    const octokit = github.getOctokit(gitHubSecret)

    try {
        const request = {
            owner,
            repo,
            pull_number: prNumber,
        }

        const prResponse = await octokit.rest.pulls.get(request)

        if (prResponse.data) {
            return prResponse.data.labels.map((l) => l.name)
        }
        return []
    } catch (e) {
        throw new Error(`could not fetch PR: ${e.message}`)
    }
}

async function upsertComment(gitHubSecret, owner, repo, prNumber, oldVersion, newVersion, preReleaseVersion) {
    const octokit = github.getOctokit(gitHubSecret)

    let comment = undefined
    for await (const { data: comments } of octokit.paginate.iterator(octokit.rest.issues.listComments, {
        owner,
        repo,
        issue_number: prNumber,
    })) {
        comment = comments.find((comment) => comment?.body?.includes(message_includes))
        if (comment) break
    }

    let messageLines = [`|${oldVersion}|${newVersion}|${preReleaseVersion}|`, '']

    let message = preMessageLines.concat(messageLines).concat(postMessageLines).join('\n')

    if (comment) {
        await octokit.rest.issues.updateComment({
            repo,
            owner,
            comment_id: comment.id,
            body: message,
        })
    } else {
        await octokit.rest.issues.createComment({
            repo,
            owner,
            issue_number: prNumber,
            body: message,
        })
    }
}

;(async () => {
    await run()
})()
