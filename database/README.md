# Database files

| File | What it is |
| --- | --- |
| `../api/database/migrations/0001_schema.sql` | The full database structure (tables, double-booking protection, locked SOAP notes, append-only audit log). |
| `../api/database/migrations/0002_reference_data.sql` | Starting data: the five massage services and their prices, enhancements, screening checklists, consent forms, SOAP templates and default settings. |
| `seed-demo.sql` | **Optional, fictional** demo data (one demo therapist and sample enhancement prices) for testing. Never run it on the live database. |

The migrations live inside the `api` folder because Azure only deploys that folder with the API. **You don't run them yourself.** The API applies any new migration automatically the first time it starts after a deployment, and it records what it has applied in a `schema_migrations` table.

See `../docs/DATABASE_SETUP.md` to create the database in Azure.
