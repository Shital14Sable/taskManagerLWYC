import { useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/context/AppContext';
import type { Note } from '@trackmind/core';
import { toISODateString } from '@trackmind/core';

export interface NoteFolder {
  name: string;
  path: string;
  subfolders: NoteFolder[];
  note_count: number;
}

export interface CreateNoteInput {
  title: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  is_daily_note?: boolean;
  date?: string;
  tags?: string[];
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  folder_path?: string;
  linked_task_ids?: string[];
  linked_project_ids?: string[];
  linked_habit_ids?: string[];
  linked_goal_ids?: string[];
  tags?: string[];
}

function buildFolderTree(notes: Note[], explicitFolders: string[]): NoteFolder[] {
  const folderMap = new Map<string, { count: number; subfolders: Set<string> }>();

  // Helper to add a folder path to the map
  const addFolderPath = (rawPath: string, incrementCount: boolean) => {
    const parts = rawPath.split('/').filter(Boolean);
    if (parts.length === 0) return;

    let currentPath = '';
    for (let i = 0; i < parts.length; i++) {
      const parentPath = currentPath;
      currentPath = currentPath ? currentPath + '/' + parts[i] : parts[i];

      if (!folderMap.has(currentPath)) {
        folderMap.set(currentPath, { count: 0, subfolders: new Set() });
      }

      if (parentPath && folderMap.has(parentPath)) {
        folderMap.get(parentPath)!.subfolders.add(parts[i]);
      }
    }

    // Increment count for the actual folder if requested
    if (incrementCount) {
      const normalizedPath = parts.join('/');
      if (folderMap.has(normalizedPath)) {
        folderMap.get(normalizedPath)!.count++;
      }
    }
  };

  // First, add all explicit folders (without incrementing count)
  for (const folderPath of explicitFolders) {
    const normalizedPath = folderPath.trim();
    if (normalizedPath && normalizedPath !== '/') {
      addFolderPath(normalizedPath, false);
    }
  }

  // Then, add folders from notes (with count increment)
  for (const note of notes) {
    const rawPath = note.folder_path?.trim() || '';
    if (rawPath && rawPath !== '/') {
      addFolderPath(rawPath, true);
    }
  }

  // Build tree structure
  function buildSubtree(path: string): NoteFolder[] {
    const folder = folderMap.get(path);
    if (!folder) return [];

    return Array.from(folder.subfolders).sort().map(name => {
      const subPath = path + '/' + name;
      return {
        name,
        path: subPath,
        subfolders: buildSubtree(subPath),
        note_count: folderMap.get(subPath)?.count ?? 0,
      };
    });
  }

  // Get root level folders (single-part paths like "NF1")
  const rootFolders: NoteFolder[] = [];
  for (const [path, data] of folderMap) {
    // Root folders don't contain slashes
    if (!path.includes('/')) {
      rootFolders.push({
        name: path,
        path,
        subfolders: buildSubtree(path),
        note_count: data.count,
      });
    }
  }

  return rootFolders.sort((a, b) => a.name.localeCompare(b.name));
}

export function useNotes(folder?: string) {
  const { notes, saveNote, deleteNote: removeNote, noteFolders, addNoteFolder } = useApp();

  // Filter notes by folder if specified
  const filteredNotes = useMemo(() => {
    if (!folder) return notes;
    return notes.filter(n => n.folder_path === folder || n.folder_path?.startsWith(folder + '/'));
  }, [notes, folder]);

  // Build folder tree (includes explicit folders even if empty)
  // Using explicit length in deps to ensure React detects array changes
  const folderTree = useMemo(() => buildFolderTree(notes, noteFolders), [notes, noteFolders, noteFolders.length]);

  const createNote = useCallback(async (data: CreateNoteInput): Promise<Note> => {
    const now = new Date().toISOString();
    // Normalize folder_path: empty or "/" means root (empty string)
    const normalizedFolderPath = data.folder_path?.trim();
    const folderPath = normalizedFolderPath && normalizedFolderPath !== '/' ? normalizedFolderPath : '';

    const newNote: Note = {
      id: uuidv4(),
      title: data.title,
      content: data.content ?? '',
      folder_path: folderPath,
      linked_task_ids: data.linked_task_ids ?? [],
      linked_project_ids: data.linked_project_ids ?? [],
      linked_habit_ids: data.linked_habit_ids ?? [],
      linked_goal_ids: data.linked_goal_ids ?? [],
      is_daily_note: data.is_daily_note ?? false,
      date: data.date,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
    };
    await saveNote(newNote);
    return newNote;
  }, [saveNote]);

  const updateNote = useCallback(async (id: string, data: UpdateNoteInput): Promise<Note> => {
    const existing = notes.find(n => n.id === id);
    if (!existing) {
      throw new Error(`Note ${id} not found`);
    }
    const updated: Note = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveNote(updated);
    return updated;
  }, [notes, saveNote]);

  const getDaily = useCallback(async (date?: string): Promise<Note> => {
    const targetDate = date ?? toISODateString(new Date());
    const existingDaily = notes.find(n => n.is_daily_note && n.date === targetDate);

    if (existingDaily) {
      return existingDaily;
    }

    // Create new daily note
    const newDaily = await createNote({
      title: `Daily Note - ${targetDate}`,
      is_daily_note: true,
      date: targetDate,
      folder_path: '/daily',
    });

    return newDaily;
  }, [notes, createNote]);

  const searchNotes = useCallback(async (query: string): Promise<Note[]> => {
    const lowerQuery = query.toLowerCase();
    return notes.filter(n =>
      n.title.toLowerCase().includes(lowerQuery) ||
      n.content.toLowerCase().includes(lowerQuery) ||
      n.tags.some(t => t.toLowerCase().includes(lowerQuery))
    );
  }, [notes]);

  const createFolder = useCallback((path: string): void => {
    // Add to note folders (persisted in AppContext)
    addNoteFolder(path);
  }, [addNoteFolder]);

  const linkTask = useCallback(async (noteId: string, taskId: string): Promise<Note> => {
    const existing = notes.find(n => n.id === noteId);
    if (!existing) {
      throw new Error(`Note ${noteId} not found`);
    }
    if (existing.linked_task_ids.includes(taskId)) {
      return existing;
    }
    return updateNote(noteId, {
      linked_task_ids: [...existing.linked_task_ids, taskId],
    });
  }, [notes, updateNote]);

  const linkProject = useCallback(async (noteId: string, projectId: string): Promise<Note> => {
    const existing = notes.find(n => n.id === noteId);
    if (!existing) {
      throw new Error(`Note ${noteId} not found`);
    }
    if (existing.linked_project_ids.includes(projectId)) {
      return existing;
    }
    return updateNote(noteId, {
      linked_project_ids: [...existing.linked_project_ids, projectId],
    });
  }, [notes, updateNote]);

  const linkGoal = useCallback(async (noteId: string, goalId: string): Promise<Note> => {
    const existing = notes.find(n => n.id === noteId);
    if (!existing) {
      throw new Error(`Note ${noteId} not found`);
    }
    if (existing.linked_goal_ids.includes(goalId)) {
      return existing;
    }
    return updateNote(noteId, {
      linked_goal_ids: [...existing.linked_goal_ids, goalId],
    });
  }, [notes, updateNote]);

  // Filtered notes
  const dailyNotes = useMemo(() => filteredNotes.filter(n => n.is_daily_note), [filteredNotes]);
  const regularNotes = useMemo(() => filteredNotes.filter(n => !n.is_daily_note), [filteredNotes]);

  return {
    notes: filteredNotes,
    folders: folderTree,
    dailyNotes,
    regularNotes,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    refetchFolders: () => Promise.resolve(),
    createNote,
    updateNote,
    deleteNote: removeNote,
    getDaily,
    searchNotes,
    createFolder,
    linkTask,
    linkProject,
    linkGoal,
  };
}
