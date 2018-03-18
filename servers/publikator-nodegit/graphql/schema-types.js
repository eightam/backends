module.exports = `
scalar DateTime
scalar JSON

type Repo {
  id: ID!
  latestCommit: Commit!
}

type Commit {
  id: ID!
  message: String
  #mdast
  document: JSON
}
`
