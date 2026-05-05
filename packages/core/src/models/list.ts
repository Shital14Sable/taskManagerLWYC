import { v4 as uuidv4 } from 'uuid';

export type ListType = 'eternal' | 'template' | 'quick';

export interface ListItem {
  id: string;
  text: string;
  quantity: string | null;
  notes: string | null;
  category: string | null;
  url: string | null;
  tags: string[];
  children: ListItem[];
  order: number;
  completed_at: string | null;  // ISO datetime string
  // Extended properties
  price: string | null;
  rating: number | null;  // 1-5
  priority: string | null;  // "high", "medium", "low"
  location: string | null;
  due_date: string | null;  // ISO datetime string
  source: string | null;
  image_url: string | null;
}

export interface TaskList {
  id: string;
  name: string;
  description: string | null;
  list_type: ListType;
  items: ListItem[];
  categories: string[];
  linked_habit_ids: string[];
  linked_project_ids: string[];
  created_at: string;  // ISO datetime string
  updated_at: string;  // ISO datetime string
  archived: boolean;
  is_pinned: boolean;
  color: string | null;
  icon: string | null;
  default_sort: string | null;
  completed_at: string | null;  // ISO datetime string - when list is marked complete
}

export interface ListInstance {
  id: string;
  list_id: string;
  name: string;
  item_states: Record<string, boolean>;  // item_id -> checked
  extra_items: ListItem[];
  linked_habit_instance_id: string | null;
  created_at: string;  // ISO datetime string
  completed_at: string | null;  // ISO datetime string
  archived_at: string | null;  // ISO datetime string
}

export interface ListCreate {
  name: string;
  description?: string | null;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  is_pinned?: boolean;
  color?: string | null;
  icon?: string | null;
  default_sort?: string | null;
}

export interface ListUpdate {
  name?: string;
  description?: string | null;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  archived?: boolean;
  is_pinned?: boolean;
  color?: string | null;
  icon?: string | null;
  default_sort?: string | null;
  completed_at?: string | null;
}

export interface ListItemCreate {
  text: string;
  quantity?: string | null;
  notes?: string | null;
  category?: string | null;
  url?: string | null;
  tags?: string[];
  children?: ListItemCreate[];
  order?: number;
  parent_item_id?: string | null;
  price?: string | null;
  rating?: number | null;
  priority?: string | null;
  location?: string | null;
  due_date?: string | null;
  source?: string | null;
  image_url?: string | null;
}

export interface ListItemUpdate {
  text?: string;
  quantity?: string | null;
  notes?: string | null;
  category?: string | null;
  url?: string | null;
  tags?: string[];
  order?: number;
  completed_at?: string | null;
  price?: string | null;
  rating?: number | null;
  priority?: string | null;
  location?: string | null;
  due_date?: string | null;
  source?: string | null;
  image_url?: string | null;
}

export interface ListInstanceCreate {
  list_id: string;
  name?: string | null;
  linked_habit_instance_id?: string | null;
}

export interface ListInstanceUpdate {
  name?: string;
  item_states?: Record<string, boolean>;
  completed_at?: string | null;
  archived_at?: string | null;
}

export function createListItem(data: ListItemCreate): ListItem {
  return {
    id: uuidv4(),
    text: data.text,
    quantity: data.quantity ?? null,
    notes: data.notes ?? null,
    category: data.category ?? null,
    url: data.url ?? null,
    tags: data.tags ?? [],
    children: (data.children ?? []).map(createListItem),
    order: data.order ?? 0,
    completed_at: null,
    price: data.price ?? null,
    rating: data.rating ?? null,
    priority: data.priority ?? null,
    location: data.location ?? null,
    due_date: data.due_date ?? null,
    source: data.source ?? null,
    image_url: data.image_url ?? null,
  };
}

export function createList(data: ListCreate): TaskList {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    name: data.name,
    description: data.description ?? null,
    list_type: data.list_type ?? 'eternal',
    items: [],
    categories: data.categories ?? [],
    linked_habit_ids: data.linked_habit_ids ?? [],
    linked_project_ids: data.linked_project_ids ?? [],
    created_at: now,
    updated_at: now,
    archived: false,
    is_pinned: data.is_pinned ?? false,
    color: data.color ?? null,
    icon: data.icon ?? null,
    default_sort: data.default_sort ?? null,
    completed_at: null,
  };
}

export function createListInstance(data: ListInstanceCreate, templateName?: string): ListInstance {
  const now = new Date().toISOString();
  return {
    id: uuidv4(),
    list_id: data.list_id,
    name: data.name ?? `${templateName ?? 'List'} - ${new Date().toLocaleDateString()}`,
    item_states: {},
    extra_items: [],
    linked_habit_instance_id: data.linked_habit_instance_id ?? null,
    created_at: now,
    completed_at: null,
    archived_at: null,
  };
}
