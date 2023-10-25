import './test-env.js'
import {CodeBuildClient, StartBuildCommand, BatchGetBuildsCommand} from '@aws-sdk/client-codebuild'
import 'aws-sdk-client-mock-jest'
import {mockClient} from 'aws-sdk-client-mock'
import {handler} from './index.js'

const codeBuildMockClient = mockClient(CodeBuildClient)

describe('handler', () => {
  beforeEach(() => {
    codeBuildMockClient.reset()
    codeBuildMockClient
      .on(StartBuildCommand, {
        projectName: 'test-project_arm64v8',
      })
      .resolves({
        build: {
          id: 'build-arm64v8',
          currentPhase: 'QUEUED',
        },
      })
      .on(StartBuildCommand, {
        projectName: 'test-project_amd64',
      })
      .resolves({
        build: {
          id: 'build-amd64',
          currentPhase: 'QUEUED',
        },
      })
      .on(StartBuildCommand, {
        projectName: 'test-project_manifest',
      })
      .resolves({
        build: {
          id: 'build-manifest',
          currentPhase: 'QUEUED',
        },
      })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should start multiple builds and track their status', async () => {
    codeBuildMockClient
      .on(BatchGetBuildsCommand, {
        ids: ['build-arm64v8', 'build-amd64'],
      })
      .resolves({
        builds: [
          {
            id: 'build-arm64v8',
            buildStatus: 'SUCCEEDED',
          },
          {
            id: 'build-amd64',
            buildStatus: 'SUCCEEDED',
          },
        ],
      })
      .on(BatchGetBuildsCommand, {
        ids: ['build-manifest'],
      })
      .resolves({
        builds: [
          {
            id: 'build-manifest',
            buildStatus: 'SUCCEEDED',
          },
        ],
      })

    expect(await handler()).toBe(true)

    expect(codeBuildMockClient).toHaveReceivedCommandTimes(StartBuildCommand, 3)

    expect(codeBuildMockClient).toHaveReceivedNthSpecificCommandWith(1, StartBuildCommand, {
      projectName: 'test-project_arm64v8',
      sourceVersion: '123abc5',
      environmentVariablesOverride: [
        {
          name: 'IMAGE_TAG',
          value: 'latest-arm64v8',
        },
      ],
    })

    expect(codeBuildMockClient).toHaveReceivedNthSpecificCommandWith(2, StartBuildCommand, {
      projectName: 'test-project_amd64',
      sourceVersion: '123abc5',
      environmentVariablesOverride: [
        {
          name: 'IMAGE_TAG',
          value: 'latest-amd64',
        },
      ],
    })

    expect(codeBuildMockClient).toHaveReceivedNthSpecificCommandWith(3, StartBuildCommand, {
      projectName: 'test-project_manifest',
      sourceVersion: '123abc5',
      environmentVariablesOverride: [
        {
          name: 'IMAGE_TAG',
          value: 'latest',
        },
      ],
    })
  })

  it('should start multiple builds and report build failures', async () => {
    codeBuildMockClient
      .on(BatchGetBuildsCommand)
      .resolvesOnce({ // first command call
        builds: [
          {
            id: 'build-arm64v8',
            buildStatus: 'IN_PROGRESS',
          },
          {
            id: 'build-amd64',
            buildStatus: 'IN_PROGRESS',
          },
        ]
      })
      .resolvesOnce({ // second command call
        builds: [
          {
            id: 'build-arm64v8',
            buildStatus: 'IN_PROGRESS',
          },
          {
            id: 'build-amd64',
            buildStatus: 'FAILED',
          },
        ]
      })
    expect(await handler()).toBe(false)
  })
})
