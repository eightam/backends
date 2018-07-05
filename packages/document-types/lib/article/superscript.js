const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isSup,
  mergeResults(S.toMark('sup'), S.withNodes)
)

const toMdast = ifElse(
  S.isMark('sup'),
  mergeResults(M.toSup, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
