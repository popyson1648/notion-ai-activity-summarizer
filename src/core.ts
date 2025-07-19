// Type for a single log entry
export interface LogEntry {
  content: string;
  createdAt: Date;
}

export interface Summaries {
  today: string[];
  am: string[];
  pm: string[];
  threeHourly: string[][];
}

export function summarizeLogs(logs: LogEntry[]): Summaries {
  const summaries: Summaries = {
    today: [],
    am: [],
    pm: [],
    threeHourly: Array.from({ length: 8 }, () => []),
  };

  for (const log of logs) {
    const hour = log.createdAt.getHours();
    const content = log.content;

    summaries.today.push(content);

    if (hour < 12) {
      summaries.am.push(content);
    } else {
      summaries.pm.push(content);
    }

    const threeHourIndex = Math.floor(hour / 3);
    summaries.threeHourly[threeHourIndex].push(content);
  }

  return summaries;
}
