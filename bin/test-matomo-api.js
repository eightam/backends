
require('@orbiting/backend-modules-env').config()
const PgDb = require('@orbiting/backend-modules-base/lib/pgdb')

const PiwikClient = require('piwik-client')
const client = new PiwikClient(
  'https://piwik.project-r.construction',
  // 'https://republik-matomo-staging.herokuapp.com',
  '8e387f67fee6424c4b6f90530201372c'
)
const debug = require('debug')('test')
const Promise = require('bluebird')
const url = require('url')
const moment = require('moment')

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

/**
  - **visitors index** -> OK
  - twitter index -> OK
  - facebook index -> OK
  - google index -> search-engines index -> OK
  - newsletter index -> OK
  - kampagne index -> OK
  - share index -> all social index -> OK
  - member visitors index -> (unable, yet)
 */

const api = (options) => {
  // debug('api()', { options })
  // const hrstart = process.hrtime()
  /*
  return retry (async bail => {
    return new Promise((resolve, reject) => {
      client.api(
        options,
        (err, response) => {
          if (err) {
            debug('err!', { err })
            reject(err)
          }

          const hrend = process.hrtime(hrstart)
          debug('%ds %dms', hrend[0], hrend[1] / 1000000)

          resolve(response)
        }
      )
    })
  }, {
    retries: 5,
    onRetry: () => { debug('retry...') }
  }) */

  return new Promise((resolve, reject) => {
    client.api(
      options,
      (err, response) => {
        if (err) {
          reject(err)
        }

        // const hrend = process.hrtime(hrstart)
        // debug('%ds %dms', hrend[0], hrend[1] / 1000000)

        resolve(response)
      }
    )
  })
}

const scroll = async (
  options,
  {
    idSite,
    limit = false, // Rows
    size = 1000,
    offset = 0,
    rowCallback = () => {},
    bulkCallback = () => {}
  } = {}
) => {
  let results = []
  const pagination = Object.assign({}, { offset, size })

  do {
    results = await api({
      idSite,
      ...options,
      filter_offset: pagination.offset,
      filter_limit: pagination.size
    })

    if (limit && limit <= pagination.offset + results.length - offset) {
      debug('limit!', {
        limit,
        offset,
        paginationOffset: pagination.offset,
        resultsLenth: results.length
      })
      results = results.slice(0, results.length + (limit - (pagination.offset + results.length - offset)))
    }

    await Promise.map(results, rowCallback, { concurrency: 1 })
    await bulkCallback(results)

    pagination.offset += pagination.size
  } while (results.length === pagination.size)
}

const getPageUrlDetails = async ({ url }, { idSite, period, date } = {}) => {
  return api({
    // Presets
    idSite,
    expanded: 1,
    limitBeforeGrouping: 1000,

    // Options via argument
    period,
    date,
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

  if (url && url.match(/\/format\/.*/)) {
    return true
  }

  if (url && url.match(/\/\d{4}\/\d{2}\/\d{2}\/.*$/) && !url.match(/-newsletter/)) {
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

      if (shortName === 'campaign' && label.match(/^republik\/newslew?tter-editorial.+/)) {
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

const getData = async ({ idSite, period, date }) => {
  const data = []

  await scroll({
    idSite,
    method: 'Actions.getPageUrls',
    period,
    date,
    flat: 1,
    enhanced: 1
  }, {
    // limit: 10,
    // offset: Math.round(Math.random() * 100),

    // @TODO: Maybe store Actions.getPageUrls request response in database
    // Amount of data is large. So maybe not. Query is not that expensive.

    rowCallback: async node => {
      node.parsedUrl = node.url && url.parse(node.url)
      if (!isPageUrlWanted(node)) {
        return false
      }

      const details = await getPageUrlDetails(node, { idSite, period, date })
      if (!details) {
        return false
      }

      // @TODO: Since expensive, save raw request response in database
      // { idSite, period, date, node(?), details }
      // Query database first.

      const transformedDetails = await transformPageUrlDetails(details, { period, date })

      const pageUrl = url.format(Object.assign({}, node.parsedUrl, { search: null, hash: null }))
      const result = { period, date, url: pageUrl, ...transformedDetails }

      const index = data.findIndex(row => row.url === pageUrl)

      if (index > -1) {
        const dupe = Object.assign({}, data[index])

        Object.keys(result).forEach(key => {
          if (key === 'url') {
            return
          }

          if (dupe[key] && typeof dupe[key] === 'number') {
            dupe[key] += result[key]
          } else {
            dupe[key] = result[key]
          }
        })

        data[index] = dupe

        debug(`merged page URL data ${pageUrl}`)
      } else {
        // New, no merge required.
        data.push(result)
      }

      debug(`page URL: ${pageUrl}`)
    }
  })

  return data
}

const insertRows = async ({ data = [], pgdb }) => {
  return Promise.map(data, async row => {
    const condition = { url: row.url, period: row.period, date: row.date }
    const hasRow = !!(await pgdb.public.matomo.count(condition))
    if (hasRow) {
      await pgdb.public.matomo.update(condition, { ...row, updatedAt: new Date() })
    } else {
      await pgdb.public.matomo.insert(row)
    }
  }, { concurrency: 1 })
}

PgDb.connect().then(async pgdb => {
  const firstDate = moment().subtract(14, 'days')
  const lastDate = moment().subtract(1, 'days')

  const dates = []

  for (let date = moment(firstDate); date <= moment(lastDate); date = moment(date).add(1, 'day')) {
    dates.push(date.format('YYYY-MM-DD'))
  }

  await Promise.each(dates, async date => {
    debug(`${date}...`)
    const data = await getData({ idSite: 5, period: 'day', date })
    await insertRows({ data, pgdb })
  })

  await pgdb.close()
})

/*
const test = async () => {
  const details = await getPageUrlDetails({
    url: 'https://www.republik.ch/2019/03/20/macht-und-ohnmacht'
  }, {
    idSite: 5,
    period: 'day',
    date: '2019-03-20'
  })

  // console.log(details)

  console.log(details.referrers.find(r => r.shortName === 'search'))
}

const test = async () => {
  const response = await api({
    idDimension: 1,
    idSite: 5,
    method: 'CustomDimensions.getCustomDimension',
    period: 'day',
    date: '2019-03-20',
    expanded: 1,
    flat: 1
  })

  console.log({ response })
}

test()
*/
