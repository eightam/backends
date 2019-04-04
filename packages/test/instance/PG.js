const exec = require('util').promisify(require('child_process').exec)

const execAndLog = (command) =>
  exec(command)
    .catch(e =>
      console.error(`${command}\n${e.stderr}`)
    )

const create = (name) =>
  execAndLog(`psql -c 'create database ${name};' -U postgres`)

const drop = (name) =>
  execAndLog(`psql -c 'drop database ${name};' -U postgres`)

const getDatabaseUrl = (name) =>
  `postgres://postgres@localhost:5432/${name}`

const migrateUp = (url) =>
  execAndLog(`DATABASE_URL=${url} yarn run db:migrate:up`)

const createAndMigrate = async (name) => {
  try {
    try {
      await drop(name)
    } catch (e) {}
    await create(name)
    const url = getDatabaseUrl(name)

    await migrateUp(url)

    return {
      url,
      drop: () => drop(name)
    }
  } catch (e) {
    console.error(e)
    await drop(name)
    return null
  }
}

module.exports = {
  createAndMigrate
}