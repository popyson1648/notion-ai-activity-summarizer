import { Client } from '@notionhq/client';
import { format, parseISO, subDays, startOfToday, isValid, isFuture } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { summarizeLogs } from './core';
import { fetchDailyLogs, saveSummaryToNotion } from './notion';
import { generateSummary } from './gemini';
import { HttpFunction, Request } from '@google-cloud/functions-framework';
require('dotenv').config();

const TIME_ZONE = 'Asia/Tokyo';

class HttpError extends Error {
  constructor(message: string, public code: number) {
    super(message);
  }
}

function getTargetDate(query: Request['query']): Date {
  const { date, day } = query;
  const today = startOfToday();

  if (date) {
    if (typeof date !== 'string') throw new HttpError('Invalid date parameter', 400);
    const parsedDate = parseISO(date);
    if (!isValid(parsedDate)) throw new HttpError('Invalid date format. Use YYYY-MM-DD.', 400);
    if (isFuture(parsedDate)) throw new HttpError('Future date is not allowed.', 400);
    return parsedDate;
  }

  if (day) {
    if (typeof day !== 'string') throw new HttpError('Invalid day parameter', 400);
    switch (day) {
      case 'today':
        return today;
      case 'yesterday':
        return subDays(today, 1);
      case 'day_before_yesterday':
        return subDays(today, 2);
      default:
        throw new HttpError("Invalid day parameter. Use 'today', 'yesterday', or 'day_before_yesterday'.", 400);
    }
  }

  return today;
}

export const notionActivityLog: HttpFunction = async (req, res) => {
  const notion = new Client({ auth: process.env.NOTION_API_KEY });
  const logDatabaseId = process.env.NOTION_DATABASE_ID;
  const summaryDatabaseId = process.env.SUMMARY_DATABASE_ID;

  if (!logDatabaseId || !summaryDatabaseId || !process.env.GEMINI_API_KEY) {
    res.status(500).send('Missing environment variables');
    return;
  }

  try {
    const targetDate = getTargetDate(req.query);
    const zonedTargetDate = toZonedTime(targetDate, TIME_ZONE);

    const logs = await fetchDailyLogs(notion, logDatabaseId, zonedTargetDate);
    const categorizedLogs = summarizeLogs(logs);

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

    const aiSummaries: Record<string, string> = {
      today: todaySummary,
      am: amSummary,
      pm: pmSummary,
    };
    threeHourlySummaries.forEach((summary, index) => {
      aiSummaries[`threeHourly${index}`] = summary;
    });
    
    await saveSummaryToNotion(notion, summaryDatabaseId, zonedTargetDate, aiSummaries);
    
    const successMessage = `Successfully created AI-powered summary page for ${format(zonedTargetDate, 'yyyy-MM-dd')}`;
    console.log(successMessage);
    res.status(200).send(successMessage);

  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.code).send(error.message);
    } else {
      console.error('Error processing and saving summary:', error);
      res.status(500).send('Error processing and saving summary');
    }
  }
};
