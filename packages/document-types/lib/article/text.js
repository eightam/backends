const {
  ifElse,
  compose,
  always,
  split,
  intersperse,
  map,
  objOf
} = require('ramda')

const { safeProp } = require('@orbiting/backend-modules-transform/lib/common')

const S = require('@orbiting/backend-modules-transform/lib/slate')
const M = require('@orbiting/backend-modules-transform/lib/mdast')

module.exports = {
  fromMdast: compose(
    ifElse(M.isText, S.toText),
    ifElse(
      M.isBreak,
      compose(S.toText, always({ value: '\n' }))
    )
  ),
  toMdast: ifElse(
    S.isText,
    compose(
      intersperse(M.toBreak()),
      map(compose(M.toText, objOf('value'))),
      split('\n'),
      safeProp('value')
    )
  )
}
