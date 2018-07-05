const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isEmphasis,
  mergeResults(S.toBlock('italic'), S.withNodes)
)

const toMdast = ifElse(
  S.isMark('italic'),
  mergeResults(M.toEmphasis, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
