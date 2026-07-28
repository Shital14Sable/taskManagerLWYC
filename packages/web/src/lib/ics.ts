import type { ScheduledTask, Task, Schedule } from '@trackmind/core'

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function minutesFromTimeStr(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Builds a local (floating) iCalendar date-time. Using floating time (no Z,
// no TZID) keeps this simple — calendar apps interpret it in the device's
// current timezone at import time, avoiding an IANA timezone dependency.
function formatICSDateTime(dateStr: string, totalMinutes: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day, 0, 0, 0)
  date.setMinutes(date.getMinutes() + totalMinutes)
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

const dtstampNow = (): string => {
  const now = new Date()
  return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`
}

function buildVEvents(date: string, scheduledTasks: ScheduledTask[], tasks: Task[], dtstamp: string): string[] {
  return scheduledTasks
    .filter(st => !st.is_buffer)
    .map(st => {
      const task = tasks.find(t => t.id === st.task_id)
      const title = task?.title || 'Task'

      const startMin = minutesFromTimeStr(st.start_time)
      let endMin = minutesFromTimeStr(st.end_time)
      // "00:00" after an evening start means midnight at the END of the day, not its start.
      if (endMin === 0 && startMin > 720) endMin = 1440

      const lines = [
        'BEGIN:VEVENT',
        `UID:${st.task_id}-${date}@trackmind.app`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART:${formatICSDateTime(date, startMin)}`,
        `DTEND:${formatICSDateTime(date, endMin)}`,
        `SUMMARY:${escapeICSText(title)}`,
      ]
      if (task?.description) {
        lines.push(`DESCRIPTION:${escapeICSText(task.description)}`)
      }
      lines.push('END:VEVENT')
      return lines.join('\r\n')
    })
}

function wrapVCalendar(events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrackMind//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function buildICSForSchedule(date: string, scheduledTasks: ScheduledTask[], tasks: Task[]): string {
  return wrapVCalendar(buildVEvents(date, scheduledTasks, tasks, dtstampNow()))
}

export function buildICSForDateRange(
  startDate: string,
  endDate: string,
  schedules: Map<string, Schedule>,
  tasks: Task[]
): string {
  const dtstamp = dtstampNow()
  const events: string[] = []

  for (const [date, schedule] of schedules) {
    if (date < startDate || date > endDate) continue
    if (!schedule.scheduled_tasks?.length) continue
    events.push(...buildVEvents(date, schedule.scheduled_tasks, tasks, dtstamp))
  }

  return wrapVCalendar(events)
}

export function buildICSForMonth(
  year: number,
  month: number,
  schedules: Map<string, Schedule>,
  tasks: Task[]
): string {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return buildICSForDateRange(
    `${year}-${mm}-01`,
    `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
    schedules,
    tasks
  )
}

export function downloadICS(filename: string, icsContent: string): void {
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
