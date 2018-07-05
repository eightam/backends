module.exports = documentType => {
  switch (documentType) {
    case 'article':
      return require('./lib/article')
    default:
      return notFound => v => v
  }
}
