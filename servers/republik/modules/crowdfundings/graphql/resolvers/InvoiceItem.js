
module.exports = {
  label (option, args) {
    return option.label
  },

  qty ({ pledgeOptionAmount }) {
    return pledgeOptionAmount || 1
  },

  unitPrice (option) {
    return option.pledgeOptionPrice / 100 || undefined
  },

  lineTotal (option) {
    let lineTotal
    if (option.pledgeOptionPrice) {
      lineTotal = option.pledgeOptionPrice * option.pledgeOptionAmount
    }

    if (option.donation) {
      lineTotal = option.donation
    }

    if (option.discount) {
      lineTotal = option.discount
    }

    return lineTotal / 100
  },

  vatReference ({ vatReference }) {
    return vatReference
  }
}
