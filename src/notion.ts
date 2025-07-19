import { Client } from '@notionhq/client';
import { startOfDay, addDays, format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { PageObjectResponse, QueryDatabaseResponse, CreatePageParameters, BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { LogEntry } from './core';

const TIME_ZONE = 'Asia/Tokyo';

async function findPropertyNames(notion: Client, databaseId: string, types: ('title' | 'created_time' | 'date')[]) {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const names: { title?: string; createdTime?: string; date?: string } = {};

  for (const propertyName in db.properties) {
    const property = db.properties[propertyName];
    if (property?.type === 'title' && types.includes('title')) {
      names.title = propertyName;
    }
    if (property?.type === 'created_time' && types.includes('created_time')) {
      names.createdTime = propertyName;
    }
    if (property?.type === 'date' && types.includes('date')) {
      names.date = propertyName;
    }
  }
  return names;
}

export async function fetchDailyLogs(notion: Client, databaseId: string, targetDate: Date): Promise<LogEntry[]> {
  const propNames = await findPropertyNames(notion, databaseId, ['title', 'created_time']);
  if (!propNames.title || !propNames.createdTime) {
    throw new Error(`Log database ${databaseId} must have one 'title' and one 'created_time' property.`);
  }
  
  // This function now trusts that targetDate is the correct date.
  // It does not apply any timezone logic itself.
  const jstDate = toZonedTime(targetDate, TIME_ZONE);
  const startOfDayToQuery = startOfDay(jstDate);
  const startOfNextDayToQuery = startOfDay(addDays(jstDate, 1));

  const response: QueryDatabaseResponse = await notion.databases.query({
    database_id: databaseId,
    filter: {
      and: [
        { property: propNames.createdTime, created_time: { on_or_after: startOfDayToQuery.toISOString() } },
        { property: propNames.createdTime, created_time: { before: startOfNextDayToQuery.toISOString() } },
      ],
    },
  });

  const pages = response.results.filter(
    (page): page is PageObjectResponse => 'properties' in page
  );

  const logs = pages.map((page) => {
    const titleProperty = page.properties[propNames.title!];
    let content = '';
    if (titleProperty?.type === 'title' && titleProperty.title.length > 0) {
      const titleItem = titleProperty.title[0];
      if (titleItem?.type === 'text') {
        content = titleItem.text.content;
      }
    }
    return { content, createdAt: new Date(page.created_time) };
  });

  return logs;
}

async function findExistingSummaryPage(notion: Client, databaseId: string, title: string, titlePropertyName: string): Promise<string | null> {
  const response = await notion.databases.query({
    database_id: databaseId,
    filter: {
      property: titlePropertyName,
      title: {
        equals: title,
      },
    },
  });
  return response.results[0]?.id ?? null;
}

export async function saveSummaryToNotion(
  notion: Client,
  databaseId: string,
  targetDate: Date,
  summaries: Record<string, string>
): Promise<void> {
  const propNames = await findPropertyNames(notion, databaseId, ['title', 'date']);
  if (!propNames.title) {
    throw new Error(`Summary database ${databaseId} must have one 'title' property.`);
  }
  const titlePropertyName = propNames.title;
  const datePropertyName = propNames.date;
  const title = format(toZonedTime(targetDate, TIME_ZONE), 'yyyy-MM-dd');

  const existingPageId = await findExistingSummaryPage(notion, databaseId, title, titlePropertyName);
  if (existingPageId) {
    console.log(`Archiving existing summary page: ${existingPageId}`);
    await notion.pages.update({ page_id: existingPageId, archived: true });
  }

  const blocks: BlockObjectRequest[] = [];
  // ... (Block generation logic omitted for brevity)
  const mainSections = [
    { title: 'TODAY', key: 'today' },
    { title: 'AM', key: 'am' },
    { title: 'PM', key: 'pm' },
  ];

  for (const section of mainSections) {
    blocks.push({ type: 'heading_1', heading_1: { rich_text: [{ text: { content: section.title } }] } });
    blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ text: { content: summaries[section.key] } }] } });
  }

  blocks.push({ type: 'heading_1', heading_1: { rich_text: [{ text: { content: 'THREE HOURLY' } }] } });
  const threeHourlyTitles = [
    '00:00～3:00', '3:00～6:00', '6:00～9:00', '9:00～12:00',
    '12:00～15:00', '15:00～18:00', '18:00～21:00', '21:00～00:00',
  ];

  for (let i = 0; i < 8; i++) {
    blocks.push({ type: 'heading_2', heading_2: { rich_text: [{ text: { content: threeHourlyTitles[i] } }] } });
    blocks.push({ type: 'paragraph', paragraph: { rich_text: [{ text: { content: summaries[`threeHourly${i}`] } }] } });
  }

  const pageProperties: CreatePageParameters['properties'] = {
    [titlePropertyName]: {
      type: 'title',
      title: [{ type: 'text', text: { content: title } }],
    },
  };

  if (datePropertyName) {
    pageProperties[datePropertyName] = {
      type: 'date',
      date: {
        start: format(targetDate, 'yyyy-MM-dd'),
      },
    };
  }

  await notion.pages.create({
    parent: { database_id: databaseId },
    properties: pageProperties,
    children: blocks,
  });
}


// Helper function to convert UTC date to JST date
export function getJstDate(date: Date): Date {
  return toZonedTime(date, TIME_ZONE);
}