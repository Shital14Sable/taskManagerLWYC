import { Task, Project, Goal, Note, TaskList } from '../models';

export interface SearchResult {
  type: 'task' | 'project' | 'goal' | 'note' | 'list';
  id: string;
  title: string;
  description?: string;
  score: number;
  matchedFields: string[];
}

export interface SearchOptions {
  query: string;
  types?: Array<'task' | 'project' | 'goal' | 'note' | 'list'>;
  limit?: number;
  includeCompleted?: boolean;
}

export class SearchService {
  /**
   * Search across all entity types
   */
  search(
    options: SearchOptions,
    data: {
      tasks?: Task[];
      projects?: Project[];
      goals?: Goal[];
      notes?: Note[];
      lists?: TaskList[];
    }
  ): SearchResult[] {
    const { query, types, limit = 50, includeCompleted = false } = options;
    const results: SearchResult[] = [];

    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 0);

    // Search tasks
    if (!types || types.includes('task')) {
      for (const task of data.tasks ?? []) {
        if (!includeCompleted && task.status === 'completed') continue;

        const result = this.matchTask(task, queryTerms);
        if (result) results.push(result);
      }
    }

    // Search projects
    if (!types || types.includes('project')) {
      for (const project of data.projects ?? []) {
        if (!includeCompleted && project.status === 'completed') continue;

        const result = this.matchProject(project, queryTerms);
        if (result) results.push(result);
      }
    }

    // Search goals
    if (!types || types.includes('goal')) {
      for (const goal of data.goals ?? []) {
        if (!includeCompleted && goal.status === 'achieved') continue;

        const result = this.matchGoal(goal, queryTerms);
        if (result) results.push(result);
      }
    }

    // Search notes
    if (!types || types.includes('note')) {
      for (const note of data.notes ?? []) {
        const result = this.matchNote(note, queryTerms);
        if (result) results.push(result);
      }
    }

    // Search lists
    if (!types || types.includes('list')) {
      for (const list of data.lists ?? []) {
        if (list.archived) continue;

        const result = this.matchList(list, queryTerms);
        if (result) results.push(result);
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  private matchTask(task: Task, queryTerms: string[]): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    const titleLower = task.title.toLowerCase();
    const descLower = (task.description ?? '').toLowerCase();
    const tagsLower = task.tags.map(t => t.toLowerCase());

    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        matchedFields.push('title');
        score += 10;
      }
      if (descLower.includes(term)) {
        matchedFields.push('description');
        score += 5;
      }
      if (tagsLower.some(t => t.includes(term))) {
        matchedFields.push('tags');
        score += 3;
      }
    }

    if (score === 0) return null;

    // Boost for exact title match
    if (titleLower === queryTerms.join(' ')) {
      score += 20;
    }

    // Boost for high priority
    score += (6 - task.priority);

    return {
      type: 'task',
      id: task.id,
      title: task.title,
      description: task.description ?? undefined,
      score,
      matchedFields: [...new Set(matchedFields)],
    };
  }

  private matchProject(project: Project, queryTerms: string[]): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    const nameLower = project.name.toLowerCase();
    const descLower = (project.description ?? '').toLowerCase();
    const tagsLower = project.tags.map(t => t.toLowerCase());

    for (const term of queryTerms) {
      if (nameLower.includes(term)) {
        matchedFields.push('name');
        score += 10;
      }
      if (descLower.includes(term)) {
        matchedFields.push('description');
        score += 5;
      }
      if (tagsLower.some(t => t.includes(term))) {
        matchedFields.push('tags');
        score += 3;
      }
    }

    if (score === 0) return null;

    return {
      type: 'project',
      id: project.id,
      title: project.name,
      description: project.description ?? undefined,
      score,
      matchedFields: [...new Set(matchedFields)],
    };
  }

  private matchGoal(goal: Goal, queryTerms: string[]): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    const titleLower = goal.title.toLowerCase();
    const descLower = (goal.description ?? '').toLowerCase();

    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        matchedFields.push('title');
        score += 10;
      }
      if (descLower.includes(term)) {
        matchedFields.push('description');
        score += 5;
      }
      if (goal.category.toLowerCase().includes(term)) {
        matchedFields.push('category');
        score += 3;
      }
    }

    if (score === 0) return null;

    return {
      type: 'goal',
      id: goal.id,
      title: goal.title,
      description: goal.description ?? undefined,
      score,
      matchedFields: [...new Set(matchedFields)],
    };
  }

  private matchNote(note: Note, queryTerms: string[]): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    const titleLower = note.title.toLowerCase();
    const contentLower = note.content.toLowerCase();
    const tagsLower = note.tags.map(t => t.toLowerCase());

    for (const term of queryTerms) {
      if (titleLower.includes(term)) {
        matchedFields.push('title');
        score += 10;
      }
      if (contentLower.includes(term)) {
        matchedFields.push('content');
        score += 5;
      }
      if (tagsLower.some(t => t.includes(term))) {
        matchedFields.push('tags');
        score += 3;
      }
      if (note.folder_path.toLowerCase().includes(term)) {
        matchedFields.push('folder');
        score += 2;
      }
    }

    if (score === 0) return null;

    return {
      type: 'note',
      id: note.id,
      title: note.title,
      description: note.content.slice(0, 200),
      score,
      matchedFields: [...new Set(matchedFields)],
    };
  }

  private matchList(list: TaskList, queryTerms: string[]): SearchResult | null {
    const matchedFields: string[] = [];
    let score = 0;

    const nameLower = list.name.toLowerCase();
    const descLower = (list.description ?? '').toLowerCase();
    const itemsText = list.items.map(i => i.text.toLowerCase()).join(' ');

    for (const term of queryTerms) {
      if (nameLower.includes(term)) {
        matchedFields.push('name');
        score += 10;
      }
      if (descLower.includes(term)) {
        matchedFields.push('description');
        score += 5;
      }
      if (itemsText.includes(term)) {
        matchedFields.push('items');
        score += 3;
      }
    }

    if (score === 0) return null;

    return {
      type: 'list',
      id: list.id,
      title: list.name,
      description: list.description ?? undefined,
      score,
      matchedFields: [...new Set(matchedFields)],
    };
  }

  /**
   * Search tasks by tag
   */
  searchByTag(tasks: Task[], tag: string): Task[] {
    const tagLower = tag.toLowerCase();
    return tasks.filter(task =>
      task.tags.some(t => t.toLowerCase() === tagLower)
    );
  }

  /**
   * Search tasks by project
   */
  searchByProject(tasks: Task[], projectId: string): Task[] {
    return tasks.filter(task => task.project_id === projectId);
  }

  /**
   * Get tasks with upcoming deadlines
   */
  getUpcomingDeadlines(tasks: Task[], days: number = 7): Task[] {
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + days);

    return tasks
      .filter(task => {
        if (task.status === 'completed' || !task.deadline) return false;
        const deadline = new Date(task.deadline);
        return deadline >= now && deadline <= cutoff;
      })
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }

  /**
   * Get overdue tasks
   */
  getOverdueTasks(tasks: Task[]): Task[] {
    const now = new Date();
    return tasks
      .filter(task => {
        if (task.status === 'completed' || !task.deadline) return false;
        return new Date(task.deadline) < now;
      })
      .sort((a, b) => new Date(a.deadline!).getTime() - new Date(b.deadline!).getTime());
  }
}
