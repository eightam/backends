const grantsLib = require('../../lib/grants')

module.exports = {
  grants: async (campaign, args, { pgdb, user }) => {
    const grantee = campaign.user
      ? campaign.user
      : user // Use "me" user ID

    const grants =
      await grantsLib.findByGrantee(grantee, campaign, pgdb)

    return grants
  }
}
