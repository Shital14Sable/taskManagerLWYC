import { v4 as uuidv4 } from 'uuid';

export interface Note {
  id: string;
  title: string;
  content: string;
  folder_path: string;
  linked_task_ids: string[];
  linked_project_ids: string[];
  linked_habit_ids: string[];
  linked_goal_ids: string[];
  is_daily_note: boolean;
  date: string | null;  // ISO date string for daily notes
  tags: string[];
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
}

export interface NoteCreate {
  title: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  is_daily_note?: boolean;
  date?: string | null;
  tags?: string[];
}

export interface NoteUpdate {
  title?: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  tags?: string[];
}

export interface Folder {
  name: string;
  path: string;
  subfolders: Folder[];
  note_count: number;
}

export function createNote(data: NoteCreate): Note {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    title: data.title,
    content: data.content ?? '',
    folder_path: data.folder_path ?? '',
    linked_task_ids: data.linked_task_ids ?? [],
    linked_project_ids: data.linked_project_ids ?? [],
    linked_habit_ids: data.linked_habit_ids ?? [],
    linked_goal_ids: data.linked_goal_ids ?? [],
    is_daily_note: data.is_daily_note ?? false,
    date: data.date ?? null,
    tags: data.tags ?? [],
    created_at: now,
    updated_at: now,
  };
}

export function getNoteSafeTitle(title: string): string {
  return title
    .replace(/[/\\]/g, '-')
    .replace(/[^a-zA-Z0-9 \-_]/g, '')
    .trim();
}

export function getNoteFilePath(note: Note): string {
  const safeTitle = getNoteSafeTitle(note.title);
  if (note.folder_path) {
    return `${note.folder_path}/${safeTitle}.md`;
  }
  return `${safeTitle}.md`;
}
