import { Client } from '@notionhq/client';
import { jest } from '@jest/globals';
import { fetchDailyLogs, saveSummaryToNotion } from './notion';
import { format } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

jest.mock('@notionhq/client');

const mockRetrieve = jest.fn<Client['databases']['retrieve']>();
const mockQuery = jest.fn<Client['databases']['query']>();
const mockPageUpdate = jest.fn<Client['pages']['update']>();
const mockPageCreate = jest.fn<Client['pages']['create']>();

const MockClient = Client as jest.MockedClass<typeof Client>;

MockClient.mockImplementation(() => ({
  databases: {
    retrieve: mockRetrieve,
    query: mockQuery,
  },
  pages: {
    update: mockPageUpdate,
    create: mockPageCreate,
  },
} as any));

const notion = new MockClient({ auth: 'test_token' });

describe('fetchDailyLogs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRetrieve.mockResolvedValue({
      properties: { 'Title': { type: 'title' }, 'Created time': { type: 'created_time' } },
    } as any);
    mockQuery.mockResolvedValue({ results: [] } as any);
  });

  it('should query Notion with the correct JST day boundaries', async () => {
    const targetDate = new Date('2025-07-20T12:00:00.000Z'); // A time within the target JST day

    await fetchDailyLogs(notion, 'test_db_id', targetDate);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    const queryFilter = mockQuery.mock.calls[0][0].filter as any;

    const expectedStart = '2025-07-19T15:00:00.000Z';
    const expectedEnd = '2025-07-20T15:00:00.000Z';

    expect(queryFilter.and[0].created_time.on_or_after).toBe(expectedStart);
    expect(queryFilter.and[1].created_time.before).toBe(expectedEnd);
  });
});

describe('saveSummaryToNotion', () => {
  const summaryDatabaseId = 'test_summary_db_id';
  const summaries = { today: 'summary' };
  const targetDate = new Date('2025-07-19T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue({ results: [] } as any);
  });

  it('should create a page with a date property if it exists', async () => {
    mockRetrieve.mockResolvedValue({
      properties: {
        'Name': { type: 'title' },
        'Date': { type: 'date' },
      },
    } as any);

    await saveSummaryToNotion(notion, summaryDatabaseId, targetDate, summaries);

    expect(mockPageCreate).toHaveBeenCalledTimes(1);
    const createdPage = mockPageCreate.mock.calls[0][0];
    const properties = createdPage.properties as any;
    
    expect(properties['Name'].title[0].text.content).toBe('2025-07-19');
    expect(properties['Date'].date.start).toBe('2025-07-19');
  });

  it('should create a page without a date property if it does not exist', async () => {
    mockRetrieve.mockResolvedValue({
      properties: {
        'Name': { type: 'title' },
      },
    } as any);

    await saveSummaryToNotion(notion, summaryDatabaseId, targetDate, summaries);

    expect(mockPageCreate).toHaveBeenCalledTimes(1);
    const createdPage = mockPageCreate.mock.calls[0][0];
    const properties = createdPage.properties as any;

    expect(properties['Date']).toBeUndefined();
  });
});