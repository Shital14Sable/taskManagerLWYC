import type { ScheduledTask, Task } from '@trackmind/core'

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

export function buildICSForSchedule(date: string, scheduledTasks: ScheduledTask[], tasks: Task[]): string {
  const now = new Date()
  const dtstamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`

  const events = scheduledTasks
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

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TrackMind//Schedule Export//EN',
    'CALSCALE:GREGORIAN',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
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
