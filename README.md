# Notion AI Activity Summarizer 

This project is a serverless function designed to automatically generate daily summaries of your activities logged in a Notion database. It uses the Gemini AI model to create concise, human-readable summaries and saves them to another Notion database, providing a powerful overview of your day.

## Features

- **Fetches Daily Logs**: Retrieves all entries for the current day (in Japan Standard Time) from a specified Notion database.
- **Intelligent Summarization**: Uses the **Gemini 1.5 Flash** model to generate summaries with controlled abstraction. Daily summaries are highly abstracted, while hourly summaries provide structured detail.
- **Context-Aware**: Retains important proper nouns (names, projects, etc.) in summaries to ensure clarity.
- **Resilient API Calls**: Includes retry logic with exponential backoff for calls to the Gemini API.
- **Native Notion Formatting**: Creates a new page in a summary database with clean, readable formatting using native Notion blocks (headings and paragraphs).
- **Idempotent & Robust**: Automatically finds and overwrites the summary page for the current day. It dynamically discovers the required property names (like "Title" or "Date") based on their *type*, so you can name them anything you like.
- **Serverless Architecture**: Built for easy deployment on **Google Cloud Functions**. While this project is tailored for Google Cloud, the core logic is platform-agnostic and can be adapted to other serverless environments.

## Setup

### 1. Prerequisites

- Node.js (v18 or later)
- A Google Cloud project with billing enabled
- `gcloud` CLI installed and authenticated

### 2. Notion Setup

1.  **Create an Integration**: Go to [Notion API integrations](https://www.notion.com/help/create-integrations-with-the-notion-api) and create a new integration. Note the "Internal Integration Token" – this is your `NOTION_API_KEY`.

2.  **Create Two Databases**: You need one database for your raw logs and another for the AI-generated summaries. Below are practical examples.

#### Schema Definition

The script automatically finds the correct properties by their **type** (`title`, `created_time`, `date`), so you are free to name them whatever you like in your own Notion setup.

##### Logs Database

This is where you'll write down your activities. 

| Property Type |
| :--- |
| `Text` |
| `Created Time` |

##### Summaries Database

This is where the AI will save its summaries. 

| Property Type |
| :--- |
| `Text` |
| `Created Time` |

#### Example

##### Logs Database

| Name | Date |
| :--- | :--- |
| Planning to sort through the mailbox.  | July 19, 2025 10:37 AM |
| Cleaned up the room, mainly around the desk. | July 19, 2025 11:19 AM |


##### Summaries Database

| Log | Created At |
| :--- | :--- |
| 2025-07-19 | July 19, 2025 12:53 PM | 

3.  **Share Databases with Integration**: For *both* databases, click the `...` menu, select "Add connections", and choose the integration you created.

4.  **Get Database IDs**: The ID is the 32-character string in the database URL (`https://www.notion.so/your-workspace/<DATABASE_ID>?v=...`).

### 3. Project Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/popyson1648/notion-ai-activity-summarizer.git
    cd notion-ai-activity-summarizer
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Create `.env` file:**
    Copy the example file and fill in your credentials.
    ```bash
    cp .env.example .env
    ```
    Edit `.env` with your keys and database IDs.

### 4. Local Testing

You can run an end-to-end test locally to ensure everything is configured correctly. This will connect to the actual Notion and Gemini APIs.

```bash
npx ts-node scripts/run-e2e-test.ts
```

## Deployment

Deploy the function to Google Cloud Functions using the `gcloud` CLI. Replace placeholders with your actual values.

```bash
gcloud functions deploy notionAIActivitySummarizer\
  --project <YOUR_PROJECT_ID> \
  --gen2 \
  --runtime nodejs18 \
  --region asia-northeast1 \
  --source . \
  --entry-point notionActivityLog \
  --trigger-http \
  --allow-unauthenticated \
  --set-env-vars="NOTION_API_KEY=<YOUR_NOTION_API_KEY>,NOTION_DATABASE_ID=<YOUR_LOG_DATABASE_ID>,SUMMARY_DATABASE_ID=<YOUR_SUMMARY_DATABASE_ID>,GEMINI_API_KEY=<YOUR_GEMINI_API_KEY>"
```
*Note: For production, you may want to remove `--allow-unauthenticated` and set up a secure trigger, such as Cloud Scheduler with OIDC authentication.*

## License

This project is licensed under the MIT License.

---

## A Note on Triggering

The function is triggered by a simple HTTP request, giving you complete flexibility.

In demonstrations, a Notion "Button" that opens the function's URL in a web browser is used for manual triggering. 
While this is a valid approach, it may not be the most optimal solution for all workflows. 
You are encouraged to explore and implement a trigger method that best suits your needs, such as using automation services (e.g., Make, Zapier), custom scripts, or scheduled jobs (e.g., Google Cloud Scheduler).
