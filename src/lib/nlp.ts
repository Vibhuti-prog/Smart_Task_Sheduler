import type { ParsedTask, Priority } from '../types';
import { addDays } from './dates';

// Natural-language task parser. Runs fully client-side — no external API.
// Handles relative dates ("tomorrow", "next week"), explicit times
// ("at 10 AM", "by 5pm"), priority words, categories, and #tags.

const PRIORITY_WORDS: Record<string, Priority> = {
  urgent: 'high',
  critical: 'high',
  important: 'high',
  asap: 'high',
  high: 'high',
  normal: 'medium',
  medium: 'medium',
  low: 'low',
  whenever: 'low',
  someday: 'low',
};

const CATEGORY_WORDS: Record<string, string> = {
  work: 'Work',
  office: 'Work',
  meeting: 'Work',
  project: 'Work',
  personal: 'Personal',
  home: 'Personal',
  family: 'Personal',
  study: 'Study',
  assignment: 'Study',
  homework: 'Study',
  exam: 'Study',
  school: 'Study',
  health: 'Health',
  workout: 'Health',
  gym: 'Health',
  shopping: 'Errands',
  errand: 'Errands',
  grocery: 'Errands',
};

function nextWeekday(target: number, base: Date): Date {
  const d = new Date(base);
  const current = d.getDay();
  let diff = (target - current + 7) % 7;
  if (diff === 0) diff = 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function parseTime(text: string): { hours: number; minutes: number } | null {
  const m = text.match(/(?:at|by|@)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let hours = parseInt(m[1], 10);
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3]?.toLowerCase();
  if (ampm === 'pm' && hours < 12) hours += 12;
  if (ampm === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

export function parseNaturalLanguage(input: string): ParsedTask {
  let text = ` ${input.trim()} `;
  const tags = new Set<string>();
  const tagMatches = text.match(/#([a-zA-Z0-9_-]+)/g);
  if (tagMatches) {
    tagMatches.forEach((t) => {
      tags.add(t.slice(1).toLowerCase());
      text = text.replace(t, ' ');
    });
  }

  let priority: Priority | null = null;
  for (const [word, prio] of Object.entries(PRIORITY_WORDS)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(text)) {
      priority = prio;
      text = text.replace(re, ' ');
      break;
    }
  }

  let category: string | null = null;
  for (const [word, cat] of Object.entries(CATEGORY_WORDS)) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(text)) {
      category = cat;
      break;
    }
  }

  const now = new Date();
  let dueDate: Date | null = null;
  let timeSet = false;

  const timeMatch = text.match(/(?:at|by|@)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
  if (timeMatch) {
    const t = parseTime(timeMatch[1]);
    if (t) {
      if (!dueDate) dueDate = new Date(now);
      dueDate.setHours(t.hours, t.minutes, 0, 0);
      timeSet = true;
      text = text.replace(timeMatch[0], ' ');
    }
  } else {
    const bareTime = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);
    if (bareTime) {
      const t = parseTime(bareTime[1]);
      if (t) {
        if (!dueDate) dueDate = new Date(now);
        dueDate.setHours(t.hours, t.minutes, 0, 0);
        timeSet = true;
        text = text.replace(bareTime[0], ' ');
      }
    }
  }

  const lower = text.toLowerCase();
  const dateMap: { regex: RegExp; make: () => Date }[] = [
    { regex: /\btoday\b/, make: () => new Date(now) },
    { regex: /\btonight\b/, make: () => new Date(now) },
    { regex: /\btomorrow\b/, make: () => addDays(now, 1) },
    { regex: /\bday after tomorrow\b/, make: () => addDays(now, 2) },
    { regex: /\bnext week\b/, make: () => addDays(now, 7) },
    { regex: /\bnext month\b/, make: () => addDays(now, 30) },
    { regex: /\bin (\d+) days?\b/, make: () => addDays(now, parseInt(RegExp.$1, 10)) },
    { regex: /\bin (\d+) weeks?\b/, make: () => addDays(now, parseInt(RegExp.$1, 10) * 7) },
    { regex: /\bmonday\b/, make: () => nextWeekday(1, now) },
    { regex: /\btuesday\b/, make: () => nextWeekday(2, now) },
    { regex: /\bwednesday\b/, make: () => nextWeekday(3, now) },
    { regex: /\bthursday\b/, make: () => nextWeekday(4, now) },
    { regex: /\bfriday\b/, make: () => nextWeekday(5, now) },
    { regex: /\bsaturday\b/, make: () => nextWeekday(6, now) },
    { regex: /\bsunday\b/, make: () => nextWeekday(0, now) },
  ];

  for (const { regex, make } of dateMap) {
    if (regex.test(lower)) {
      const d = make();
      if (timeSet && dueDate) {
        dueDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      } else {
        dueDate = new Date(d);
        dueDate.setHours(9, 0, 0, 0);
      }
      text = text.replace(regex, ' ');
      break;
    }
  }

  if (dueDate) {
    const explicitMonth = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{1,2})\b/i);
    if (explicitMonth) {
      const monthIdx = 'jan feb mar apr may jun jul aug sep oct nov dec'.split(' ').indexOf(explicitMonth[1].toLowerCase().slice(0, 3));
      const day = parseInt(explicitMonth[2], 10);
      if (monthIdx >= 0) {
        const d = new Date(now.getFullYear(), monthIdx, day, timeSet && dueDate ? dueDate.getHours() : 9, timeSet && dueDate ? dueDate.getMinutes() : 0);
        if (d < now) d.setFullYear(d.getFullYear() + 1);
        dueDate = d;
        text = text.replace(explicitMonth[0], ' ');
      }
    }
  }

  text = text.replace(/\b(remind me to|remind me|schedule|add task|create task|to|due|by|on|for)\b/gi, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  text = text.replace(/^[-:,]+|[-:,]+$/g, '').trim();

  const title = text.charAt(0).toUpperCase() + text.slice(1);

  return {
    title: title || 'Untitled task',
    dueDate,
    priority,
    category,
    tags: Array.from(tags),
  };
}
