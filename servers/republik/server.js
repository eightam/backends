const { makeExecutableSchema } = require('graphql-tools')
const { server } = require('@orbiting/backend-modules-base')
const { merge } = require('apollo-modules-node')
const t = require('./lib/t')

const { graphql: documents } = require('@orbiting/backend-modules-documents')
const { graphql: redirections } = require('@orbiting/backend-modules-redirections')
const { graphql: search } = require('@orbiting/backend-modules-search')
const { graphql: notifications } = require('@orbiting/backend-modules-notifications')

const sendPendingPledgeConfirmations = require('./modules/crowdfundings/lib/sendPendingPledgeConfirmations')
const mail = require('./modules/crowdfundings/lib/Mail')
const cluster = require('cluster')

const {
  LOCAL_ASSETS_SERVER,
  SEARCH_PG_LISTENER
} = process.env

const start = async () => {
  const httpServer = await run()
  await runOnce({ clusterMode: false })
  return httpServer
}

// in cluster mode, this runs after runOnce otherwise before
const run = async (workerId) => {
  const localModule = require('./graphql')
  const executableSchema = makeExecutableSchema(merge(localModule, [documents, search, redirections, notifications]))

  // middlewares
  const middlewares = [
    require('./modules/crowdfundings/express/paymentWebhooks'),
    require('./express/gsheets'),
    (server, pgdb) => {
      const router = require('express').Router()
      server.use(router.get('/cookie-portal', (req, res) => {
        const cookie = req.get('Cookie')
        const { url } = req.query
        console.log('/cookie-portal', {cookie, url})
        if (url) {
          res.redirect(url)
          return
        }
        // res.cookie('rememberme', '1', { expires: new Date(Date.now() + 900000), httpOnly: true });
        if (cookie) {
          res.end('got 🍪 🤤')
        } else {
          res.end('no 🍪 😢')
        }
      }))
    }
  ]

  if (LOCAL_ASSETS_SERVER) {
    const { express } = require('@orbiting/backend-modules-assets')
    for (let key of Object.keys(express)) {
      middlewares.push(express[key])
    }
  }

  // signin hooks
  const signInHooks = [
    async (userId, isNew, pgdb) =>
      sendPendingPledgeConfirmations(userId, pgdb, t)
  ]

  const createGraphQLContext = (defaultContext) => ({
    ...defaultContext,
    t,
    signInHooks,
    mail
  })

  return server.start(
    executableSchema,
    middlewares,
    t,
    createGraphQLContext,
    workerId
  )
}

// in cluster mode, this runs before run otherwise after
const runOnce = (...args) => {
  if (cluster.isWorker) {
    throw new Error('runOnce must only be called on cluster.isMaster')
  }
  server.runOnce(...args)
  require('./lib/slackGreeter').connect()
  if (SEARCH_PG_LISTENER) {
    require('@orbiting/backend-modules-search').notifyListener.run()
  }
}

const close = () => {
  server.close()
}
module.exports = {
  start,
  run,
  runOnce,
  close
}

process.on('SIGTERM', () => {
  close()
})
