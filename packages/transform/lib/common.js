const {
  isNil,
  complement,
  uncurryN,
  compose,
  curry,
  unnest,
  filter,
  map,
  converge,
  mergeDeepLeft,
  reduce,
  over,
  both,
  equals,
  ifElse,
  lensProp,
  lensPath,
  view,
  always,
  prop
} = require('ramda')

const update = uncurryN(
  3,
  compose(over, lensProp)
)

const prettyPrint = obj =>
  JSON.stringify(obj, null, 3)

const log = curry((msg, v) => {
  console.log(msg, v)
  return v
})

const notIsNil = complement(isNil)

const safePath = uncurryN(2, path =>
  view(lensPath(path))
)

const safeProp = uncurryN(
  2,
  ifElse(isNil, always, prop)
)

const safePropEq = uncurryN(
  3,
  (key, val) =>
    compose(
      both(notIsNil, equals(val)),
      safeProp(key)
    )
)

const cleanFlatMap = uncurryN(
  2,
  compose(unnest, filter(notIsNil), map)
)

const mergeResults = compose(
  converge(
    compose(reduce(mergeDeepLeft, {}), Array.of)
  ),
  Array.of
)

module.exports = {
  update,
  prettyPrint,
  log,
  notIsNil,
  safePath,
  safeProp,
  safePropEq,
  cleanFlatMap,
  mergeResults
}
