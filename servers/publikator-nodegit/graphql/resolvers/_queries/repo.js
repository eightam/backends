const Git = require('nodegit')
const path = require('path')
const { lib: { appAuth } } = require('@orbiting/backend-modules-github')

const {
  GIT_WORKSPACE
} = process.env

let installationToken

module.exports = async (_, args, { user }) => {
  const {
    id: repoId
  } = args

  const localPath = path.resolve(GIT_WORKSPACE, repoId)
  console.log(`localPath: ${localPath}`)

  const nearFuture = new Date()
  nearFuture.setMinutes(nearFuture.getMinutes() + 15)
  if (!installationToken || installationToken.expiresAt < nearFuture) {
    installationToken = await appAuth.getInstallationToken()
  }

  let repo
  try {
    repo = await Git.Repository.open(localPath)
  } catch (e) {
    repo = await Git.Clone(`https://github.com/${repoId}.git`, localPath, {
      fetchOpts: {
        callbacks: {
          certificateCheck: () => 1,
          credentials: (url, userName) =>
            Git.Cred.userpassPlaintextNew('x-access-token', installationToken.token)
        }
      }
    })
  }

  // TODO: how to do this properly?
  repo.id = repoId

  return repo
}
