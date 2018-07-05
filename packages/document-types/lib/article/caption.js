const {
  ifElse,
  init,
  last,
  compose
} = require('ramda')
const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')
const { mergeResults } = require('@orbiting/backend-modules-transform/lib/common')

const fromMdast = ifElse(
  M.isParagraph,
  mergeResults(
    S.toBlock('caption'),
    (node, next) => {
      const lastChild = last(node.children)
      const textNodes = M.isEmphasis(lastChild)
        ? init(node.children)
        : node.children
      const byline = M.isEmphasis(lastChild)
        ? lastChild
        : null

      const nodes = []
        .concat(
          textNodes.length
            ? {
              object: 'block',
              type: 'captionText',
              nodes: next(textNodes)
            }
            : []
        )
        .concat(
          byline
            ? {
              object: 'block',
              type: 'captionByline',
              nodes: next(byline.children)
            }
            : []
        )

      return { nodes }
    }
  )
)

const toMdast = compose(
  ifElse(
    S.isBlock('caption'),
    mergeResults(M.toParagraph, M.withChildren)
  ),
  ifElse(S.isBlock('captionText'), (node, next) =>
    next(node.nodes)
  ),
  ifElse(
    S.isBlock('captionByline'),
    mergeResults(M.toEmphasis, M.withChildren)
  )
)

module.exports = {
  fromMdast,
  toMdast
}
