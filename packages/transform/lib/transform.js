const {
  curry,
  compose,
  ifElse,
  flip,
  equals,
  type: typeOf
} = require('ramda')

const { cleanFlatMap, log } = require('./common')

const transformObject = curry(
  (transformer, v) =>
    transformer(v, transform(transformer))
)

const transformList = curry(
  (transformer, list) =>
    cleanFlatMap(
      transformObject(transformer),
      list
    )
)

const transform = compose(
  ifElse(
    flip(compose(equals('Array'), typeOf)),
    transformList
  ),
  ifElse(
    flip(compose(equals('Object'), typeOf)),
    transformObject
  )
)(n => {
  log(`Invalid data type ${typeOf(n)}found:\n`, n)
})

module.exports = {
  transformObject,
  transformList,
  transform
}
