
"use strict";

// ========================================
// CampusFind - Frontend JavaScript
// ========================================

// ---------- DOM elements ----------

const reportForm = document.getElementById("report-form-element");
const reportsContainer = document.getElementById("reports-container");
const reportsMessage = document.getElementById("reports-message");
const formMessage = document.getElementById("form-message");

const searchInput = document.getElementById("search-input");
const categoryFilter = document.getElementById("category-filter");

const totalReportsElement = document.getElementById("total-reports");
const lostCountElement = document.getElementById("lost-count");
const foundCountElement = document.getElementById("found-count");

const submitButton = document.getElementById("submit-report-btn");
const openReportButton = document.getElementById("open-report-btn");
const dateInput = document.getElementById("date");

let activeType = "all";
let allReports = [];
let editingReportId = null;
let searchTimeout = null;

// ---------- Category icons ----------

const categoryIcons = {
    "Electronics": "⌁",
    "ID Card": "▣",
    "Books & Notes": "▤",
    "Bags": "▱",
    "Clothing": "◇",
    "Keys": "⚿",
    "Other": "◈"
};

// ========================================
// Utility functions
// ========================================

function getLocalDate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}

if (dateInput) {
    dateInput.max = getLocalDate();
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[character]);
}

async function readResponse(response) {
    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        throw new Error(
            data.message || `Request failed (${response.status}).`
        );
    }

    return data;
}

function getFieldLabel(field) {
    const label = reportForm.querySelector(
        `label[for="${field.id}"]`
    );

    if (label) {
        return label.textContent
            .replace(/\*/g, "")
            .trim();
    }

    return field.name || field.id || "Field";
}

// ========================================
// Form messages
// ========================================

function showFormMessage(message, type = "error") {
    if (!formMessage) return;

    formMessage.replaceChildren();

    // Only allow success or error classes.
    const messageType = type === "success" ? "success" : "error";

    formMessage.className = `form-message ${messageType}`;
    formMessage.textContent = message;
    formMessage.hidden = false;

    formMessage.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function showValidationErrors(errors) {
    if (!formMessage) return;

    formMessage.replaceChildren();
    formMessage.className = "form-message error";
    formMessage.hidden = false;

    const heading = document.createElement("strong");

    heading.textContent =
        `Please correct the following ${errors.length} error(s):`;

    const list = document.createElement("ul");

    errors.forEach(error => {
        const item = document.createElement("li");
        item.textContent = error.message;
        list.appendChild(item);
    });

    formMessage.append(heading, list);

    formMessage.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });

    if (errors[0]) {
        errors[0].field.focus({ preventScroll: true });
    }
}

function clearFormMessage() {
    if (!formMessage) return;

    formMessage.hidden = true;
    formMessage.replaceChildren();
    formMessage.className = "form-message";

    if (reportForm) {
        reportForm.querySelectorAll("[aria-invalid='true']")
            .forEach(field => {
                field.removeAttribute("aria-invalid");
            });
    }
}

function showEmptyState(title, message) {
    reportsContainer.innerHTML = `
        <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">⌕</div>
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}

// ========================================
// Form validation
// ========================================

function validateReportForm() {
    const errors = [];

    const controls = reportForm.querySelectorAll(
        "input, select, textarea"
    );

    controls.forEach(field => {
        if (field.disabled) return;

        field.removeAttribute("aria-invalid");

        const value = field.value.trim();
        let message = "";

        if (field.required && !value) {
            message = "This field is required.";
        } else if (!field.validity.valid) {
            message = field.validationMessage;
        }

        if (message) {
            field.setAttribute("aria-invalid", "true");

            errors.push({
                field,
                message: `${getFieldLabel(field)}: ${message}`
            });
        }
    });

    if (errors.length > 0) {
        showValidationErrors(errors);
        return false;
    }

    return true;
}

// Clear an individual field's invalid marker when corrected.
reportForm.querySelectorAll("input, select, textarea")
    .forEach(field => {
        field.addEventListener("input", () => {
            field.removeAttribute("aria-invalid");
        });

        field.addEventListener("change", () => {
            field.removeAttribute("aria-invalid");
        });
    });

// ========================================
// Dashboard statistics
// ========================================

async function loadStatistics() {
    try {
        const response = await fetch("/api/stats");
        const data = await readResponse(response);

        totalReportsElement.textContent = data.totalReports ?? 0;
        lostCountElement.textContent = data.lostItems ?? 0;
        foundCountElement.textContent = data.foundItems ?? 0;
    } catch (error) {
        console.error("Statistics error:", error);
    }
}

// ========================================
// Fetch reports from Express
// ========================================

async function loadReports() {
    reportsContainer.setAttribute("aria-busy", "true");

    reportsContainer.innerHTML = `
        <div class="loading-state">
            <span class="loading-spinner"></span>
            <p>Loading campus reports...</p>
        </div>
    `;

    reportsMessage.textContent = "";

    const params = new URLSearchParams();
    const search = searchInput.value.trim();
    const category = categoryFilter.value;

    if (search) {
        params.set("search", search);
    }

    if (category) {
        params.set("category", category);
    }

    if (activeType !== "all") {
        params.set("type", activeType);
    }

    try {
        const response = await fetch(
            `/api/reports?${params.toString()}`
        );

        const data = await readResponse(response);

        allReports = Array.isArray(data.reports)
            ? data.reports
            : [];

        renderReports(allReports);

        const count = data.count ?? allReports.length;

        reportsMessage.textContent =
            `${count} report${count === 1 ? "" : "s"} displayed`;
    } catch (error) {
        console.error("Reports error:", error);

        reportsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon" aria-hidden="true">!</div>
                <h3>Unable to load reports</h3>
                <p>${escapeHTML(error.message)}</p>
                <button type="button"
                        class="primary-button"
                        id="retry-reports-btn">
                    Try Again
                </button>
            </div>
        `;

        document.getElementById("retry-reports-btn")
            .addEventListener("click", loadReports);
    } finally {
        reportsContainer.setAttribute("aria-busy", "false");
    }
}

// ========================================
// Render report cards
// ========================================

function renderReports(reports) {
    if (!reports.length) {
        showEmptyState(
            "No reports found",
            "Try another search or be the first to report an item."
        );
        return;
    }

    reportsContainer.innerHTML = reports.map(report => {
        const badgeClass = report.type === "lost" ? "lost" : "found";

        const badgeText = report.type === "lost"
            ? "Lost Item"
            : "Found Item";

        const icon = categoryIcons[report.category] || "◈";

        return `
            <article class="report-card"
                     data-report-id="${escapeHTML(report.id)}">

                <div class="report-card-top">
                    <div class="report-card-icon" aria-hidden="true">
                        ${icon}
                    </div>

                    <span class="report-type-badge ${badgeClass}">
                        ${badgeText}
                    </span>
                </div>

                <h3>${escapeHTML(report.itemName)}</h3>

                <p class="report-description">
                    ${escapeHTML(
                        report.description ||
                        "No additional description provided."
                    )}
                </p>

                <div class="report-meta">
                    <p>
                        <span aria-hidden="true">▦</span>
                        <span>
                            <strong>Category:</strong>
                            ${escapeHTML(report.category)}
                        </span>
                    </p>

                    <p>
                        <span aria-hidden="true">⌖</span>
                        <span>
                            <strong>Location:</strong>
                            ${escapeHTML(report.location)}
                        </span>
                    </p>

                    <p>
                        <span aria-hidden="true">◷</span>
                        <span>
                            <strong>Date:</strong>
                            ${escapeHTML(report.date)}
                        </span>
                    </p>

                    <p>
                        <span aria-hidden="true">✉</span>
                        <span>
                            <strong>Contact:</strong>
                            ${escapeHTML(report.contact)}
                        </span>
                    </p>

                    <p class="report-card-date">
                        Report #${escapeHTML(report.id)}
                    </p>
                </div>

                <div class="report-actions" aria-label="Report actions">
                    <button type="button"
                            class="report-action-button edit-report-btn"
                            data-action="edit"
                            data-id="${escapeHTML(report.id)}"
                            aria-label="Edit ${escapeHTML(report.itemName)}">
                        <span aria-hidden="true">✎</span>
                        Edit
                    </button>

                    <button type="button"
                            class="report-action-button delete-report-btn"
                            data-action="delete"
                            data-id="${escapeHTML(report.id)}"
                            aria-label="Delete ${escapeHTML(report.itemName)}">
                        <span aria-hidden="true">🗑</span>
                        Delete
                    </button>
                </div>
            </article>
        `;
    }).join("");
}

// ========================================
// Reset form and edit mode
// ========================================

function resetEditMode() {
    editingReportId = null;

    submitButton.disabled = false;
    submitButton.innerHTML = 'Submit Report <span>→</span>';

    const heading = document.getElementById("report-form-heading");

    if (heading) {
        heading.textContent = "Report an Item";
    }

    const cancelButton = document.getElementById("cancel-edit-btn");

    if (cancelButton) {
        cancelButton.remove();
    }
}

function resetReportForm() {
    reportForm.reset();
    clearFormMessage();
    resetEditMode();

    if (dateInput) {
        dateInput.max = getLocalDate();
    }
}

// ========================================
// Edit a report
// ========================================

function startEditingReport(reportId) {
    const report = allReports.find(
        item => String(item.id) === String(reportId)
    );

    if (!report) {
        showFormMessage(
            "This report could not be found. Refresh the report list and try again.",
            "error"
        );
        return;
    }

    editingReportId = report.id;
    clearFormMessage();

    const fields = [
        "type",
        "itemName",
        "category",
        "location",
        "date",
        "contact",
        "description"
    ];

    fields.forEach(name => {
        const field = reportForm.elements.namedItem(name);

        if (field) {
            field.value = report[name] ?? "";
        }
    });

    submitButton.innerHTML = 'Save Changes <span>✓</span>';

    const heading = document.getElementById("report-form-heading");

    if (heading) {
        heading.textContent = "Edit Report";
    }

    let cancelButton = document.getElementById("cancel-edit-btn");

    if (!cancelButton) {
        cancelButton = document.createElement("button");
        cancelButton.type = "button";
        cancelButton.id = "cancel-edit-btn";
        cancelButton.className = "report-action-button";
        cancelButton.textContent = "Cancel Edit";

        submitButton.insertAdjacentElement(
            "beforebegin",
            cancelButton
        );

        cancelButton.addEventListener("click", () => {
            resetReportForm();
        });
    }

    document.getElementById("report-form").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    document.getElementById("type").focus({
        preventScroll: true
    });

    showFormMessage(
        `Editing report #${report.id}. Update the details and click Save Changes.`,
        "success"
    );
}

// ========================================
// Delete a report
// ========================================

async function deleteReport(reportId) {
    const report = allReports.find(
        item => String(item.id) === String(reportId)
    );

    if (!report) {
        showFormMessage(
            "This report could not be found. Please refresh the list.",
            "error"
        );
        return;
    }

    const confirmed = window.confirm(
        `Are you sure you want to delete "${report.itemName}"?\n\n` +
        "This action cannot be undone."
    );

    if (!confirmed) {
        return;
    }

    const button = reportsContainer.querySelector(
        `.delete-report-btn[data-id="${CSS.escape(String(reportId))}"]`
    );

    if (button) {
        button.disabled = true;
        button.textContent = "Deleting...";
    }

    try {
        const response = await fetch(
            `/api/reports/${encodeURIComponent(reportId)}`,
            {
                method: "DELETE"
            }
        );

        const data = await readResponse(response);

        if (String(editingReportId) === String(reportId)) {
            resetReportForm();
        }

        await Promise.all([
            loadStatistics(),
            loadReports()
        ]);

        showFormMessage(
            data.message || "Report deleted successfully.",
            "success"
        );
    } catch (error) {
        console.error("Delete report error:", error);

        showFormMessage(
            `Unable to delete report. ${error.message}`,
            "error"
        );

        if (button) {
            button.disabled = false;
            button.innerHTML =
                '<span aria-hidden="true">🗑</span> Delete';
        }
    }
}

// Delegate Edit/Delete clicks from report cards.
reportsContainer.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");

    if (!button || !reportsContainer.contains(button)) {
        return;
    }

    const reportId = button.dataset.id;

    if (!reportId) {
        return;
    }

    if (button.dataset.action === "edit") {
        startEditingReport(reportId);
    } else if (button.dataset.action === "delete") {
        deleteReport(reportId);
    }
});

// ========================================
// Create or update a report
// ========================================

reportForm.addEventListener("submit", async event => {
    event.preventDefault();

    clearFormMessage();

    // Display all validation errors together.
    if (!validateReportForm()) {
        return;
    }

    const formData = new FormData(reportForm);
    const report = Object.fromEntries(formData.entries());

    const isEditing = editingReportId !== null;
    const currentEditingId = editingReportId;

    submitButton.disabled = true;
    submitButton.textContent = isEditing
        ? "Saving Changes..."
        : "Submitting...";

    try {
        const url = isEditing
            ? `/api/reports/${encodeURIComponent(currentEditingId)}`
            : "/api/reports";

        const response = await fetch(url, {
            method: isEditing ? "PUT" : "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(report)
        });

        const data = await readResponse(response);

        const successMessage = data.message || (
            isEditing
                ? "Report updated successfully."
                : "Report submitted successfully."
        );

        // Reset the form and edit mode first.
        resetReportForm();

        // Then display the green success message.
        showFormMessage(successMessage, "success");

        await Promise.all([
            loadStatistics(),
            loadReports()
        ]);

        document.getElementById("reports").scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error("Save report error:", error);

        showFormMessage(
            `${error.message} Please check that your Express server supports ` +
            `${isEditing ? "PUT" : "POST"} /api/reports` +
            (isEditing ? "/:id." : "."),
            "error"
        );
    } finally {
        submitButton.disabled = false;

        if (editingReportId !== null) {
            submitButton.innerHTML = 'Save Changes <span>✓</span>';
        } else {
            submitButton.innerHTML = 'Submit Report <span>→</span>';
        }
    }
});

// ========================================
// Search and category filters
// ========================================

searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);

    searchTimeout = setTimeout(() => {
        loadReports();
    }, 250);
});

categoryFilter.addEventListener("change", loadReports);

// ========================================
// Lost / Found filter buttons
// ========================================

document.querySelectorAll(".filter-tab").forEach(button => {
    button.addEventListener("click", () => {
        activeType = button.dataset.type;

        document.querySelectorAll(".filter-tab").forEach(tab => {
            const isActive = tab === button;

            tab.classList.toggle("active", isActive);
            tab.setAttribute("aria-pressed", String(isActive));
        });

        loadReports();
    });
});

// ========================================
// Navigation buttons
// ========================================

openReportButton.addEventListener("click", () => {
    document.getElementById("report-form").scrollIntoView({
        behavior: "smooth",
        block: "start"
    });

    document.getElementById("type").focus({
        preventScroll: true
    });
});

// ========================================
// Start the application
// ========================================

async function initializeApp() {
    await Promise.all([
        loadStatistics(),
        loadReports()
    ]);
}

initializeApp();
