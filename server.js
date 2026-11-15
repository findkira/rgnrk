
const express = require("express");
const { spawn } = require("child_process");

const app = express();
const PORT = process.env.PORT || 10000;

let bot;

app.get("/", (req, res) => {
    res.status(200).send("RAGANORK-MD BOT IS RUNNING");
});

app.get("/health", (req, res) => {
    res.status(200).json({
        status: "online",
        bot: "Raganork-MD"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`HTTP Server running on port ${PORT}`);

    bot = spawn("node", ["index.js"], {
        cwd: "/app",
        stdio: "inherit",
        env: process.env
    });

    bot.on("exit", (code) => {
        console.log(`Bot exited with code: ${code}`);

        if (code !== 0) {
            process.exitCode = code || 1;
        }
    });
});

process.on("SIGTERM", () => {
    if (bot) bot.kill("SIGTERM");
    process.exit(0);
});
