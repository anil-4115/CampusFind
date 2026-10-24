
# CampusFind — Campus Lost & Found Portal

CampusFind is a web-based Lost & Found Portal designed to help students and staff report lost belongings, publish found-item information, and browse reports through a centralized dashboard.

**Live Website:** https://campusfind-efm3gdy6v-anil-add5.vercel.app

**GitHub Repository:** https://github.com/anil-4115/CampusFind

---

## 1. Problem Statement

Students and staff frequently lose personal belongings such as identity cards, keys, books, wallets, chargers, and other items around campus. Information about lost and found items is often scattered across messaging groups and notice boards.

CampusFind provides a centralized platform where users can report lost or found items and browse existing reports, making it easier to locate and recover belongings.

## 2. Objectives

- Develop a centralized campus lost-and-found platform.
- Allow users to submit reports about lost and found items.
- Display reports through a simple dashboard.
- Provide report statistics and organized information.
- Validate user input and display appropriate feedback.
- Provide backend API endpoints for report operations.
- Support persistent storage for submitted reports.

## 3. Features

### Dashboard
- Displays an overview of lost-and-found reports.
- Shows report statistics and recent reports where available.
- Provides navigation to the main sections.

### Report an Item
- Allows users to submit information about lost or found belongings.
- Validates required information before submission.
- Displays success or error feedback.

### Browse Reports
- Displays available lost-and-found reports.
- Helps users review reported item information.

### Backend API
- Processes report-related requests.
- Provides endpoints for retrieving reports and statistics where implemented.
- Supports data operations through the configured storage mechanism.

## 4. Technology Stack

| Technology | Purpose |
|---|---|
| HTML | Webpage structure |
| CSS | Styling and responsive layout |
| JavaScript | Frontend interactions |
| Node.js | Backend JavaScript runtime |
| Express.js | Backend server and REST API |
| JSON | Structured report data |
| Git and GitHub | Version control and source code hosting |
| Vercel | Application deployment |
| GitHub Contents API | JSON persistence, when configured in the backend |

## 5. System Architecture

The application follows a client-server architecture.

1. The user opens the CampusFind website.
2. The frontend displays the dashboard and report forms.
3. The user submits or views a report.
4. The frontend sends a request to the backend API.
5. The backend validates and processes the request.
6. The backend reads or updates the configured data store.
7. The frontend displays the latest report information.

### Data Storage

CampusFind can use a JSON file stored in a GitHub repository for persistent storage through the GitHub Contents API.

When this integration is configured, the backend reads and updates the JSON file using a server-side GitHub token. The token must remain private and must never be included in frontend JavaScript.

**Note:** Writing to a local JSON file on Vercel does not guarantee persistent storage. GitHub-backed storage works only when the backend has been implemented to use the GitHub API.

## 6. Project Structure

The following is an example structure. Update it to match the actual files in the repository.

```text
CampusFind/
├── public/
│   ├── index.html
│   ├── css/
│   ├── js/
│   └── assets/
├── routes/
├── data/
│   └── reports.json
├── server.js
├── package.json
├── .gitignore
└── README.md
```

## 7. Installation and Setup

### Prerequisites

- Node.js
- npm
- Git
- Visual Studio Code or another code editor

### Step 1: Clone the Repository

```bash
git clone https://github.com/anil-4115/CampusFind.git
cd CampusFind
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Configure Environment Variables

If the backend uses GitHub-backed JSON storage, configure the required environment variables.

```env
GITHUB_TOKEN=your_github_token
GITHUB_OWNER=anil-4115
GITHUB_REPO=CampusFind
GITHUB_BRANCH=main
GITHUB_FILE_PATH=data/reports.json
NODE_ENV=production
```

Replace `your_github_token` with your actual token. Never commit the token or the `.env` file to GitHub.

Only use variables that are supported by your backend implementation.

### Step 4: Start the Application

```bash
npm start
```

If a development script is configured in `package.json`, you can use:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## 8. API Endpoints

The following endpoints should be verified against the actual backend implementation.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check API health |
| GET | `/api/reports` | Retrieve reports |
| GET | `/api/stats` | Retrieve dashboard statistics, if implemented |
| POST | Report creation route | Create a report |
| PUT/PATCH | Report update route | Update a report, if implemented |
| DELETE | Report deletion route | Delete a report, if implemented |

The exact HTTP methods and routes for creating, updating, and deleting reports depend on the implemented backend.

## 9. Deployment

CampusFind is deployed through Vercel.

### Deployment Steps

1. Push the source code to GitHub.
2. Import the repository into Vercel.
3. Configure the correct root directory and application settings.
4. Add the required environment variables if the backend uses them.
5. Deploy the application.
6. Inspect build and runtime logs for errors.
7. Test report submission and retrieval.
8. Verify that saved reports persist after refreshing the website.

If the backend is hosted separately, configure the environment variables on the backend host and connect the frontend to its deployed API URL.

## 10. Testing

The following checks should be performed before submission:

- [ ] Dashboard loads successfully.
- [ ] Report forms accept valid input.
- [ ] Required fields are validated.
- [ ] Invalid input displays an appropriate message.
- [ ] Submitted reports appear in the dashboard or report list.
- [ ] Existing reports can be retrieved.
- [ ] Update and delete operations work if implemented.
- [ ] API health endpoint responds correctly.
- [ ] Saved reports remain available after refreshing the website.
- [ ] GitHub JSON storage is updated if that integration is enabled.
- [ ] No secret token is exposed in frontend code or the public repository.

## 11. Security Considerations

- Store access tokens in server-side environment variables.
- Never commit API tokens or passwords.
- Restrict the GitHub token to the required repository.
- Validate input on the backend.
- Handle API errors appropriately.
- Avoid exposing unnecessary personal information.
- Revoke and replace any token that is accidentally exposed.

## 12. Limitations

- Data persistence depends on the configured storage implementation.
- A local JSON file on a serverless platform is not reliable permanent storage.
- Concurrent updates to a GitHub-hosted JSON file must be handled carefully.
- Features such as authentication, image uploads, automated matching, and notifications require separate implementation if they are not already present.

## 13. Future Enhancements

- User authentication and role-based access.
- Item image uploads.
- Search and filtering by category, date, and location.
- Automated matching of lost and found reports.
- Claim verification and handover tracking.
- Notifications when a matching item is reported.
- Administrative moderation.
- Automated API testing.
- Database integration for larger-scale use.

## 14. Author

**Anil Verma**

GitHub: https://github.com/anil-4115

---

CampusFind — Helping campus communities report, find, and recover lost belongings.
