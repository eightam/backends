CREATE TABLE "devices" (
  "id"            uuid primary key not null default uuid_generate_v4(),
  "userId"        uuid not null references users(id),
  "sessionId"     text not null unique references sessions(sid) ON UPDATE CASCADE ON DELETE CASCADE,
  "token"         text unique,
  "information"   jsonb,
  "createdAt"     timestamptz default now(),
  "updatedAt"     timestamptz default now()
);
