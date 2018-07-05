const {
  compose,
  unnest,
  filter,
  mapAccum,
  always,
  ifElse,
  nth
} = require('ramda')

const { notIsNil } = require('./common')

const getJust = rule => (
  nodes,
  index,
  next
) => [
  index + 1,
  rule(always(null))(nodes[index], next)
]

const getOrNew = (constructFn, rule) => (
  nodes,
  index,
  next
) => [
  index + 1,
  rule(constructFn)(nodes[index], next)
]

const getOrSkip = rule => (
  nodes,
  index,
  next
) => {
  const ret = rule(always(null))(
    nodes[index],
    next
  )
  return [!ret ? index : index + 1, ret]
}

const getOrSkipAt = (
  indexToSkip,
  rule
) => (nodes, index, next) => {
  const cleanIndexToSkip =
    indexToSkip > 0
      ? indexToSkip
      : nodes.length + indexToSkip
  if (index === cleanIndexToSkip) {
    return [index, null]
  }
  return getJust(rule)(nodes, index, next)
}

const getMany = rule => (
  nodes,
  startIndex,
  next
) => {
  const transformer = rule(always(null))
  let index = startIndex
  let res = []
  let ret = transformer(nodes[index], next)
  while (ret) {
    res = res.concat(ret)
    index = index + 1
    ret =
      nodes[index] &&
      transformer(nodes[index], next)
  }
  return [index, res]
}

const getIfNotEmpty = (
  isEmptyFn,
  rule
) => (nodes, index, next) => [
  index + 1,
  ifElse(
    isEmptyFn,
    always(null),
    rule(always(null))
  )(nodes[index], next)
]

const normalize = (...normalizers) => (
  nodes,
  next
) =>
  compose(
    unnest,
    filter(notIsNil),
    nth(1),
    mapAccum(
      (index, normalizer) =>
        normalizer(nodes, index, next),
      0
    )
  )(normalizers)

module.exports = {
  getJust,
  getOrNew,
  getOrSkip,
  getOrSkipAt,
  getMany,
  getIfNotEmpty,
  normalize
}
