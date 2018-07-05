const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isLink,
  mergeResults(
    S.toInline('link'),
    S.withLinkData,
    S.withNodes
  )
)

const toMdast = ifElse(
  S.isInline('link'),
  mergeResults(M.toLink, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
