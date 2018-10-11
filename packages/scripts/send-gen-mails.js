#!/usr/bin/env node
require('@orbiting/backend-modules-env').config()
const { sendMailTemplate } = require('@orbiting/backend-modules-mail')
const Promise = require('bluebird')

const anreden = {
  'm': 'Lieber',
  'f': 'Liebe'
}

const anredenFormal = {
  'm': 'Sehr geehrter Herr',
  'f': 'Sehr geehrte Frau'
}

const kandidaten = {
  'm': 'Kandidat',
  'f': 'Kandidatin'
}

const recipients = require('./candidates-b.json')

const run = async () => {
  Promise.map(
    recipients,
    recipient => {
      if (recipient.send !== 'TRUE') {
        console.log(`omit mailing "${recipient.email}" (send != "FALSE")`)
        return
      }

      /*
      if (Math.random() > 0.05) {
        return
      }
      */

      // console.log('send')
      // return

      console.log(`${recipient.email}\t-> email`)

      console.log({
      // return sendMailTemplate({
        to: recipient.email,
        // to: 'stefan.scheidegger@republik.ch',
        // to: 'philipp.vonessen@republik.ch',
        // to: 'patrick.venetz@republik.ch',
        fromEmail: 'office@project-r.construction',
        fromName: 'Project R',
        subject: `Project R Genossenschaftsratswahl`,
        // subject: `Genossenschaftsrat Project R`,
        // subject: `Genossenschaftsrat Project R (templateName:${recipient.template})`,
        templateName: recipient.template,
        globalMergeVars: [
          { name: 'ANREDE',
            content: anreden[recipient.sex] },
          { name: 'ANREDE_FORMAL',
            content: anredenFormal[recipient.sex] },
          { name: 'NAME',
            content: recipient.Vorname },
          { name: 'NAME_FORMAL',
            content: recipient.Name },
          { name: 'ORT',
            content: recipient.location },
          { name: 'GENDERED_KANDIDAT_IN',
            content: kandidaten[recipient.sex] }
        ]
      })
    },
    { concurrency: 5 }
  )
}

run()
