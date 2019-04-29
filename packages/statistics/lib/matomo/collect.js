const debug = require('debug')('statistics:lib:matomo:collect')
const Promise = require('bluebird')
const url = require('url')

const documents = require('../elastic/documents')

const EXCEPTIONAL_PATHNAMES = [
  '/',
  '/feuilleton',
  '/feed',
  '/rubriken',
  '/suche',
  '/verlag',
  '/lesezeichen',
  '/2018',
  '/2019'
]

const getPageUrlDetails = async ({ url }, { idSite, period, date, segment, matomo } = {}) => {
  return matomo.api({
    idSite,
    expanded: 1,
    limitBeforeGrouping: 1000,
    period,
    date,
    segment,

    actionName: url,

    // Not to overwrite (1)
    method: 'Transitions.getTransitionsForAction',
    actionType: 'url'
  })
}

const isPageUrlWanted = ({ url, parsedUrl }) => {
  if (parsedUrl && EXCEPTIONAL_PATHNAMES.includes(parsedUrl.pathname)) {
    return true
  }

  // Include user pages (/~<username>)
  if (url && url.match(/\/~.+/)) {
    return true
  }

  // Include format pages (/format/<format>)
  if (url && url.match(/\/format\/.*/)) {
    return true
  }

  // Include article pages but newsletters (and misspelled versions of it)
  if (url && url.match(/\/\d{4}\/\d{2}\/\d{2}\/.*$/) && !url.match(/-news?lew?tter/)) {
    return true
  }

  debug(`Unwanted page URL: "${url}"`)
  return false
}

const addBucket = (buckets, name, number = 0) => {
  if (!buckets[name]) {
    buckets[name] = 0
  }

  buckets[name] += number
}

const transformPageUrlDetails = ({ pageMetrics, previousPages, referrers }) => {
  const buckets = {}

  previousPages.map(({ referrals }) => {
    addBucket(buckets, 'previousPages.referrals', parseInt(referrals))
  })

  referrers.map(referrer => {
    const { shortName, visits, details = [] } = referrer

    // Matomo will return shortName "Direct Entry" instead of "direct" of there is
    // no visitiational data available.
    // @TODO: Report Bug to https://github.com/matomo-org/matomo
    if (shortName === 'Direct Entry' && visits === 0) {
      return
    }

    addBucket(buckets, `${shortName}.visits`, visits)
    addBucket(buckets, `${shortName}.referrals`)

    // An array with details e.g. Social Media
    details.map(detail => {
      const { label, referrals } = detail

      addBucket(buckets, `${shortName}.referrals`, parseInt(referrals))

      if (shortName === 'campaign' && label.match(/^republik\/news?lew?tter-editorial.+/)) {
        addBucket(buckets, 'campaign.newsletter.referrals', parseInt(referrals))
      }

      if (
        shortName === 'social' &&
        ['twitter', 'facebook', 'instagram', 'linkedin'].includes(label.toLowerCase())
      ) {
        addBucket(buckets, `${shortName}.${label.toLowerCase()}.referrals`, parseInt(referrals))
      }
    })
  })

  return { ...pageMetrics, ...buckets }
}

const getData = async ({ idSite, period, date, segment }, { matomo }) => {
  const data = []

  await matomo.scroll({
    idSite,
    method: 'Actions.getPageUrls',
    period,
    date,
    segment,
    flat: 1,
    enhanced: 1
  }, {
    rowCallback: async node => {
      node.parsedUrl = node.url && url.parse(node.url)
      if (!isPageUrlWanted(node)) {
        return false
      }

      const details = await getPageUrlDetails(node, { idSite, period, date, segment, matomo })
      if (!details) {
        return false
      }

      const transformedDetails = await transformPageUrlDetails(details, { period, date })

      const pageUrl = url.format(Object.assign({}, node.parsedUrl, { search: null, hash: null }))
      const result = {
        idSite,
        period,
        date,
        segment,
        url: pageUrl,
        label: node.label,
        nb_visits: node.nb_visits || 0,
        nb_uniq_visitors: node.nb_uniq_visitors || 0,
        nb_hits: node.nb_hits || 0,
        entry_nb_uniq_visitors: node.entry_nb_uniq_visitors || 0,
        entry_nb_visits: node.entry_nb_visits || 0,
        entry_nb_actions: node.entry_nb_actions || 0,
        entry_bounce_count: node.entry_bounce_count || 0,
        exit_nb_uniq_visitors: node.exit_nb_uniq_visitors || 0,
        exit_nb_visits: node.exit_nb_visits || 0,
        ...transformedDetails
      }

      const index = data.findIndex(row => row.url === pageUrl)

      if (index > -1) {
        const dupe = Object.assign({}, data[index])

        Object.keys(result).forEach(key => {
          if (dupe[key] && typeof dupe[key] === 'number') {
            dupe[key] += result[key]
          } else {
            dupe[key] = result[key]
          }
        })

        data[index] = dupe

        debug(`merged page URL ${node.url} data into ${pageUrl}`)
      } else {
        // New, no merge required.
        data.push(result)
        debug(`added data for page URL ${pageUrl}`)
      }
    }
  })

  return data
}

const enrichData = async ({ data }, { elastic }) => {
  const limit = 100
  let offset = 0
  let paths = []

  do {
    debug('enrichData', { limit, offset })

    paths = data.slice(offset, offset + limit).map(({ url }) => url.replace('https://www.republik.ch', ''))

    const docs = await documents({ paths }, { elastic })

    docs.map(doc => {
      const index = data.findIndex(({ url }) => url.replace('https://www.republik.ch', '') === doc.path)
      const { repoId, template, publishDate } = doc
      data[index] = { ...data[index], repoId, template, publishDate }
    })

    offset += limit
  } while (paths.length === limit)

  return data
}

const insertRows = async ({ rows = [], pgdb }) =>
  Promise.map(rows, async row => {
    const condition = { url: row.url, period: row.period, date: row.date, segment: row.segment ? row.segment : null }
    const hasRow = !!(await pgdb.public.statisticsMatomo.count(condition))
    if (hasRow) {
      await pgdb.public.statisticsMatomo.update(
        condition,
        { ...row, updatedAt: new Date() }
      )
    } else {
      await pgdb.public.statisticsMatomo.insert(
        row
      )
    }
  }, { concurrency: 1 })

const collect = async ({ idSite, period, date, segment }, { pgdb, matomo, elastic }) => {
  debug('collect %o', { idSite, period, date, segment })
  const data = await getData({ idSite, period, date, segment }, { matomo })

  debug('enrich %o', { idSite, period, date, segment })
  const rows = await enrichData({ data }, { elastic })

  await insertRows({ rows, pgdb })
  debug('done with %o', { idSite, period, date, segment, rows: rows.length })
}

module.exports = collect
