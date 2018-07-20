#!/usr/bin/env node

/**
 * WORK IN PROGRESS
 * NOT FOR PRODUCTION USE JUST YET
 */

require('@orbiting/backend-modules-env').config()

const _ = require('lodash')
const debug = require('debug')('republik:script:generate-receipts')
const Promise = require('bluebird')
const yargs = require('yargs')

const t = require('../lib/t')

// Splits all invoice inserts into chunks of INSERT_CHUNKS
const INSERT_CHUNKS = 10000

// Change format version if data structure changes.
const DATA_FORMAT_VERSION = 1

const argv = yargs
  .option('from', {
    description: 'Payments created on or after give date',
    default: '2017-01-01',
    coerce: arg => new Date(arg).toISOString()
  })
  .option('to', {
    description: 'Payments created before given date',
    default: new Date().toISOString(),
    coerce: arg => new Date(arg).toISOString()
  })
  .option('dry-run', {
    description: 'Do not persist generated data',
    boolean: true,
    default: true
  })
  .argv

const PgDb = require('@orbiting/backend-modules-base/lib/pgdb')

const query = `
SELECT
  -- [1] Payment
  payments.id AS "paymentId",
  payments.method AS "paymentMethod",
  payments.status AS "paymentStatus",
  payments.total AS "paymentTotal",
  payments."createdAt" AS "paymentCreatedAt",
  payments."updatedAt" AS "paymentUpdatedAt",

  -- [1] Pledge
  pledges.id AS "pledgeId",
  pledges.total AS "pledgeTotal",
  pledges.donation AS "pledgeDonation",

  -- [1] Entity
  companies.id AS "companyId",
  companies."name" AS "companyName",
  companies."invoiceAddress" AS "companyInvoiceAddress",
  companies."invoiceVatin" AS "companyInvoiceVatin",
  companies."invoiceBankdetails" AS "companyInvoiceBankdetails",
  companies."invoiceNumPrefix" AS "companyInvoiceNumPrefix",

  -- [1] Recipient
  users.id AS "userId",
  users.email AS "userEmail",
  users."firstName" AS "userFirstName",
  users."lastName" AS "userLastName",

  -- (optional) [1] Recipient address
  addresses.id AS "addressId",
  addresses."name" AS "addressName",
  addresses."line1" AS "addressLine1",
  addresses."line2" AS "addressLine2",
  addresses."postalCode" AS "addressPostalCode",
  addresses."city" AS "addressCity",
  addresses."country" AS "addressCountry",

  -- [n] Options (Articles)
  "pledgeOptions"."templateId" AS "pledgeOptionTemplateId",
  "pledgeOptions"."amount" AS "pledgeOptionAmount",
  "pledgeOptions"."price" AS "pledgeOptionPrice",
  "pledgeOptions"."vat" AS "pledgeOptionVat",
  "rewards"."type" AS "rewardType",
  "packages"."name" AS "packageName",
  "goodies"."name" AS "goodieName"

FROM payments

-- join articles, appearing on receipt
INNER JOIN "pledgePayments"
  ON payments.id = "pledgePayments"."paymentId"

INNER JOIN pledges
  ON "pledgePayments"."pledgeId" = pledges.id

INNER JOIN "pledgeOptions"
  ON pledges.id = "pledgeOptions"."pledgeId"

INNER JOIN "packageOptions"
  ON "pledgeOptions"."templateId" = "packageOptions"."id"

INNER JOIN packages
  ON "packageOptions"."packageId" = packages.id

INNER JOIN rewards
  ON "packageOptions"."rewardId" = rewards.id

LEFT OUTER JOIN goodies
  ON rewards.id = goodies."rewardId"

INNER JOIN companies
  ON packages."companyId" = companies.id

-- join a user
INNER JOIN users
  ON pledges."userId" = users.id

-- (optional) join a user's address
LEFT OUTER JOIN addresses
  ON users."addressId" = addresses.id

WHERE payments."createdAt" >= '${argv.from}'
  AND payments."createdAt" < '${argv.to}'

ORDER BY payments."createdAt", payments.id
`

const paymentFields = [
  'paymentId',
  'paymentMethod',
  'paymentStatus',
  'paymentTotal',
  'paymentCreatedAt',
  'paymentUpdatedAt',
  'pledgeId',
  'pledgeTotal',
  'pledgeDonation'
]

const entityFields = [
  'companyId',
  'companyName',
  'companyInvoiceAddress',
  'companyInvoiceVatin',
  'companyInvoiceBankdetails',
  'companyInvoiceNumPrefix'
]

const userFields = [
  'userId',
  'userEmail',
  'userFirstName',
  'userLastName'
]

const addressFields = [
  'addressId',
  'addressName',
  'addressLine1',
  'addressLine2',
  'addressCity',
  'addressPostalCode',
  'addressCountry'
]

const optionFields = [
  'pledgeOptionTemplateId',
  'pledgeOptionAmount',
  'pledgeOptionPrice',
  'pledgeOptionVat',
  'rewardType',
  'packageName',
  'goodieName'
]

let receiptCount = 0
let invalidReceiptCount = 0
const paymentStatusCount = {}
const numbering = {}

/**
 * Fetches records from invoices table, finds latest sequence number per prefix
 * and sets it in numbering object.
 *
 * @param  {[type]}  pgdb [description]
 * @return {Promise}      [description]
 */
const restoreNumbering = async (pgdb) => {
  // Prep numbering
  const statesNumbering = await pgdb.query(
    `SELECT prefix, MAX(sequence) AS sequence FROM invoices GROUP BY prefix`
  )

  statesNumbering.forEach(realm => { numbering[realm.prefix] = realm.sequence })

  debug('restored numbering', numbering)
}

/**
 * Sanity check if paymentTotal sums up to pledge options and donations.
 *
 * @param  {[type]}  payment [description]
 * @param  {[type]}  options [description]
 * @return {Boolean}         [description]
 */
const hasValidTotal = ({ payment, options }) => {
  let optionsTotal = 0

  options.forEach(option => {
    optionsTotal += option.pledgeOptionAmount * option.pledgeOptionPrice
  })

  // All articles, plus an expected donation (or reduction) should sum up to
  // a payments total amount.
  return (optionsTotal + payment.pledgeDonation) === payment.paymentTotal
}

/**
 * Returns invoice prefix for a particular data set.
 *
 * @param  {Object} entity [description]
 * @return {[type]}        [description]
 */
const getPrefix = ({ entity }) => {
  return entity && entity.companyInvoiceNumPrefix
}

/**
 * Returns next sequence number for a prefix for a specific data record.
 *
 * @param  {Object} data [description]
 * @return {[type]}      [description]
 */
const getSequence = (data) => {
  const prefix = getPrefix(data)

  if (prefix && prefix.length > 0) {
    if (!numbering[prefix]) {
      numbering[prefix] = 0
    }
  }

  return ++numbering[prefix]
}

/**
 * Generates an invoice object with provided data.
 *
 * @param  {Object} data
 * @return {Object}
 */
const generateInvoice = (data) => {
  receiptCount++

  if (!paymentStatusCount[data.payment.paymentStatus]) {
    paymentStatusCount[data.payment.paymentStatus] = 1
  } else {
    paymentStatusCount[data.payment.paymentStatus]++
  }

  data.formatVersion = DATA_FORMAT_VERSION
  data.sequence = getSequence(data)
  data.prefix = getPrefix(data)

  // Remove options which have amount 0
  data.options = data.options.filter(option => option.pledgeOptionAmount > 0)

  if (!hasValidTotal(data)) {
    invalidReceiptCount++
    debug('generateInvoice', 'invalid total', data)
  }

  // Add donation or discount option
  if (data.payment.pledgeDonation > 0) {
    data.options.push({
      donation: data.payment.pledgeDonation
    })
  } else if (data.payment.pledgeDonation < 0) {
    data.options.push({
      discount: data.payment.pledgeDonation
    })
  }

  // Generate a vat reference table
  data.vatReferences = []
  data.options = data.options.map(option => {
    // VAT reference of an option
    if (option.pledgeOptionVat > 0) {
      if (data.vatReferences.indexOf(option.pledgeOptionVat) < 0) {
        data.vatReferences.push(option.pledgeOptionVat)
      }

      option.vatReference =
        data.vatReferences.indexOf(option.pledgeOptionVat) + 1
    }

    // Labeling
    if (option.goodieName) {
      option.label = t(`api/payment/invoice/item/goodie/${option.goodieName}`)
    } else if (option.packageName) {
      option.label = t(`api/payment/invoice/item/package/${option.packageName}`)
    } else if (option.donation) {
      option.label = t(`api/payment/invoice/item/donation`)
    } else if (option.discount) {
      option.label = t(`api/payment/invoice/item/discount`)
    } else {
      throw new Error('Unable to determine label', option)
    }

    return option
  })

  if (Math.random() < 0.001) {
    debug('generateInvoice', data)
  }

  return {
    sequence: data.sequence,
    prefix: data.prefix,
    paymentId: data.payment.paymentId,
    createdAt: data.payment.paymentCreatedAt,
    data
  }
}

/**
 * Fetches payments, generates invoices and stores them into database.
 */
const execute = async () => {
  // Connect to pgogi
  const pgdb = await PgDb.connect()

  await restoreNumbering(pgdb)

  const rows = await pgdb.query(query)
  debug('rows found', { rows: rows.length })

  const invoices = []
  let options = []

  rows.forEach((row, index, rows) => {
    options.push({ ..._.pick(row, optionFields) })

    // Data is flattened and by paymentId; once paymentId changes a receipt
    // should be generated.)
    if (
      // Check if next row exists
      rows[index + 1] === undefined ||
      // Check if next row is a new payment
      rows[index + 1].paymentId !== row.paymentId
    ) {
      const data = {
        payment: _.pick(row, paymentFields),
        entity: _.pick(row, entityFields),
        user: _.pick(row, userFields),
        address: _.pick(row, addressFields),
        options
      }

      invoices.push(generateInvoice(data))

      // Reset to next payment
      options = []
    }
  })

  if (!argv.dryRun) {
    debug('beginning "invoices" inserts...')

    await Promise.each(
      _.chunk(invoices, INSERT_CHUNKS),
      chunk => pgdb.public.invoices.insert(chunk)
    )

    debug('"invoices" inserts done')
  } else {
    debug('dry-run')
  }

  debug(
    'execute results',
    { receiptCount, invalidReceiptCount, paymentStatusCount }
  )

  pgdb.close()
}

execute()
