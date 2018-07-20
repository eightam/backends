const _ = require('lodash')

module.exports = {
  number ({ prefix, sequence }) {
    return [
      prefix,
      sequence
    ].join('-')
  },

  date ({ createdAt }) {
    return createdAt
  },

  issuer ({ data }) {
    const {
      companyInvoiceAddress: address,
      companyInvoiceVatin: vatin
    } = data.entity

    return [address, vatin].join('\n')
  },

  recipient ({ data }) {
    if (data.address.addressId) {
      const {
        addressName: name,
        addressLine1: address1,
        addressLine2: address2,
        addressPostalCode: postalCode,
        addressCity: city,
        addressCountry: country
      } = data.address

      return _.compact(
        [
          name,
          address1,
          address2,
          `${postalCode} ${city}`,
          country
        ]
      ).join('\n')
    }

    const {
      userEmail: email,
      userLastName: lastName,
      userFirstName: firstName
    } = data.user

    return _.compact(
      [
        `${firstName} ${lastName}`,
        email
      ]
    ).join('\n')
  },

  items ({ data }) {
    return data.options
  },

  total ({ data }) {
    return data.payment.paymentTotal / 100
  },

  vatReferences ({ data }, args, { t }) {
    return data.vatReferences.map((vat, index) => ({
      reference: index + 1,
      label: t('api/payment/invoice/vat', { value: vat / 100 }),
      value: vat / 100
    }))
  },

  bankdetails ({ data }) {
    const {
      companyInvoiceBankdetails: bankdetails
    } = data.entity

    return bankdetails
  }
}
