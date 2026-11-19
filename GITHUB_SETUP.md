# GitHub setup

GitHub stores the website's files. Each time you save a change there, it builds and publishes the site to Azure automatically.

## 1. Create a GitHub account
If you don't have one, sign up at <https://github.com/signup> (free).

## 2. Create a private repository
1. Sign in, then select **+** (top right) → **New repository**.
2. **Repository name:** `restora-massage-therapy`
3. Choose **Private**. Client data is never stored in GitHub, but the code is yours, so keep it private.
4. Leave "Add a README", ".gitignore" and "license" **unticked** (the project already has them).
5. Select **Create repository**.

## 3. Upload the project files
1. Extract `RESTORA_Massage_Therapy_Azure_GitHub.zip`. Open the `restora-massage-therapy` folder inside it.
2. Make hidden items visible, because the `.github` folder must be uploaded:
   - **Windows:** File Explorer → **View** → **Show** → **Hidden items**
   - **Mac:** in Finder press **Cmd + Shift + .** (period)
3. On your new repository page, select **uploading an existing file**.
4. Select **everything inside** the `restora-massage-therapy` folder (not the folder itself) and drag it onto the page. GitHub uploads folders with their contents.
5. Wait until every file shows as uploaded, then select **Commit changes**.
6. Check the repository's file list. You should see `.github`, `api`, `src`, `public`, `docs`, `package.json`, `staticwebapp.config.json` and the other files at the top level.

> If the web uploader skips the `.github` folder, create the file yourself: **Add file → Create new file**, type the name `.github/workflows/azure-static-web-apps.yml` (the slashes create the folders), paste in the contents of that file from the ZIP, and commit.

## 4. Add the Azure deployment secret
You'll get the token in [AZURE_DEPLOYMENT.md](AZURE_DEPLOYMENT.md), step 2.
1. In the repository: **Settings → Secrets and variables → Actions → New repository secret**.
2. **Name:** `AZURE_STATIC_WEB_APPS_API_TOKEN` (exactly this, in capitals)
3. **Secret:** paste the deployment token from Azure.
4. Select **Add secret**.

The token is stored encrypted by GitHub. **Never paste it into any file.**

## 5. Run the first deployment
Go to **Actions** → **Azure Static Web Apps CI/CD** → **Run workflow** (or make any small edit and commit). You'll see two jobs:
- **Check the code:** validates JSON, type-checks, and runs 54 automated tests on a temporary database.
- **Build and Deploy:** builds the website and API and publishes them to Azure.

A green tick means it's live. A red cross means something failed. Open the run to read the error. If the checks fail, the live site doesn't change.

## Making changes later
- Small text changes: open a file on GitHub, select the ✏️ pencil, edit, then **Commit changes**. The site redeploys in about 5 minutes.
- Prices, hours, contact details, services and therapists **don't need GitHub**. Change them in the website's Admin dashboard.
