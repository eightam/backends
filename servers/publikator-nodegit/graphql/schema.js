module.exports = `
schema {
  query: queries
}

type queries {
  repo(id: ID!): Repo!
}
`
