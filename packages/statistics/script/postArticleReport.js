#!/usr/bin/env node
require('@orbiting/backend-modules-env').config()

const debug = require('debug')('statistics:script:postReport')
const moment = require('moment')
const yargs = require('yargs')
const Promise = require('bluebird')
const mdastToString = require('mdast-util-to-string')
const { ascending, descending } = require('d3-array')

const PgDb = require('@orbiting/backend-modules-base/lib/pgdb')
const { publish: { postMessage } } = require('@orbiting/backend-modules-slack')
const elastic = require('@orbiting/backend-modules-base/lib/elastic').client()

const getMeta = require('../lib/elastic/documents')

const argv = yargs
  .option('date', {
    alias: 'd',
    coerce: moment
  })
  .option('relativeDate', {
    describe: 'ISO 8601 Time Interval e.g. P14D',
    alias: 'r',
    coerce: input => {
      return moment().subtract(moment.duration(input))
    },
    conclicts: ['date']
  })
  .option('limit', {
    alias: 'l',
    number: true,
    default: 5
  })
  .option('index-year', {
    describe: 'Use <index-year>\'s median e.g. 2018',
    alias: 'y',
    default: moment().subtract(1, 'year').format('YYYY'),
    coerce: v => moment(`${v}-01-01`)
  })
  .option('dry-run', {
    describe: 'Disable dry run to post to Slack',
    boolean: true,
    default: true
  })
  .check(argv => {
    if (!argv.date && !argv.relativeDate) {
      return `Check options. Either provide date, or relative date.`
    }

    return true
  })
  .help()
  .version()
  .argv

/**
 * Fetches index for a particular year.
 */
const getMatomoIndex = async ({ year, groupBy = 'url' }, { pgdb }) => {
  const index = await pgdb.public.statisticsIndexes.findOne({
    type: 'matomo',
    condition: `date:${year.format('YYYY')},segment:null,groupBy:${groupBy}`
  })

  return index.data
}

/**
 * Data per URL
 */
const getArticles = async ({ date, limit }, { pgdb }) => {
  const articlesOnDate = await pgdb.query(`
    SELECT
      sm.*,
      sm.entries + sm."previousPages.referrals" AS "relevant",
      ('${date.format('YYYY-MM-DD')}' - sm."publishDate"::date) + 1 AS "daysPublished"
      
    FROM "statisticsMatomo" sm
    WHERE
      sm."publishDate" BETWEEN '${date.format('YYYY-MM-DD')}' AND '${date.clone().add(1, 'day').format('YYYY-MM-DD')}'
      AND sm.date = '${date.format('YYYY-MM-DD')}'
      AND sm.segment IS NULL
      AND sm.template = 'article'
    
    ORDER BY sm."publishDate"::date DESC
  `)

  const previousArticles = await pgdb.query(`
    SELECT
      sm.*,
      ('${date.format('YYYY-MM-DD')}' - sm."publishDate"::date) + 1 AS "daysPublished"
      
    FROM "statisticsMatomo" sm
    WHERE
      sm."publishDate" < '${date.format('YYYY-MM-DD')}'
      AND sm.date = '${date.format('YYYY-MM-DD')}'
      AND sm.segment IS NULL
      AND sm.template = 'article'
    
    ORDER BY sm.nb_uniq_visitors DESC
    LIMIT :limit
  `, { limit })

  return [ ...articlesOnDate, ...previousArticles ]
    .slice(0, limit)
    .sort((a, b) => ascending(a.daysPublished, b.daysPublished))
}

/**
 * Finds values in {row} and calculates desired percentile usind
 * provided {index}.
 */
const appendPercentiles = ({ row, index, percentile = 'p50', prop = 'p50' }) => {
  const data = {}

  Object.keys(row).map(key => {
    if (index[`${key}.${percentile}`]) {
      data[key] = (1 / index[`${key}.${percentile}`] * row[key])
    }
  })

  return Object.assign({}, row, { [prop]: data })
}

const appendDocumentMeta = async ({ row }, { elastic }) => {
  const document = await getMeta({
    paths: [row.url.replace('https://www.republik.ch', '')]
  }, { elastic })

  return Object.assign({}, row, { document: document[0] })
}

PgDb.connect().then(async pgdb => {
  const { limit, indexYear, dryRun } = argv
  const date = argv.date || argv.relativeDate

  debug('Running query...', { date })

  try {
    /**
     * Articles
     */
    const index = await getMatomoIndex({ year: indexYear }, { pgdb })

    const articles = await getArticles({ date, limit }, { pgdb })
      .then(articles => articles.map(row => appendPercentiles({ row, index, prop: 'p50' })))
      .then(articles => Promise.map(
        articles,
        async row => appendDocumentMeta({ row }, { elastic }),
        { concurrency: 1 }
      ))
      .then(articles => articles.filter(({ document }) => !!document))
      .then(articles => articles.map(article => {
        const { document, daysPublished, p50 } = article

        const indexes = {
          visitors: p50.nb_uniq_visitors
        }

        const sources = {
          'via Newsletter': article['campaign.newsletter.referrals'],
          'via Kampagnen': article['campaign.referrals'] - article['campaign.newsletter.referrals'],

          'via Twitter': article['social.twitter.referrals'],
          'via Facebook': article['social.facebook.referrals'],
          'via Instagram': article['social.instagram.referrals'],
          'via LinkedIn': article['social.linkedin.referrals'],
          'via anderen sozialen Netwerken': article['social.referrals'] - article['social.twitter.referrals'] - article['social.facebook.referrals'] - article['social.instagram.referrals'] - article['social.linkedin.referrals'],

          'via Suchmaschinen': article['search.visits'],
          'via Dritt-Webseiten': article['website.referrals']
        }

        const allSources = Object.keys(sources).reduce((acc, curr) => acc + sources[curr], 0)

        const distributions = Object.keys(sources).map(key => {
          const ratio = 1 / allSources * sources[key]
          const percentage = Math.round(ratio * 1000) / 10

          if (percentage === 0) {
            return false
          }

          return { source: key, percentage }
        }).filter(Boolean)

        const block = {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: [
              `*<https://ultradashboard.republik.ch/public/dashboard/aa39d4c2-a4bc-4911-8a8d-7b23a1d82425?url=${document.path}|${document.title}>*`,
              `_${mdastToString({ children: document.credits }).replace(`, ${date.format('DD.MM.YYYY')}`, '')}_`,
              `*Besucher-Index ${Math.round(indexes.visitors * 100)}*` + (daysPublished > 1 ? ` (${daysPublished}. Tag)` : ''),
              distributions
                .sort((a, b) => descending(a.percentage, b.percentage))
                .map(({ source, percentage }) => `${source}: ${percentage}%`)
                .join(' ⋅ ')
            ].join('\n')
          }
        }

        if (document.image) {
          block.accessory = {
            type: 'image',
            image_url: document.image,
            alt_text: document.title
          }
        }

        return { ...article, block }
      }))

    console.log(JSON.stringify(articles.map(({ block }) => block), null, 2))

    if (!dryRun) {
      const blocks = [
        { type: 'section', text: { type: 'mrkdwn', text: `*Tagesrapport vom ${date.format('DD.MM.YYYY')}*` } }
      ]

      const today = articles.filter(b => b.daysPublished === 1)
      if (today.length > 0) {
        blocks.push({ type: 'divider' })
        blocks.push(
          { type: 'section', text: { type: 'mrkdwn', text: `*Artikel vom ${date.format('DD.MM.YYYY')}*` } }
        )
        today.forEach(({ block }) => blocks.push(block))
      }

      const earlier = articles.filter(b => b.daysPublished !== 1)
      if (earlier.length > 0) {
        blocks.push({ type: 'divider' })
        blocks.push(
          { type: 'section', text: { type: 'mrkdwn', text: `*Frühere Artikel*` } }
        )
        earlier.forEach(({ block }) => blocks.push(block))
      }

      blocks.push({ type: 'divider' })
      blocks.push(
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Über diese Daten: Ein Besucher-Index von 100 Punkten entspricht dem Median aus der Anzahl von Besuchern am Veröffentlichungstag pro Artikel in ${indexYear.format('YYYY')}. Quellen: <https://piwik.project-r.construction|Matomo> und <https://api.republik.ch/graphiql|api.republik.ch>.`
            }
          ]
        }
      )

      await postMessage({
        channel: '#statistik-dev',
        username: 'Carl Friedrich Gauß',
        icon_emoji: ':male-scientist:',
        blocks
      })
    }
  } catch (e) {
    console.error(e)
  }

  await pgdb.close()
})
