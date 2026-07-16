import fs from 'fs';
import path from 'path';
import { env } from '../config/env';

interface GumroadAutopilotDayState {
  published: number;
  page_ids: string[];
  failures: number;
}

interface GumroadAutopilotState {
  days: Record<string, GumroadAutopilotDayState>;
}

const stateFilePath = path.join(process.cwd(), 'data', 'gumroad-autopilot-state.json');

function getLocalDayKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: env.GUMROAD_AUTOPILOT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

function readState(): GumroadAutopilotState {
  try {
    if (!fs.existsSync(stateFilePath)) {
      return { days: {} };
    }
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (error: any) {
    console.warn(`[GUMROAD-AUTOPILOT] Could not read state file: ${error.message}`);
    return { days: {} };
  }
}

function writeState(state: GumroadAutopilotState) {
  fs.mkdirSync(path.dirname(stateFilePath), { recursive: true });
  fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2));
}

function getDay(state: GumroadAutopilotState, dayKey: string): GumroadAutopilotDayState {
  if (!state.days[dayKey]) {
    state.days[dayKey] = { published: 0, page_ids: [], failures: 0 };
  }
  return state.days[dayKey];
}

export function getGumroadAutopilotQuota() {
  const dayKey = getLocalDayKey();
  const state = readState();
  const day = getDay(state, dayKey);

  return {
    day_key: dayKey,
    limit: env.GUMROAD_AUTOPILOT_DAILY_LIMIT,
    published: day.published,
    remaining: Math.max(0, env.GUMROAD_AUTOPILOT_DAILY_LIMIT - day.published),
    failures: day.failures,
  };
}

export function recordGumroadAutopilotPublished(pageId: string) {
  const dayKey = getLocalDayKey();
  const state = readState();
  const day = getDay(state, dayKey);

  if (!day.page_ids.includes(pageId)) {
    day.page_ids.push(pageId);
    day.published += 1;
  }

  writeState(state);
  return getGumroadAutopilotQuota();
}

export function recordGumroadAutopilotFailure() {
  const dayKey = getLocalDayKey();
  const state = readState();
  const day = getDay(state, dayKey);

  day.failures += 1;

  writeState(state);
  return getGumroadAutopilotQuota();
}

