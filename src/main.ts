import { Client } from '@notionhq/client';
import { format } from 'date-fns';
import { summarizeLogs } from './core';
import { fetchDailyLogs, saveSummaryToNotion } from './notion';
import { generateSummary } from './gemini';
import { HttpFunction } from '@google-cloud/functions-framework';
require('dotenv').config();

export const notionActivityLog: HttpFunction = async (req, res) => {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const logDatabaseId = process.env.NOTION_DATABASE_ID;
  const summaryDatabaseId = process.env.SUMMARY_DATABASE_ID;

  if (!logDatabaseId || !summaryDatabaseId || !process.env.GEMINI_API_KEY) {
    const errorMessage = 'Missing environment variables';
    console.error(errorMessage);
    res.status(500).send(errorMessage);
    return;
  }

  try {
    const { logs, targetDate } = await fetchDailyLogs(notion, logDatabaseId);
    const categorizedLogs = summarizeLogs(logs);

    const [
      todaySummary,
      amSummary,
      pmSummary,
      ...threeHourlySummaries
    ] = await Promise.all([
      generateSummary(categorizedLogs.today, 'broad'), // Broad scope for wide time ranges
      generateSummary(categorizedLogs.am, 'broad'),
      generateSummary(categorizedLogs.pm, 'broad'),
      ...categorizedLogs.threeHourly.map(logs => generateSummary(logs, 'detailed')) // Detailed scope for narrow time ranges
    ]);

    const aiSummaries: Record<string, string> = {
      today: todaySummary,
      am: amSummary,
      pm: pmSummary,
    };

    threeHourlySummaries.forEach((summary, index) => {
      aiSummaries[`threeHourly${index}`] = summary;
    });
    
    await saveSummaryToNotion(notion, summaryDatabaseId, targetDate, aiSummaries);
    
    const successMessage = `Successfully created AI-powered summary page for ${format(targetDate, 'yyyy-MM-dd')}`;
    console.log(successMessage);
    res.status(200).send(successMessage);

  } catch (error) {
    console.error('Error processing and saving summary:', error);
    res.status(500).send('Error processing and saving summary');
  }
};
