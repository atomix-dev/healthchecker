# Express Health Checker API

A simple, containerized REST API built with Node.js and Express that periodically performs health checks on a configurable list of external services. It is designed to be proactive, sending email notifications when a service goes down and logging all status changes for historical analysis.

## Features

- **Configurable Endpoints**: Easily monitor multiple service URLs by adding them to the `.env` file.
- **Flexible Health Checks**: A service is considered "ok" as long as it doesn't return a server error (5xx status code). This handles cases where a protected resource correctly returns a 403 Forbidden status.
- **Timeout Handling**: Explicitly handles and reports request timeouts.
- **Email Notifications**: Uses `Nodemailer` to send an email alert the first time a service is detected as "down", preventing repeated notifications for an ongoing outage.
- **Configurable Schedule**: The check interval is configurable via environment variables. It defaults to every hour in production and every 5 seconds in development for easy testing.
- **Persistent Logging**:
    - `health-status.json`: Persists the last known status of all services, so the state is maintained across application restarts.
    - `health-events.log`: Creates a historical log of all status changes (e.g., UP -> DOWN) for auditing purposes.
- **Containerized**: Includes a multi-stage `Dockerfile` and `docker-compose.yml` for a small, efficient, and easy-to-deploy production image.

---

## Project Structure

```
.
├── .dockerignore      # Specifies files to ignore in the Docker build
├── .env               # Environment variable configurations (you must create this)
├── docker-compose.yml # Defines the Docker services
├── Dockerfile         # Instructions to build the Docker image
├── index.js           # Main application logic
├── package.json       # Project dependencies and scripts
└── README.md          # This file
```

---

## Setup and Usage

You can run this application either locally with Node.js or within a Docker container.

### Prerequisites

* **For Local Development**: [Node.js](https://nodejs.org/) (v18 or later) and npm.
* **For Docker Deployment**: [Docker](https://www.docker.com/products/docker-desktop) and [Docker Compose](https://docs.docker.com/compose/install/).

### 1. Configuration

Before running the application, you need to set up your environment variables.

1.  Create a file named `.env` in the root of the project directory.
2.  Copy the contents from the example below into your `.env` file and modify the values with your own settings.

```dotenv
# .env file

# Comma-separated list of URLs to check
TARGET_URLS=[https://google.com/404,https://api.github.com/](https://google.com/404,https://api.github.com/)

# --- Cron & Environment Configuration ---
# Set to 'development' for 5-second checks, or 'production' for hourly checks.
NODE_ENV=development

# Optional: Uncomment to manually set a specific cron schedule.
# This will override the default based on NODE_ENV.
# CRON_SCHEDULE=*/10 * * * * *

# --- Email Configuration for Nodemailer ---
# For Gmail, you may need to generate an "App Password".
# See: [https://support.google.com/accounts/answer/185833](https://support.google.com/accounts/answer/185833)
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
EMAIL_RECIPIENT=recipient-email@example.com
```

2. Running the Application
Option A: Running Locally with Node.js
Install Dependencies:

`npm install`

Start the Server:

`npm start`

The application will be running at http://localhost:3000.

Option B: Running with Docker Compose
This is the recommended method for production and isolated development.

Build and Run the Container:

`docker-compose up --build -d`

The -d flag runs the container in detached mode.

Check the Logs:

`docker-compose logs -f`

The application will be running and accessible at http://localhost:3000. The health-status.json and health-events.log files will be created in your project directory on the host machine.

3. Accessing the API Endpoints
Once the application is running, you can use the following endpoints:

Get Current Status: Returns a JSON object with the latest status of all monitored services.

`http://localhost:3000/health`

Get Historical Log: Returns the plain text log of all status change events.

`http://localhost:3000/health/history`

Stopping the Application
Local: Press Ctrl + C in the terminal.

Docker Compose:

`docker-compose down`
