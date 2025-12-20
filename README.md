# scaleway-dns-check

> A small utility that checks the health of a list of IPs and updates Scaleway DNS records to point to the healthy IP.

## Features
- Periodically checks HTTP health endpoints on candidate IPs
- Updates Scaleway DNS zone records to point to the healthy IP
- Configurable via environment variables and usable in Docker

## Prerequisites
- Node.js (>= 18 recommended)
- npm
- A Scaleway account and API credentials with DNS permissions

## Environment variables
The app reads configuration from environment variables (or an `.env` file for Docker/compose).

- `IPS` — JSON array of IP addresses to check (e.g. `"10.0.0.1,10.0.0.2"`).
- `RECORDS` — JSON array of DNS record IDs to update (Scaleway record IDs).
- `DNS_ZONE` — DNS zone ID (Scaleway DNS zone identifier).
- `ACCESS_KEY` — Scaleway access key.
- `SECRET_KEY` — Scaleway secret key.
- `PROJECT_ID` — Scaleway project ID (optional; used if needed by SDK).
- `REGION` — Default region for the SDK (optional).
- `ZONE` — Default zone for the SDK (optional).
- `HEALTH_CHECK_PORT` — Port used when checking HTTP health (default `80`).
- `LOG_LEVEL` — `debug|info|warn|error` (default `info`).

## Install

Install dependencies:

```bash
npm install
```

## Development

Run in watch/dev mode (requires `tsx`):

```bash
npm run dev
```

## Build & Run

Build the TypeScript output to `dist`:

```bash
npm run build
```

Start the built app:

```bash
npm start
```

There is also a production bundle build via webpack:

```bash
npm run build:production
```

## Docker

The repository contains a `Dockerfile` and a minimal `docker-compose.yml`.
With an `.env` file present you can run:

```bash
docker-compose up --build
```

Or build and run the image manually:

```bash
docker build -t scaleway-dns-check .
docker run --env-file .env scaleway-dns-check
```

## How it works

1. The app loads `IPS` and `RECORDS` from environment variables.
2. It checks each IP's HTTP health endpoint (port configurable) and picks the first healthy IP.
3. For each record ID in `RECORDS`, it calls the Scaleway DNS API and updates the record data to the healthy IP if needed.

## Troubleshooting
- Ensure `IPS` and `RECORDS` are valid JSON arrays in your environment.
- Confirm your Scaleway credentials and that the API keys have DNS write permissions.
- Increase `LOG_LEVEL=debug` for more verbose logs.

## Contributing
PRs welcome — please open issues for bugs or feature requests.

## License
MIT
