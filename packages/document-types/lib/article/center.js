const { ifElse } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isZone('CENTER'),
  mergeResults(S.toBlock('center'), S.withNodes)
)

const toMdast = ifElse(
  S.isBlock('center'),
  mergeResults(M.toZone('CENTER'), M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
