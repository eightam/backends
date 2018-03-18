module.exports = {
  latestCommit: async (repo) => {
    return repo.getHeadCommit()
  }
}
