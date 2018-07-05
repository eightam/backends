const { uncurryN, identity, ifElse } = require('ramda')
const {
  withFlatMarks,
  withNestedMarks
} = require('./lib/slate')
const {
  isText
} = require('./lib/mdast')
const { log } = require('./lib/common')

const { transform } = require('./lib/transform')

const mdastNotFound = v =>
  log(
    'Skip value. No transformer found for MDAST node:\n',
    v
  ) && null

const slateNotFound = v =>
  log(
    'Skip value. No transformer found for Slate node:\n',
    v
  ) && null

const mdastToSlate = uncurryN(2, rule =>
  transform(withFlatMarks(rule(mdastNotFound)))
)

const slateToMdast = uncurryN(2, rule =>
  transform(withNestedMarks(rule(slateNotFound)))
)

const mdastToTyped = uncurryN(2, rule =>
  transform(
    ifElse(
      isText,
      identity,
      rule(mdastNotFound)
    )
  )
)

module.exports = {
  mdastToSlate,
  slateToMdast,
  mdastToTyped
}
