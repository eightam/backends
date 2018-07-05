const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isParagraph,
  mergeResults(
    S.toBlock('paragraph'),
    S.withNodes
  )
)

const toMdast = ifElse(
  S.isBlock('paragraph'),
  mergeResults(M.toParagraph, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
