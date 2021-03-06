const { Roles } = require('@orbiting/backend-modules-auth')
const {dateRangeFilterWhere,
  stringArrayFilterWhere,
  booleanFilterWhere,
  andFilters
} = require('../../../lib/Filters')
const { transformUser } = require('@orbiting/backend-modules-auth')

// Lower threshold requires word(s) to be more similar
const WORD_SIMILARITY_THRESHOLD = 0.6

module.exports = async (
  _,
  { limit, offset = 0, orderBy, search, dateRangeFilter, stringArrayFilter, booleanFilter },
  { pgdb, user }
) => {
  Roles.ensureUserHasRole(user, 'supporter')

  const queryFilters = !!(dateRangeFilter || stringArrayFilter || booleanFilter) &&
    andFilters([
      dateRangeFilterWhere(dateRangeFilter, 'u'),
      stringArrayFilterWhere(stringArrayFilter, 'u'),
      booleanFilterWhere(booleanFilter, 'u')
    ])

  const queryOrderBy = search
    ? 'word_sim'
    : orderBy
      ? `u."${orderBy.field}" ${orderBy.direction}`
      : 'u."createdAt" ASC'

  let items = !(search || queryFilters)
    ? await pgdb.public.users.findAll({
      orderBy: orderBy
        ? `"${orderBy.field}" ${orderBy.direction}`
        : '"createdAt" ASC'
    })
    : await pgdb.query(`
      WITH raw AS (
        SELECT
          u.*
          ${search ? `,
            concat_ws(' ',
              u."firstName"::text,
              u."lastName"::text,
              u.email::text,
              u.username::text,
              string_agg(DISTINCT concat_ws(' ', a.name, a.line1, a.line2, 'plz:' || a."postalCode", a.city, a.country), ' '::text),
              string_agg(DISTINCT 'nr:' || m."sequenceNumber"::text, ' '::text),
              string_agg(DISTINCT 'voucher:' || m."voucherCode"::text, ' '::text),
              string_agg(DISTINCT 'hrid:' || pay.hrid, ' '::text),
              string_agg(DISTINCT 'pspid:' || pay."pspId", ' '::text),
              string_agg(DISTINCT 'access:' || agg."voucherCode", ' '::text),
              string_agg(DISTINCT 'access:' || agr."voucherCode", ' '::text)
            ) <->> :search AS word_sim
          ` : ', 0::float AS word_sim'}
        FROM
          users u
        LEFT JOIN
          addresses a
          ON a.id = u."addressId"
        LEFT JOIN
          memberships m
          ON m."userId" = u.id
        LEFT JOIN
          "pledges" p
          ON p."userId" = u.id
        LEFT JOIN
          "pledgePayments" ppay
          ON ppay."pledgeId" = p.id
        LEFT JOIN
          "payments" pay
          ON pay.id = ppay."paymentId"
        LEFT JOIN
          "accessGrants" agg
          ON agg."granterUserId" = u.id
        LEFT JOIN
          "accessGrants" agr
          ON agr."recipientUserId" = u.id
        ${queryFilters ? `WHERE ${queryFilters}` : ''}
        GROUP BY
          u.id
        ${queryOrderBy ? `ORDER BY ${queryOrderBy}` : ''}
      )
        SELECT * FROM raw
        WHERE
          word_sim < :WORD_SIMILARITY_THRESHOLD
     `, {
      search: search ? search.trim() : null,
      fromDate: dateRangeFilter ? dateRangeFilter.from : null,
      toDate: dateRangeFilter ? dateRangeFilter.to : null,
      stringArray: stringArrayFilter ? stringArrayFilter.values : null,
      booleanValue: booleanFilter ? booleanFilter.value : null,
      WORD_SIMILARITY_THRESHOLD
    })
  const count = items.length
  items = items.slice(offset, offset + limit).map(transformUser)
  return { items, count }
}
