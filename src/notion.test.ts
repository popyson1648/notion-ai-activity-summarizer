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
    
    expect(properties['Name'].title[0].text.content).toBe('2025-07-19 Summary');
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