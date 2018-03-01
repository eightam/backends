const fetch = require('isomorphic-unfetch')
const querystring = require('querystring')

const {
  PIWIK_TOKEN,
  PIWIK_URL,
  PIWIK_SITE_ID
} = process.env

module.exports = async (_, args) => {
  const url = PIWIK_URL + '?' + querystring.stringify({
    token_auth: PIWIK_TOKEN,
    format: 'json',
    module: 'API',
    method: 'Actions.getPageUrl',
    pageUrl: args.url,
    idSite: PIWIK_SITE_ID,
    // period: 'range',
    // date: '2018-01-01,2019-01-01'
    period: 'year',
    date: '2018-01-01'
  })

  const result = await fetch(url, {
    method: 'GET'
  })
  const jsonResult = (await result.json())[0]
  // console.log(jsonResult)

  return {
    visits: jsonResult.nb_visits,
    uniqueVisitors: jsonResult.nb_uniq_visitors
  }
}
