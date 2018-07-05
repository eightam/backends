const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isSub,
  mergeResults(S.toMark('sub'), S.withNodes)
)

const toMdast = ifElse(
  S.isMark('sub'),
  mergeResults(M.toSub, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
