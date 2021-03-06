CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table if not exists "elections" (
  "id"           uuid primary key not null default uuid_generate_v4(),
  "slug"         varchar          not null,
  "description"  varchar          not null,
  "beginDate"    timestamptz      not null,
  "endDate"      timestamptz      not null,
  "numSeats"     integer          not null,
  "discussionId" uuid             not null references "discussions" on update cascade on delete cascade,
  "active"       boolean          not null default true,
  "result"       jsonb,
  "createdAt"    timestamptz               default now(),
  "updatedAt"    timestamptz               default now(),
  unique ("slug")
);

create table if not exists "electionCandidacies" (
  "id"             uuid primary key not null default uuid_generate_v4(),
  "userId"         uuid             not null references "users"  on update cascade on delete cascade,
  "electionId"     uuid             not null references "elections" on update cascade on delete cascade,
  "commentId"      uuid             references "comments",
  "recommendation" varchar,
  "createdAt"      timestamptz               default now(),
  "updatedAt"      timestamptz               default now(),
  unique ("userId", "electionId")
);

CREATE OR REPLACE FUNCTION refresh_associate_role(user_id uuid)
  RETURNS void AS $$
DECLARE
  _active boolean;
  _role text := 'associate';
BEGIN
  SELECT
         COALESCE(bool_or(active), false) INTO _active
  FROM
       memberships m
         JOIN
           users u
           ON m."userId"=u.id
         JOIN
           "membershipTypes" mt
           ON mt.id = m."membershipTypeId"
  WHERE
      u.id = user_id AND (mt.name = 'ABO' OR mt.name = 'BENEFACTOR_ABO');

  IF _active = true THEN
    PERFORM add_user_to_role(user_id, _role);
  ELSE
    PERFORM remove_user_from_role(user_id, _role);
  END IF;
END;
$$ LANGUAGE 'plpgsql';

CREATE OR REPLACE FUNCTION refresh_associate_role_trigger_function()
  RETURNS trigger AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM refresh_associate_role(NEW."userId");
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    PERFORM refresh_associate_role(NEW."userId");
    PERFORM refresh_associate_role(OLD."userId");
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM refresh_associate_role(OLD."userId");
    RETURN OLD;
  END IF;
END
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER trigger_associate_role
  AFTER INSERT OR UPDATE OR DELETE ON memberships
  FOR EACH ROW
EXECUTE PROCEDURE refresh_associate_role_trigger_function();


--Run once for all users
SELECT refresh_associate_role(id) FROM users;
