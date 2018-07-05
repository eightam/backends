const { ifElse, compose } = require('ramda')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')
const {
  normalize,
  getOrSkip,
  getMany,
  getOrNew
} = require('@orbiting/backend-modules-transform/lib/normalize')

const Figure = require('./figure')
const TitleBlock = require('./titleBlock')
const Center = require('./center')

const fromMdast = ifElse(
  M.isRoot,
  mergeResults(
    S.toObject('document'),
    S.withNormalizedNodes(
      normalize(
        getOrSkip(Figure.fromMdast),
        getOrNew(
          TitleBlock.getNew,
          TitleBlock.fromMdast
        ),
        getMany(
          compose(
            Figure.fromMdast,
            Center.fromMdast
          )
        )
      )
    ),
    node => ({
      data: node.meta
    })
  )
)

const toMdast = ifElse(
  S.isDocument,
  mergeResults(M.toRoot, M.withChildren)
)

module.exports = {
  fromMdast,
  toMdast
}
