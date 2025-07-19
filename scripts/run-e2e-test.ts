import { Client } from '@notionhq/client';
import { format } from 'date-fns';
import { summarizeLogs } from '../src/core';
import { fetchDailyLogs, saveSummaryToNotion } from '../src/notion';
import { generateSummary } from '../src/gemini';
import 'dotenv/config';

async function runTest() {
  console.log('🚀 Starting Final End-to-End Test...');

  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const logDatabaseId = process.env.NOTION_DATABASE_ID;
  const summaryDatabaseId = process.env.SUMMARY_DATABASE_ID;

  if (!logDatabaseId || !summaryDatabaseId || !process.env.GEMINI_API_KEY || !process.env.NOTION_API_KEY) {
    console.error('❌ Missing environment variables. Please check your .env file.');
    return;
  }

  try {
    console.log(`[1/4] Fetching logs for today (JST)...`);
    const { logs, targetDate } = await fetchDailyLogs(notion, logDatabaseId);
    console.log(`✅ Found ${logs.length} logs for ${format(targetDate, 'yyyy-MM-dd')}.`);

    console.log('[2/4] Categorizing logs...');
    const categorizedLogs = summarizeLogs(logs);
    
    console.log('[3/4] Generating AI summaries with controlled abstraction...');
    const [
      todaySummary,
      amSummary,
      pmSummary,
      ...threeHourlySummaries
    ] = await Promise.all([
      generateSummary(categorizedLogs.today, 'broad'),
      generateSummary(categorizedLogs.am, 'broad'),
      generateSummary(categorizedLogs.pm, 'broad'),
      ...categorizedLogs.threeHourly.map(logs => generateSummary(logs, 'detailed'))
    ]);
    console.log('✅ AI summaries generated.');

    const aiSummaries: Record<string, string> = {
      today: todaySummary,
      am: amSummary,
      pm: pmSummary,
    };
    threeHourlySummaries.forEach((summary, index) => {
      aiSummaries[`threeHourly${index}`] = summary;
    });

    console.log('[4/4] Saving final summary to Notion...');
    await saveSummaryToNotion(notion, summaryDatabaseId, targetDate, aiSummaries);
    console.log('✅ Summary saved to Notion.');

    console.log('\n🎉 E2E Test Completed Successfully!');
    console.log('👉 Please verify the new page. It should now contain truly intelligent, structured summaries.');

  } catch (error) {
    console.error('❌ E2E Test Failed:');
    console.error(error);
  }
}

runTest();