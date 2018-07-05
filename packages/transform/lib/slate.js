const {
  uncurryN,
  allPass,
  map,
  compose,
  defaultTo,
  append,
  pick,
  ifElse,
  reduce,
  __,
  equals,
  type: typeOf,
  concat,
  when,
  reduceRight,
  merge,
  both
} = require('ramda')

const {
  update,
  notIsNil,
  safePropEq,
  safePath,
  safeProp,
  mergeResults
} = require('./common')

const isType = safePropEq('type')

const isObject = safePropEq('object')

const isBlock = uncurryN(2, type =>
  allPass([isType(type), isObject('block')])
)

const isInline = uncurryN(2, type =>
  allPass([isType(type), isObject('inline')])
)

const isMark = uncurryN(2, type =>
  allPass([isType(type), isObject('mark')])
)

const isDocument = isObject('document')

const isText = isObject('text')

const applyMark = uncurryN(2, mark =>
  update(
    'leaves',
    compose(
      map(
        update(
          'marks',
          compose(
            append(pick(['type', 'data'], mark)),
            defaultTo([])
          )
        )
      ),
      defaultTo([])
    )
  )
)

const handleMark = uncurryN(2, mark =>
  compose(
    ifElse(isObject('mark'), flattenMarks),
    ifElse(isText, applyMark(mark))
  )(update('nodes', map(handleMark(mark))))
)

const flattenMarks = mark => {
  return reduce(
    uncurryN(2, nodes =>
      compose(
        ifElse(
          compose(equals('Array'), typeOf),
          concat(__, nodes),
          append(__, nodes)
        ),
        handleMark(mark)
      )
    ),
    [],
    safeProp('nodes', mark)
  )
}

const withFlatMarks = transformer =>
  compose(
    when(isObject('mark'), flattenMarks),
    transformer
  )

const prepareLeaf = leaf =>
  compose(
    reduceRight(
      (parent, child) => {
        return merge(parent, {
          object: 'mark',
          nodes: [child]
        })
      },
      { object: 'text', value: leaf.text }
    ),
    defaultTo([]),
    safeProp('marks')
  )(leaf)

const nestMarks = compose(
  map(prepareLeaf),
  safeProp('leaves')
)

const withNestedMarks = transformer =>
  ifElse(
    both(
      isText,
      compose(notIsNil, safeProp('leaves'))
    ),
    (node, next) => next(nestMarks(node)),
    transformer
  )

const toObject = object => () => ({
  object
})

const ofType = type => () => ({
  type
})

const toBlock = type =>
  mergeResults(toObject('block'), ofType(type))

const toInline = type =>
  mergeResults(toObject('inline'), ofType(type))

const toMark = type =>
  mergeResults(toObject('mark'), ofType(type))

const toText = node => ({
  object: 'text',
  leaves: [
    {
      text: node.value
    }
  ]
})

const asVoid = () => ({
  isVoid: true
})

const withNodes = (node, next) => {
  return {
    nodes: next(safeProp('children', node))
  }
}

const withNormalizedNodes = normalizer => (
  node,
  next
) => {
  return {
    nodes: normalizer(
      safeProp('children', node),
      next
    )
  }
}

const withData = node => ({
  data: node.data
})

const withLinkData = node => ({
  data: {
    title: node.title,
    url: node.url
  }
})

const withImageParagraphData = node => ({
  data: {
    url: safePath(['children', 0, 'url'], node),
    title: safePath(
      ['children', 0, 'title'],
      node
    ),
    alt: safePath(['children', 0, 'alt'], node)
  }
})

module.exports = {
  isBlock,
  isInline,
  isMark,
  isDocument,
  isText,
  isObject,
  toObject,
  ofType,
  toText,
  toMark,
  toBlock,
  toInline,
  asVoid,
  withNodes,
  withFlatMarks,
  withNestedMarks,
  withNormalizedNodes,
  withData,
  withLinkData,
  withImageParagraphData
}
