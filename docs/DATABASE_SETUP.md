# Database setup (Azure Database for PostgreSQL)

The API creates every table by itself the first time it connects. You only create an empty database and give the API its address.

## 1. Create the server
1. Azure portal → search **Azure Database for PostgreSQL flexible servers** → **Create**.
2. **Resource group:** `restora-rg`. **Server name:** for example `restora-db` (it becomes `restora-db.postgres.database.azure.com`).
3. **Region:** the same region as your other resources (for example South Central US).
4. **PostgreSQL version:** 16 or 17.
5. **Workload type:** *Development* → **Configure server** → **Burstable, B1ms**. Storage: 32 GiB.
6. **High availability:** off to start. Turn it on later if you want automatic failover.
7. **Authentication:** *PostgreSQL authentication only*. Admin username `restoraadmin` and a **long, random password**. Save both in a password manager.

## 2. Networking
1. **Connectivity method:** *Public access (allowed IP addresses)*.
2. Tick **Allow public access from any Azure service within Azure to this server**.
   The website's API runs on shared Azure infrastructure without a fixed address, so it needs this. The database still requires the password and an encrypted (TLS) connection.
3. Don't add other IP addresses unless you need to connect from your own computer. If you do, add only your current address, and remove it afterwards.
4. **Review + create** → **Create** (takes about 5–10 minutes).

## 3. Require encrypted connections
Server → **Settings → Server parameters** → `require_secure_transport` should be **ON** (the default). The API always connects over TLS and checks the server certificate.

## 4. Allow the two extensions the app uses
Server → **Settings → Server parameters** → search `azure.extensions` → tick **BTREE_GIST** and **PGCRYPTO** → **Save**.

- `btree_gist` lets the database itself refuse two overlapping appointments for the same therapist (double-booking protection).
- `pgcrypto` generates record IDs.

## 5. Create the database
Server → **Settings → Databases** → **+ Add** → name `restora` → **Save**.

## 6. Backups
Server → **Settings → Backup and restore** (or Compute + storage → Backup) → set **Backup retention period** to **35 days**. Turn on **geo-redundant backup** if it's offered and fits your budget. It can only be chosen when creating a server in some regions.

Practise a restore once: **Backup and restore → Restore** creates a *copy* of the server at a past point in time. It doesn't overwrite your live database.

## 7. Your `DATABASE_URL`
Build it like this (no spaces):

```
postgresql://restoraadmin:YOUR-PASSWORD@restora-db.postgres.database.azure.com:5432/restora
```

If the password contains special characters such as `@ : / ? # %`, they must be *URL-encoded* (for example `@` becomes `%40`). The easiest fix is a long password made only of letters and numbers.

Add it to the Static Web App as the environment variable `DATABASE_URL` ([AZURE_DEPLOYMENT.md, step 5](AZURE_DEPLOYMENT.md#5-add-the-environment-variables)). Then open `/api/health` to confirm `"database":"ok"`.

## What happens on first start
The API applies `api/database/migrations/0001_schema.sql` and `0002_reference_data.sql` and records them in a `schema_migrations` table. Future updates that include new migrations apply themselves the same way. Runs are guarded so two servers never apply the same migration twice.

## Optional demo data
`database/seed-demo.sql` adds one **fictional** therapist and sample enhancement prices, for a test or staging database only. Run it with Azure's **Query editor** or any PostgreSQL tool **after** the tables exist. **Don't run it on your live database.**

## Least privilege (recommended once live)
The admin login you created can do anything. For tighter security, create a separate login for the app that can read and write data but can't drop tables. Do this after the first deployment has created the tables. A developer or Azure support can help. See [SECURITY.md](SECURITY.md#database).
