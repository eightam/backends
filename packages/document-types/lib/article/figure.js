const { ifElse, compose } = require('ramda')

const {
  normalize,
  getJust,
  getOrNew
} = require('@orbiting/backend-modules-transform/lib/normalize')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const Caption = require('./caption')

const getNewFigureImage = mergeResults(
  S.toBlock('figureImage'),
  S.asVoid,
  () => ({
    data: {
      url: '',
      title: '',
      alt: ''
    }
  })
)

const figureImageFromMdast = ifElse(
  M.isImageParagraph,
  mergeResults(
    S.withImageParagraphData,
    getNewFigureImage
  )
)

const fromMdast = ifElse(
  M.isZone('FIGURE'),
  mergeResults(
    S.toBlock('figure'),
    S.withData,
    S.withNormalizedNodes(
      normalize(
        getOrNew(
          getNewFigureImage,
          figureImageFromMdast
        ),
        getJust(Caption.fromMdast)
      )
    )
  )
)

const toMdast = compose(
  ifElse(
    S.isBlock('figure'),
    mergeResults(
      M.toZone('FIGURE'),
      M.withChildren
    )
  ),
  ifElse(
    S.isBlock('figureImage'),
    M.toImageParagraph
  )
)

module.exports = {
  fromMdast,
  toMdast
}
