const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isHeading(2),
  mergeResults(S.toBlock('subhead'), S.withNodes)
)

const toMdast = ifElse(
  S.isBlock('subhead'),
  mergeResults(M.toHeading(2), M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
