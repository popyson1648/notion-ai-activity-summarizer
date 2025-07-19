import { summarizeLogs, LogEntry } from './core';

describe('summarizeLogs', () => {
  it('should correctly classify logs into AM and PM based on JST', () => {
    // JSTの午後11時 (23:00) をシミュレート
    // UTCでは同日の 14:00:00Z
    const pmLog: LogEntry = {
      content: 'This is a PM log',
      createdAt: new Date('2025-07-19T14:00:00.000Z'), // 23:00 JST
    };

    // JSTの午前11時 (11:00) をシミュレート
    // UTCでは同日の 02:00:00Z
    const amLog: LogEntry = {
      content: 'This is an AM log',
      createdAt: new Date('2025-07-19T02:00:00.000Z'), // 11:00 JST
    };

    const logs = [pmLog, amLog];
    const summaries = summarizeLogs(logs);

    expect(summaries.pm).toContain('This is a PM log');
    expect(summaries.am).not.toContain('This is a PM log');
    expect(summaries.am).toContain('This is an AM log');
    expect(summaries.pm).not.toContain('This is an AM log');
  });
});
