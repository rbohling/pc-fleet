# PC Fleet

PC inventory for a single manager: asset tags, models, serials, locations, assigned users, check-in/out history, printable Code 39 labels, CSV import/export, and JSON backup download.

## Requirements

- Node.js 24 or newer
- pnpm 11.25.0
- For production deployments: an Azure SQL database and Azure App Service with Microsoft Entra ID authentication

Node.js 24 is required because the local database uses the built-in `node:sqlite` module.

## Install and run locally

Clone the repository, install the pinned dependencies, and start the server:

```sh
git clone https://github.com/rbohling/pc-fleet.git
cd pc-fleet
npm install --global pnpm@11.25.0
pnpm install --frozen-lockfile
pnpm start
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000) in your browser. Local mode binds to loopback only and does not require login. Inventory is stored in `data/fleet.sqlite`, which is created automatically on first startup.

To use a different local database file, set `DATA_FILE` before starting:

```sh
DATA_FILE=/path/to/fleet.sqlite pnpm start
```

Run the API integration tests with:

```sh
pnpm test
```

## Install with Docker

Build and run the production image:

```sh
docker build -t pc-fleet .
docker run --name pc-fleet \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  -e WEBSITE_SITE_NAME=pc-fleet \
  -e ADMIN_OBJECT_ID=<entra-object-id> \
  -e SQL_CONNECTION_STRING='<sql-connection-string>' \
  pc-fleet
```

The container listens on port `8080`. Production mode requires Azure App Service Easy Auth to provide the authenticated identity headers, so use the Docker command above for connectivity checks only unless those headers are supplied by a trusted authentication proxy. Never expose the production container directly to the internet without an authentication boundary.

## Deploy to Azure

1. Create an Azure SQL database and run [`azure/schema.sql`](azure/schema.sql) once against an empty database.
2. Build the image and push it to Azure Container Registry:

   ```sh
   docker build -t <registry>.azurecr.io/pc-fleet:latest .
   docker push <registry>.azurecr.io/pc-fleet:latest
   ```

3. Create a Linux Azure App Service using that image. Configure the container target port as `8080` (`WEBSITES_PORT=8080` for classic container configuration).
4. Enable App Service Authentication with Microsoft Entra ID. Require authentication for all requests and restrict access to the authorized manager account. Enable **HTTPS Only**.
5. Add these App Service application settings:

   | Setting | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `PORT` | `8080` |
   | `ADMIN_OBJECT_ID` | Object ID of the authorized Entra user |
   | `SQL_CONNECTION_STRING` | Encrypted connection string for the Azure SQL database |

   `WEBSITE_SITE_NAME` is supplied by App Service. Store SQL credentials in App Service settings or Azure Key Vault, never in the repository.

6. Give the application’s dedicated SQL identity `SELECT` and `UPDATE` permission on `dbo.FleetState`. Use an administrative connection only for the initial schema setup.
7. Configure SQL network access for the App Service outbound addresses or private networking, then restart the app.
8. Verify that anonymous visitors are redirected to sign-in, the authorized account can access inventory, and another account is denied. Add a test PC, check it out and back in, restart the App Service, and confirm the record remains.

Production startup fails unless `WEBSITE_SITE_NAME`, `ADMIN_OBJECT_ID`, and `SQL_CONNECTION_STRING` are configured. Review Azure SQL backup retention and test recovery before entering real inventory.

## Using the application

Start with `import-template.csv`. Required CSV headers are `tag` and `model`; optional headers are `serial`, `location`, and `notes`. Imported PCs start as **Available**. Select PCs and choose **Print labels** to print 80 × 38 mm Code 39 labels; test at 100% scale.

Configure a USB barcode scanner for Code 39 with an Enter suffix, focus the search field, and scan an asset tag to open a PC. JSON backup is export-only; there is no restore screen yet.

Do not commit inventory exports or personal/company records to this public source repository.
