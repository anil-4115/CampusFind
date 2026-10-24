"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs/promises");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "reports.json");

// GitHub Contents API configuration. Keep GITHUB_TOKEN only in server-side
// environment variables (Render/Vercel), never in public JavaScript.
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER;
const GITHUB_REPO = process.env.GITHUB_REPO;
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_FILE_PATH = process.env.GITHUB_FILE_PATH || "data/reports.json";
const USE_GITHUB_STORAGE = Boolean(GITHUB_TOKEN && GITHUB_OWNER && GITHUB_REPO);

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

const allowedTypes = ["lost", "found"];
const allowedCategories = [
    "Electronics", "ID Card", "Books & Notes", "Bags", "Clothing", "Keys", "Other"
];

// Local .env support without an extra dependency. A hosting provider's
// configured environment variables take precedence over values in .env.
async function loadLocalEnv() {
    try {
        const content = await fs.readFile(path.join(__dirname, ".env"), "utf8");
        for (const line of content.split(/\r?\n/)) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
            if (!match || match[1] in process.env) continue;
            process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
        }
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
    }
}

function githubConfig() {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    if (!token || !owner || !repo) return null;
    return {
        token,
        owner,
        repo,
        branch: process.env.GITHUB_BRANCH || "main",
        filePath: process.env.GITHUB_FILE_PATH || "data/reports.json"
    };
}

async function readLocalReports() {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    try {
        const raw = await fs.readFile(DATA_FILE, "utf8");
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("data/reports.json must contain a JSON array.");
        return parsed;
    } catch (error) {
        if (error.code !== "ENOENT") throw error;
        await fs.writeFile(DATA_FILE, "[]\n", "utf8");
        return [];
    }
}

async function writeLocalReports(reports) {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    await fs.writeFile(DATA_FILE, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
}

async function githubRequest(config, method, url, body) {
    const response = await fetch(url, {
        method,
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${config.token}`,
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "CampusFind-App",
            ...(body ? { "Content-Type": "application/json" } : {})
        },
        ...(body ? { body: JSON.stringify(body) } : {})
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const error = new Error(data.message || `GitHub API request failed (${response.status}).`);
        error.status = response.status;
        throw error;
    }
    return data;
}

async function readGithubReports(config) {
    const encodedPath = config.filePath.split("/").map(encodeURIComponent).join("/");
    const url = `https://api.github.com/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/contents/${encodedPath}?ref=${encodeURIComponent(config.branch)}`;
    try {
        const file = await githubRequest(config, "GET", url);
        if (!file.content) throw new Error("GitHub JSON file has no content.");
        const content = Buffer.from(file.content.replace(/\n/g, ""), "base64").toString("utf8");
        const reports = JSON.parse(content);
        if (!Array.isArray(reports)) throw new Error("The GitHub reports JSON must contain an array.");
        return { reports, sha: file.sha, url };
    } catch (error) {
        // If the file does not exist yet, create it with an empty array.
        if (error.status !== 404) throw error;
        const createBody = {
            message: "Initialize CampusFind reports data",
            content: Buffer.from("[]\n", "utf8").toString("base64"),
            branch: config.branch
        };
        const created = await githubRequest(config, "PUT", url, createBody);
        return { reports: [], sha: created.content?.sha, url };
    }
}

async function writeGithubReports(config, reports, existingSha, fileUrl) {
    const body = {
        message: `CampusFind: update reports (${new Date().toISOString()})`,
        content: Buffer.from(`${JSON.stringify(reports, null, 2)}\n`, "utf8").toString("base64"),
        branch: config.branch
    };
    if (existingSha) body.sha = existingSha;
    await githubRequest(config, "PUT", fileUrl, body);
}

async function getReports() {
    const config = githubConfig();
    if (!config) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("GitHub storage is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.");
        }
        return { reports: await readLocalReports(), storage: "local" };
    }
    const result = await readGithubReports(config);
    return { ...result, storage: "github", config };
}

// Save with optimistic concurrency: re-read latest file and retry a few times
// if another request commits between our read and write.
async function saveReports(mutator) {
    const config = githubConfig();
    if (!config) {
        if (process.env.NODE_ENV === "production") {
            throw new Error("GitHub storage is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO.");
        }
        const reports = await readLocalReports();
        const result = mutator(reports);
        if (result?.error) return result;
        await writeLocalReports(reports);
        return result;
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
        const current = await readGithubReports(config);
        const working = current.reports.map(report => ({ ...report }));
        const result = mutator(working);
        if (result?.error) return result;
        try {
            await writeGithubReports(config, working, current.sha, current.url);
            return result;
        } catch (error) {
            if (error.status !== 409 && error.status !== 422) throw error;
            if (attempt === 3) {
                throw new Error("Reports changed during another update. Please try again.");
            }
        }
    }
    throw new Error("Unable to save reports. Please try again.");
}

function validateReport(body = {}) {
    const { type, itemName, category, location, date, contact, description } = body;
    if (!type || !itemName || !category || !location || !date || !contact) {
        return "Please fill in all required fields.";
    }
    if (!allowedTypes.includes(type)) return "Report type must be Lost or Found.";
    if (typeof itemName !== "string" || itemName.trim().length < 2 || itemName.trim().length > 80) {
        return "Item name must contain 2 to 80 characters.";
    }
    if (!allowedCategories.includes(category)) return "Please select a valid item category.";
    if (typeof location !== "string" || location.trim().length < 2 || location.trim().length > 100) {
        return "Location must contain 2 to 100 characters.";
    }
    if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Please provide a valid date.";
    const parsedDate = new Date(`${date}T00:00:00Z`);
    const today = new Date().toISOString().slice(0, 10);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || date > today) {
        return "Date must be valid and cannot be in the future.";
    }
    if (typeof contact !== "string" || contact.trim().length < 5 || contact.trim().length > 100 || /[\r\n]/.test(contact)) {
        return "Please enter valid contact details.";
    }
    if (description !== undefined && (typeof description !== "string" || description.trim().length > 500)) {
        return "Description cannot exceed 500 characters.";
    }
    return null;
}

function normalizeReport(body) {
    return {
        type: body.type,
        itemName: body.itemName.trim(),
        category: body.category,
        location: body.location.trim(),
        date: body.date,
        contact: body.contact.trim(),
        description: (body.description || "").trim()
    };
}

function sendStorageError(res, error, action) {
    console.error(`CampusFind ${action} error:`, error);
    const status = error.status === 401 || error.status === 403 ? 502 : 500;
    res.status(status).json({
        success: false,
        message: status === 502
            ? "GitHub storage access failed. Check the token permissions and repository settings."
            : (error.message || `Unable to ${action} reports right now.`)
    });
}

app.get("/api/health", (req, res) => {
    res.json({ success: true, message: "CampusFind server is running.", storage: githubConfig() ? "github-json" : "local-json" });
});

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.get("/api/reports", async (req, res) => {
    try {
        const { reports } = await getReports();
        const { type, category, search } = req.query;
        let filtered = [...reports];
        if (type && allowedTypes.includes(type)) filtered = filtered.filter(r => r.type === type);
        if (category && allowedCategories.includes(category)) filtered = filtered.filter(r => r.category === category);
        if (search) {
            const term = String(search).trim().toLowerCase();
            filtered = filtered.filter(r =>
                String(r.itemName || "").toLowerCase().includes(term) ||
                String(r.location || "").toLowerCase().includes(term) ||
                String(r.description || "").toLowerCase().includes(term)
            );
        }
        res.json({ success: true, count: filtered.length, reports: filtered });
    } catch (error) { sendStorageError(res, error, "load"); }
});

app.get("/api/stats", async (req, res) => {
    try {
        const { reports } = await getReports();
        res.json({
            success: true,
            totalReports: reports.length,
            lostItems: reports.filter(r => r.type === "lost").length,
            foundItems: reports.filter(r => r.type === "found").length
        });
    } catch (error) { sendStorageError(res, error, "load"); }
});

app.post("/api/reports", async (req, res) => {
    const errorMessage = validateReport(req.body);
    if (errorMessage) return res.status(400).json({ success: false, message: errorMessage });
    try {
        const newReportData = normalizeReport(req.body);
        const result = await saveReports(reports => {
            const maxId = reports.reduce((max, report) => Math.max(max, Number(report.id) || 0), 0);
            const newReport = { id: maxId + 1, ...newReportData, createdAt: new Date().toISOString() };
            reports.unshift(newReport);
            return { report: newReport };
        });
        res.status(201).json({ success: true, message: "Your report has been submitted successfully!", report: result.report });
    } catch (error) { sendStorageError(res, error, "save"); }
});

app.put("/api/reports/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid report ID." });
    const errorMessage = validateReport(req.body);
    if (errorMessage) return res.status(400).json({ success: false, message: errorMessage });
    try {
        const result = await saveReports(reports => {
            const index = reports.findIndex(report => Number(report.id) === id);
            if (index === -1) return { error: true, status: 404, message: "Report not found." };
            const updated = { ...reports[index], ...normalizeReport(req.body), updatedAt: new Date().toISOString() };
            reports[index] = updated;
            return { report: updated };
        });
        if (result.error) return res.status(result.status).json({ success: false, message: result.message });
        res.json({ success: true, message: "Report updated successfully.", report: result.report });
    } catch (error) { sendStorageError(res, error, "update"); }
});

app.delete("/api/reports/:id", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ success: false, message: "Invalid report ID." });
    try {
        const result = await saveReports(reports => {
            const index = reports.findIndex(report => Number(report.id) === id);
            if (index === -1) return { error: true, status: 404, message: "Report not found." };
            return { report: reports.splice(index, 1)[0] };
        });
        if (result.error) return res.status(result.status).json({ success: false, message: result.message });
        res.json({ success: true, message: "Report deleted successfully.", report: result.report });
    } catch (error) { sendStorageError(res, error, "delete"); }
});

app.use("/api", (req, res) => res.status(404).json({ success: false, message: "API route not found." }));
app.use((req, res) => res.status(404).send("404 - Page Not Found"));

loadLocalEnv().then(() => {
    app.listen(PORT, () => {
        console.log(`CampusFind running at http://localhost:${PORT}`);
        console.log(`Storage mode: ${githubConfig() ? "GitHub JSON API" : "local data/reports.json (development only)"}`);
        if (process.env.NODE_ENV === "production" && !githubConfig()) {
            console.error("WARNING: GitHub storage is not configured. API requests will fail in production.");
        }
    });
}).catch(error => {
    console.error("Unable to load local environment configuration:", error);
    process.exit(1);
});
