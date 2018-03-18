const MDAST = require('@orbiting/remark-preset')

module.exports = {
  id: async (commit) => {
    return commit.id()
  },
  message: async (commit) => {
    return commit.message()
  },
  document: async (commit) => {
    const tree = await commit.getTree()
    const entry = await tree.entryByName('article.md')
    if (!entry) {
      return null
    }
    const blob = await entry.getBlob()
    const content = await blob.toString()

    let mdast
    try {
      mdast = MDAST.parse(content)
    } catch (e) {
      console.error(e)
    }
    if (!mdast) {
      mdast = MDAST.parse('Dokument fehlerhaft. Reden Sie mit der IT.')
    }

    return mdast
  }
}
