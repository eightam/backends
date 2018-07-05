const {
  compose,
  when,
  uncurryN,
  allPass,
  head,
  type: typeOf,
  equals
} = require('ramda')

const {
  notIsNil,
  safeProp,
  safePath,
  safePropEq,
  mergeResults
} = require('./common')

const getChildren = safeProp('children')

const getFirstChild = compose(
  when(notIsNil, head),
  getChildren
)

const isType = safePropEq('type')

const hasIdentifier = safePropEq(
  'identifier'
)

const hasDepth = safePropEq('depth')

const isBreak = safePropEq('break')

const isParagraph = isType('paragraph')

const isBlockquote = isType('blockquote')

const isLink = isType('link')

const isStrong = isType('strong')

const isEmphasis = isType('emphasis')

const isSub = isType('sub')

const isSup = isType('sup')

const isSpan = isType('span')

const isList = isType('list')

const isCode = isType('code')

const isListItem = isType('listItem')

const isRoot = isType('root')

const isText = isType('text')

const isZone = uncurryN(2, identifier =>
  allPass([
    isType('zone'),
    hasIdentifier(identifier)
  ])
)

const isImageParagraph = allPass([
  notIsNil,
  compose(
    compose(equals('Array'), typeOf),
    getChildren
  ),
  compose(isType('image'), getFirstChild)
])

const isHeading = uncurryN(2, depth =>
  allPass([hasDepth(depth), isType('heading')])
)

const toType = type => () => ({
  type
})

const toParagraph = toType('paragraph')

const toBlockquote = toType('blockquote')

const toStrong = toType('strong')

const toEmphasis = toType('emphasis')

const toSub = toType('sub')

const toBreak = toType('break')

const toSup = toType('sup')

const toRoot = mergeResults(
  toType('root'),
  node => ({
    meta: node.data
  })
)

const toZone = identifer => node => ({
  type: 'zone',
  identifer,
  data: node.data
})

const toLink = node => ({
  type: 'link',
  title: safePath(['data', 'title'], node),
  url: safePath(['data', 'url'], node)
})

const toImageParagraph = node => ({
  type: 'paragraph',
  children: [
    {
      type: 'image',
      url: safePath(['data', 'url'], node),
      title: safePath(['data', 'title'], node),
      alt: safePath(['data', 'alt'], node)
    }
  ]
})

const toHeading = depth => () => ({
  type: 'heading',
  depth
})

const toText = node => {
  return {
    type: 'text',
    value: safeProp('value', node)
  }
}

const withChildren = (node, next) => ({
  children: next(node.nodes)
})

const withNormalizedChildren = normalizer => (
  node,
  next
) => {
  return {
    children: normalizer(
      safeProp('nodes', node),
      next
    )
  }
}

module.exports = {
  isParagraph,
  isBreak,
  isBlockquote,
  isLink,
  isStrong,
  isEmphasis,
  isSub,
  isSup,
  isSpan,
  isList,
  isCode,
  isListItem,
  isRoot,
  isZone,
  isText,
  isImageParagraph,
  isHeading,
  toType,
  toZone,
  toLink,
  toText,
  toHeading,
  toImageParagraph,
  toParagraph,
  toBlockquote,
  toStrong,
  toEmphasis,
  toSub,
  toBreak,
  toSup,
  toRoot,
  withChildren,
  withNormalizedChildren
}
