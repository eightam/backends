const { ifElse, compose } = require('ramda')
const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')
const {
  normalize,
  getOrNew,
  getOrSkip,
  getMany
} = require('@orbiting/backend-modules-transform/lib/normalize')

const Figure = require('./figure')

const infoBoxTitleFromMdast = ifElse(
  M.isHeading(3),
  mergeResults(
    S.toBlock('infoBoxTitle'),
    S.withNodes
  )
)

const infoBoxTextFromMdast = ifElse(
  M.isParagraph,
  mergeResults(
    S.toBlock('infoBoxText'),
    S.withNodes
  )
)

const fromMdast = ifElse(
  M.isZone('INFOBOX'),
  mergeResults(
    S.toBlock('infoBox'),
    S.withData,
    S.withNormalizedNodes(
      normalize(
        getOrNew(
          S.toBlock('title'),
          infoBoxTitleFromMdast
        ),
        getOrSkip(Figure.fromMdast),
        getMany(infoBoxTextFromMdast)
      )
    )
  )
)

const toMdast = compose(
  ifElse(
    S.isBlock('infoBox'),
    mergeResults(
      M.toZone('INFOBOX'),
      M.withChildren
    )
  ),
  ifElse(
    S.isBlock('infoBoxTitle'),
    mergeResults(M.toHeading(3), M.withChildren)
  ),
  ifElse(
    S.isBlock('infoBoxText'),
    mergeResults(M.toParagraph, M.withChildren)
  )
)

module.exports = {
  fromMdast,
  toMdast
}
