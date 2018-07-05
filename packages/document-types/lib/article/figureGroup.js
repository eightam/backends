const { ifElse } = require('ramda')
const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')
const {
  normalize,
  getMany,
  getJust
} = require('@orbiting/backend-modules-transform/lib/normalize')

const Figure = require('./figure')
const Caption = require('./caption')

const fromMdast = ifElse(
  M.isZone('FIGUREGROUP'),
  mergeResults(
    S.toBlock('figureGroup'),
    S.withNormalizedNodes(
      normalize(
        getMany(Figure.fromMdast),
        getJust(Caption.fromMdast)
      )
    )
  )
)

const toMdast = ifElse(
  S.isBlock('figureGroup'),
  mergeResults(
    M.toZone('FIGUREGROUP'),
    M.withChildren
  )
)

module.exports = {
  fromMdast,
  toMdast
}
