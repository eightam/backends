const { makeExecutableSchema } = require('graphql-tools')
const { server } = require('@orbiting/backend-modules-base')

// default GIT_WORKSPACE
const path = require('path')
const mkdirp = require('mkdirp')
if (!process.env.GIT_WORKSPACE) {
  process.env.GIT_WORKSPACE = path.resolve('./git_workspace')
  console.log(`GIT_WORKSPACE: ${process.env.GIT_WORKSPACE}`)
}
mkdirp(process.env.GIT_WORKSPACE)

module.exports.run = () => {
  const localModule = require('./graphql')
  const executableSchema = makeExecutableSchema(localModule)

  const createGraphQLContext = (defaultContext) => ({
    ...defaultContext
  })

  const middlewares = []

  return server.run(executableSchema, middlewares, null, createGraphQLContext)
}

module.exports.close = () => {
  server.close()
}
