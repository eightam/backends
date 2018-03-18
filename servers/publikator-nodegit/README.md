# publikator-nodegit-poc

This repo explores the usage of [nodegit](http://www.nodegit.org/) with local repositories instead of remote HTTP/GraphQL APIs of github as a foundation for publikator-backend.

In contrast to it's sibbling servers, this backend is mostly self contained inside it's directory (with expections like `@orbiting/remark-preset` or `@orbiting/backend-modules-env`).

This app authenticates itself to github via github's app auth. You can only access repos accessible by your configured envs: `GITHUB_APP_ID, GITHUB_APP_KEY, GITHUB_INSTALLATION_ID`.

Remote repos are cloned to `./git_workspace` by default, you can change that in .env (see .env.example).

## usage

```
cd servers/publikator-nodegit

cp .env.example .env

yarn install

yarn run dev

```

checkout [localhost:5040/graphiql](http://localhost:5040/graphiql?query=%7B%0A%20%20repo(id%3A%20%22republik-test%2Farticle-hiring-is-cool%22)%20%7B%0A%20%20%20%20id%0A%20%20%20%20latestCommit%20%7B%0A%20%20%20%20%20%20id%0A%20%20%20%20%20%20message%0A%20%20%20%20%20%20document%0A%20%20%20%20%7D%0A%20%20%7D%0A%7D%0A)
