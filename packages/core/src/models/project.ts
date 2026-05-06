import { v4 as uuidv4 } from 'uuid';

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string | null;
  priority: number;  // 1-5
  status: ProjectStatus;
  tags: string[];
  parent_id: string | null;
  color: string | null;  // Hex color for visual distinction (e.g., "#3B82F6")
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
  completed_at: string | null;  // ISO datetime string
  deadline?: string | null;     // ISO date string (YYYY-MM-DD) — target completion date
}

export interface ProjectCreate {
  name: string;
  description?: string | null;
  priority?: number;
  tags?: string[];
  parent_id?: string | null;
  color?: string | null;
  deadline?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  description?: string | null;
  priority?: number;
  status?: ProjectStatus;
  tags?: string[];
  parent_id?: string | null;
  color?: string | null;
  deadline?: string | null;
}

export function createProject(data: ProjectCreate): Project {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: data.name,
    description: data.description ?? null,
    priority: data.priority ?? 3,
    status: 'active',
    tags: data.tags ?? [],
    parent_id: data.parent_id ?? null,
    color: data.color ?? null,
    created_at: now,
    updated_at: now,
    completed_at: null,
    deadline: data.deadline ?? null,
  };
}
