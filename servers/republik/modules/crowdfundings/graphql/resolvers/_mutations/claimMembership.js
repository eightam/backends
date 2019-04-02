const logger = console
const moment = require('moment')
const Promise = require('bluebird')

const { ensureSignedIn } = require('@orbiting/backend-modules-auth')

const cancelMembership = require('./cancelMembership')
const createCache = require('../../../lib/cache')

module.exports = async (_, args, {pgdb, req, t, mail, mail: {enforceSubscriptions}}) => {
  ensureSignedIn(req)

  let pledgerId
  const transaction = await pgdb.transactionBegin()

  try {
    const { voucherCode } = args
    const membership = await transaction.public.memberships.findOne({
      voucherCode,
      voucherable: true,
      active: false
    })

    if (!membership) {
      throw new Error(t('api/membership/claim/invalidToken'))
    }

    const now = new Date()

    pledgerId = membership.userId

    const activeMemberships = await transaction.public.memberships.find({
      userId: req.user.id,
      active: true
    })

    const hasActiveMembership = activeMemberships.length > 0

    // transfer new membership, and remove voucherCode
    await transaction.public.memberships.updateOne(
      { id: membership.id },
      {
        userId: req.user.id,
        voucherCode: null,
        voucherable: false,
        // Set added membership.active to false if other membership is still
        // active.
        active: !hasActiveMembership,
        renew: !hasActiveMembership,
        updatedAt: now
      }
    )

    if (!hasActiveMembership) {
      // generate interval
      const beginDate = moment(now)
      const endDate = beginDate.clone().add(
        membership.initialPeriods,
        membership.initialInterval
      )

      await transaction.public.membershipPeriods.insert({
        membershipId: membership.id,
        pledgeId: membership.pledgeId,
        beginDate,
        endDate
      })
    } else {
      // Cancel active memberships.
      await Promise.map(
        await transaction.public.memberships.find({
          'id !=': membership.id,
          userId: req.user.id,
          renew: true
        }),
        m => cancelMembership(
          null,
          {
            id: m.id,
            details: {
              type: 'SYSTEM',
              reason: 'Auto Cancellation (claimMembership)',
              suppressConfirmation: true,
              suppressWinback: true
            }
          },
          { req, t, pgdb: transaction, mail }
        )
      )
    }

    const cache = createCache({ prefix: `User:${req.user.id}` })
    cache.invalidate()

    // commit transaction
    await transaction.transactionCommit()
  } catch (e) {
    await transaction.transactionRollback()
    logger.info('transaction rollback', { req: req._log(), args, error: e })
    throw e
  }

  if (pledgerId) {
    try {
      await enforceSubscriptions({ pgdb, userId: pledgerId })
      await enforceSubscriptions({
        pgdb,
        userId: req.user.id,
        subscribeToEditorialNewsletters: true
      })
    } catch (e) {
      // ignore issues with newsletter subscriptions
      logger.error('newsletter subscription changes failed', { req: req._log(), args, error: e })
    }
  }

  return true
}
