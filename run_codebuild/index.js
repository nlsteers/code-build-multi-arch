import { CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand } from '@aws-sdk/client-codebuild'

const CONFIG = new Map()
CONFIG.set('PROJECT_NAME', process.env.PROJECT_NAME || 'code-build-multi-arch')
CONFIG.set('SOURCE_VERSION', process.env.SOURCE_VERSION || '727bfb9')
CONFIG.set('IMAGE_TAG', process.env.IMAGE_TAG || 'firebreak-demo')
CONFIG.set('WAIT_TIME_MILLIS', process.env.WAIT_TIME_MILLIS || '20000')
CONFIG.set('IMAGE_TYPES', ['arm64v8', 'amd64'])

const ERROR_STATUS = ['FAILED', 'FAULT', 'TIMED_OUT', 'STOPPED']
const START_STATUS = ['SUBMITTED', 'QUEUED']
const DONE_STATUS = 'SUCCEEDED'
const WAIT_STATUS = 'IN_PROGRESS'
const BUILD_FAILURE_ERROR = '🔴 there were build failures, check the log output'

const client = new CodeBuildClient({ region: 'eu-west-1' })

const handler = async () => {
  printConfigInfo()
  if (
    await trackBuilds(
      await startImageBuilds(
        CONFIG.get('PROJECT_NAME'),
        CONFIG.get('SOURCE_VERSION'),
        CONFIG.get('IMAGE_TAG'),
        CONFIG.get('IMAGE_TYPES')
      )
    )
  ) {
    if (await trackBuilds(await startManifestBuild())) {
      console.log('🟢 all builds suceeded')
      return true
    } else {
      console.log(BUILD_FAILURE_ERROR)
      return false
    }
  } else {
    console.log(BUILD_FAILURE_ERROR)
    return false
  }
}

const trackBuilds = async (buildIds) => {
  console.log(`💤 sleeping ${CONFIG.get('WAIT_TIME_MILLIS')}ms ...`)
  await sleep(CONFIG.get('WAIT_TIME_MILLIS'))
  const command = new BatchGetBuildsCommand({
    ids: buildIds,
  })
  const response = await client.send(command)
  const buildStatus = new Map()

  response.builds.forEach((build) => {
    buildStatus.set(build.id, build.buildStatus)
  })

  if (detectFailure(buildStatus)) {
    return false
  }

  const allBuildsPassed = [...buildStatus.values()].every((value) => value === DONE_STATUS)

  if (allBuildsPassed) {
    return true
  } else {
    return trackBuilds(buildIds)
  }
}

const startManifestBuild = async () => {
  return await startImageBuilds(CONFIG.get('PROJECT_NAME'), CONFIG.get('SOURCE_VERSION'), CONFIG.get('IMAGE_TAG'), [
    'manifest',
  ])
}

const startImageBuilds = async (projectName, sourceVersion, releaseNumber, imageTypes) => {
  const commands = []
  imageTypes.forEach((type) => {
    const command = new StartBuildCommand({
      projectName: `${projectName}_${type}`,
      sourceVersion,
      environmentVariablesOverride: [
        {
          name: 'IMAGE_TAG',
          value: type === 'manifest' ? `${releaseNumber}` : `${releaseNumber}-${type}`,
        },
      ],
    })
    commands.push(client.send(command))
  })

  const buildIds = []
  const buildStatus = new Map()

  await Promise.all(commands).then((responses) => {
    responses.forEach((response) => {
      buildStatus.set(response.build.id, response.build.currentPhase)
      buildIds.push(response.build.id)
    })
  })
  detectFailure(buildStatus)
  return buildIds
}

const sleep = (waitTimeInMillis) => new Promise((resolve) => setTimeout(resolve, waitTimeInMillis))

const detectFailure = (buildStatusMap) => {
  let failed = false
  console.table(
    Array.from(buildStatusMap).map(([key, value]) => {
      let symbol
      if (START_STATUS.includes(value)) symbol = '🚧'
      if (value === DONE_STATUS) symbol = '✅'
      if (value === WAIT_STATUS) symbol = '⏳'
      if (ERROR_STATUS.includes(value)) {
        symbol = '🚨'
        failed = true
      }
      return {
        SYMBOL: symbol,
        BUILD_ID: key,
        STATUS: `${value}`,
      }
    }),
    ['SYMBOL', 'BUILD_ID', 'STATUS']
  )
  return failed
}

const printConfigInfo = () => {
  console.log('🔧 starting job with configuration:')
  console.table(
    Array.from(CONFIG).map(([key, value]) => ({
      ENV_VAR: key,
      VALUE: value,
    }))
  )
}

if (process.argv.includes('handler')) {
  await handler()
}

export { handler }
