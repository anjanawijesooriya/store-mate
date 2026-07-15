/**
 * One-time script to get a Google OAuth2 refresh token for Drive backups.
 *
 * Run once from the project root:
 *   node scripts/get-drive-token.js
 *
 * Prerequisites:
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local
 *   - http://localhost:9999/callback must be added as an Authorized Redirect URI
 *     in your Google Cloud Console OAuth2 client settings
 */

const { google } = require("googleapis");
const http = require("http");
const url = require("url");
const path = require("path");
const fs = require("fs");

// Load .env.local
const envPath = path.join(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, "");
  }
}

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT = "http://localhost:9999/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("\n❌ GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env.local first.\n");
  process.exit(1);
}

const auth = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT);

const authUrl = auth.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/drive.file"],
  prompt: "consent",
});

console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("  eStoreMate — Google Drive Backup Token Setup");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("\n1. Open this URL in your browser:\n");
console.log("  " + authUrl);
console.log("\n2. Sign in with the Google account that owns your backup folder.");
console.log("3. Click Allow.\n");
console.log("Waiting for callback on http://localhost:9999 ...\n");

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const code = parsed.query.code;

  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter.");
    return;
  }

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end("<h2 style='font-family:sans-serif;color:#2DA86B'>✅ Success! You can close this tab and check your terminal.</h2>");
  server.close();

  try {
    const { tokens } = await auth.getToken(code);

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("  ✅ Add this to your .env.local:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    console.log("This token does not expire. Run this script again only if you revoke access.");
    console.log();
  } catch (err) {
    console.error("❌ Failed to exchange code for token:", err.message);
    process.exit(1);
  }
});

server.listen(9999, () => {});
server.on("error", (err) => {
  console.error("❌ Could not start local server on port 9999:", err.message);
  process.exit(1);
});
