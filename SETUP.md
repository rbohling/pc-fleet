# PC Fleet setup

PC inventory for a single manager: asset tags, models, serials, locations, assigned users, check-in/out history, printable Code 39 labels, CSV import/export, and JSON backup download.

## Run locally

Install Node.js 24 and pnpm 11.25.0, then run:

```sh
pnpm install --frozen-lockfile
pnpm start
```

Open http://127.0.0.1:3000. Local mode has no login and binds to loopback only. Data is stored in data/fleet.sqlite. Run `node --test` for the API integration test.

## Azure deployment

1. Create an Azure SQL database. Execute azure/schema.sql once against an empty database to initialize the inventory table.
2. Build the Dockerfile and publish its image to your Azure Container Registry. Create a Linux Azure App Service using that image, with container target port 8080 (WEBSITES_PORT=8080 for classic container configuration).
3. Enable App Service Authentication with Microsoft Entra ID for your tenant. Require authentication for all requests. Restrict allowed identities to your user's Entra object ID. Enable HTTPS Only. The application trusts the identity headers injected by App Service; do not expose the container directly outside that authentication boundary.
4. Set App Service environment variables: NODE_ENV=production, PORT=8080, ADMIN_OBJECT_ID=your Entra user object ID, and SQL_CONNECTION_STRING=your encrypted SQL Server connection string. WEBSITE_SITE_NAME is supplied by App Service. The app refuses production startup without these settings. Store the SQL credential in Azure settings or Key Vault, never in GitHub.
5. Use a dedicated SQL application identity with SELECT and UPDATE permission on dbo.FleetState. Use an administrative connection only for initial schema setup. Configure SQL network access for your App Service's outbound addresses or private networking.
6. Restart the app. Confirm anonymous visitors are redirected to sign-in, your account can access inventory, and another account is denied. Add a test PC, check it out/in, restart App Service, and confirm records remain. Review Azure SQL backup retention and test recovery before entering real inventory.

Azure deployment, SQL connectivity, browser layout, and physical barcode scanning still require validation in the target environment. No Azure resources are deployed by this repository.

## Using it

Start from import-template.csv. Required headers: tag,model. Optional: serial,location,notes. Imported PCs start Available; check out each PC to assign a user. Imports reject duplicate tags/serials atomically. To print, select PCs with the row checkboxes and choose Print labels. Labels are 80 x 38 mm with margins; test your printer at 100% scale. Configure a USB scanner for Code 39 and an Enter suffix. Focus the search field and scan to open a PC.

JSON backup is an export only; there is no restore screen yet. History is application history, not a tamper-proof audit log. The database stores inventory in a versioned JSON document, appropriate for the initial small single-manager fleet; consider normalized tables before expanding to many users or large history volumes. Do not commit inventory exports or personal/company records to this public source repository.
