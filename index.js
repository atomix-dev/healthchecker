const express = require("express");
const cron = require("node-cron");
const axios = require("axios");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

// --- Cron Job Configuration ---
// Default to 1 hour ('0 * * * *'). In 'development' mode, default to every 5 seconds ('*/5 * * * * *').
// The CRON_SCHEDULE variable in the .env file will override these defaults if provided.
const defaultCronSchedule =
  process.env.NODE_ENV === "development" ? "*/5 * * * * *" : "0 * * * *";
const cronSchedule = process.env.CRON_SCHEDULE || defaultCronSchedule;

console.log(
  `Application starting in '${process.env.NODE_ENV || "production"}' mode.`,
);
console.log(`Using cron schedule: ${cronSchedule}`);

const STATUS_FILE_PATH = path.join(__dirname, "health-status.json");
const LOG_FILE_PATH = path.join(__dirname, "health-events.log");

/**
 * This object abstracts the storage logic, making it swappable.
 * Currently, it uses the local filesystem (JSON file for state, log file for events).
 * It could be replaced with a different implementation (e.g., SQLite) in the future.
 */
const storage = {
  /**
   * Loads the initial state from health-status.json.
   * @returns {object} The last known health status object.
   */
  initialize: () => {
    try {
      if (fs.existsSync(STATUS_FILE_PATH)) {
        const data = fs.readFileSync(STATUS_FILE_PATH, "utf8");
        console.log("Successfully loaded previous health status from file.");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error(
        "Error reading status file, starting with a clean state:",
        error,
      );
    }
    return {}; // Return empty object if file doesn't exist or is corrupt
  },

  /**
   * Updates the status for a given URL and persists the change.
   * @param {string} url - The URL of the service being checked.
   * @param {object} newStatusDetails - The new status object {status, error, lastChecked}.
   */
  updateStatus: (url, newStatusDetails) => {
    const previousStatus = healthStatus[url]?.status;
    healthStatus[url] = newStatusDetails;

    // Persist the entire current state to the JSON file.
    try {
      fs.writeFileSync(
        STATUS_FILE_PATH,
        JSON.stringify(healthStatus, null, 2),
        "utf8",
      );
    } catch (error) {
      console.error("Failed to write status to file:", error);
    }

    // If the status changed, append an entry to the log file.
    if (newStatusDetails.status !== previousStatus) {
      const logEntry = `${new Date().toISOString()} | ${newStatusDetails.status.toUpperCase()} | ${url} | Reason: ${newStatusDetails.error || "OK"}\n`;
      try {
        fs.appendFileSync(LOG_FILE_PATH, logEntry, "utf8");
      } catch (error) {
        console.error("Failed to write to log file:", error);
      }
    }
  },
};

// Load initial health status from the storage system
let healthStatus = storage.initialize();

// --- Nodemailer Setup ---
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Sends an email notification when a service is down.
 * @param {string} url - The URL of the service that is down.
 * @param {string} error - The error message.
 */
const sendEmailNotification = (url, error) => {
  if (!process.env.EMAIL_RECIPIENT) {
    console.error(
      "Email recipient not configured. Skipping email notification.",
    );
    return;
  }

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: process.env.EMAIL_RECIPIENT,
    subject: `[Health Check Alert] Service Down: ${url}`,
    text: `The service at the following URL is down:\n\n${url}\n\nError: ${error}\nTime: ${new Date().toUTCString()}`,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("Error sending email notification:", err);
    } else {
      console.log("Email notification sent successfully:", info.response);
    }
  });
};

/**
 * Performs a health check on the configured URLs.
 */
const performHealthCheck = async () => {
  const urls = process.env.TARGET_URLS
    ? process.env.TARGET_URLS.split(",")
    : [];

  for (const url of urls) {
    const previousStatus = healthStatus[url]?.status;
    let newStatus, currentError;

    try {
      await axios.get(url, { timeout: 5000 });
      newStatus = "ok";
    } catch (error) {
      newStatus = "down";
      if (error.response) {
        currentError = `Server error with status: ${error.response.status}`;
        // If it's a client error (4xx), we can still consider the service 'ok'
        if (error.response.status < 500) {
          newStatus = "ok";
          currentError = `Responded with client error: ${error.response.status}`;
        }
      } else if (error.code === "ECONNABORTED") {
        currentError = "Request timed out";
      } else {
        currentError = error.message;
      }
    }

    // Update the status using our storage service
    const newStatusDetails = {
      status: newStatus,
      error: currentError,
      lastChecked: new Date(),
    };
    storage.updateStatus(url, newStatusDetails);

    // If the status has changed to 'down', send a notification.
    if (newStatus === "down" && previousStatus !== "down") {
      console.log(`Service at ${url} is down. Sending notification...`);
      sendEmailNotification(url, currentError);
    }
  }
  console.log("Health check completed.");
};

// Schedule the health check to run with the configured schedule
cron.schedule(cronSchedule, () => {
  console.log("Running scheduled health check...");
  performHealthCheck();
});

// Immediately run a health check on startup
console.log("Running initial health check on startup...");
performHealthCheck();

app.get("/health", (req, res) => {
  res.json(healthStatus);
});

// An endpoint to view the historical log file
app.get("/health/history", (req, res) => {
  try {
    if (fs.existsSync(LOG_FILE_PATH)) {
      const history = fs.readFileSync(LOG_FILE_PATH, "utf8");
      res.type("text/plain").send(history);
    } else {
      res.status(404).send("No history log found.");
    }
  } catch (error) {
    res.status(500).send("Error reading history log.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Health check API listening at http://localhost:${port}`);
});
