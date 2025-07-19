
import * as dotenv from 'dotenv';
dotenv.config();

import { Client } from '@notionhq/client';

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const logDatabaseId = process.env.LOG_DATABASE_ID;

async function checkLogSchema() {
  if (!logDatabaseId) {
    console.error('LOG_DATABASE_ID is not set in your .env file.');
    return;
  }

  try {
    console.log(`Fetching a page from database: ${logDatabaseId}`);
    const response = await notion.databases.query({
      database_id: logDatabaseId,
      page_size: 1,
    });

    if (response.results.length === 0) {
      console.log('No pages found in the LOG database.');
      return;
    }

    const page = response.results[0];

    // Type guard to ensure we have a full page object with properties
    if (!('properties' in page)) {
        console.log('The fetched item is a partial object and does not contain properties.');
        return;
    }

    console.log('Successfully fetched a page. Here are its properties:');
    console.log(JSON.stringify(page.properties, null, 2));

  } catch (error) {
    console.error('Error fetching from Notion API:', error);
  }
}

checkLogSchema();
