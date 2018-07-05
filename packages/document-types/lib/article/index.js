const { compose } = require('ramda')

const Bold = require('./bold')
const Italic = require('./italic')
const Center = require('./center')
const Document = require('./document')
const Figure = require('./figure')
const Link = require('./link')
const Paragraph = require('./paragraph')
const Subhead = require('./subhead')
const Subscript = require('./subscript')
const Superscript = require('./superscript')
const Text = require('./text')
const TitleBlock = require('./titleBlock')
const InfoBox = require('./infoBox')
const Caption = require('./caption')
const HTML = require('./html')
const FigureGroup = require('./figureGroup')

module.exports = {
  fromMdast: compose(
    Bold.fromMdast,
    Italic.fromMdast,
    Center.fromMdast,
    Document.fromMdast,
    Figure.fromMdast,
    Link.fromMdast,
    Paragraph.fromMdast,
    Subhead.fromMdast,
    Subscript.fromMdast,
    Superscript.fromMdast,
    Text.fromMdast,
    InfoBox.fromMdast,
    HTML.fromMdast,
    FigureGroup.fromMdast
  ),
  toMdast: compose(
    Bold.toMdast,
    Italic.toMdast,
    Center.toMdast,
    Document.toMdast,
    Figure.toMdast,
    Link.toMdast,
    Paragraph.toMdast,
    Subhead.toMdast,
    Subscript.toMdast,
    Superscript.toMdast,
    Text.toMdast,
    TitleBlock.toMdast,
    Caption.toMdast,
    InfoBox.toMdast,
    HTML.toMdast,
    FigureGroup.toMdast
  )
}
