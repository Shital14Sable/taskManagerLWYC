import { useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/context/AppContext';
import type { TaskList, ListInstance, ListItem } from '@trackmind/core';

export type ListType = 'eternal' | 'template' | 'quick';

export interface CreateListInput {
  name: string;
  description?: string;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  default_sort?: 'order' | 'rating' | 'price' | 'priority' | 'due_date';
}

export interface UpdateListInput {
  name?: string;
  description?: string;
  list_type?: ListType;
  categories?: string[];
  linked_habit_ids?: string[];
  linked_project_ids?: string[];
  is_pinned?: boolean;
  color?: string;
  icon?: string;
  default_sort?: 'order' | 'rating' | 'price' | 'priority' | 'due_date';
  archived?: boolean;
  completed_at?: string | null;
}

export interface CreateListItemInput {
  text: string;
  quantity?: string;
  notes?: string;
  category?: string;
  url?: string;
  tags?: string[];
  children?: CreateListItemInput[];
  order?: number;
  parent_item_id?: string;
  price?: string;
  rating?: number;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  due_date?: string;
  source?: string;
  image_url?: string;
}

export interface UpdateListItemInput {
  text?: string;
  quantity?: string;
  notes?: string;
  category?: string;
  url?: string;
  tags?: string[];
  order?: number;
  completed_at?: string;
  price?: string;
  rating?: number;
  priority?: 'high' | 'medium' | 'low';
  location?: string;
  due_date?: string;
  source?: string;
  image_url?: string;
}

function createListItem(data: CreateListItemInput, order: number): ListItem {
  return {
    id: uuidv4(),
    text: data.text,
    quantity: data.quantity,
    notes: data.notes,
    category: data.category,
    url: data.url,
    tags: data.tags ?? [],
    children: (data.children ?? []).map((c, i) => createListItem(c, i)),
    order: data.order ?? order,
    price: data.price,
    rating: data.rating,
    priority: data.priority,
    location: data.location,
    due_date: data.due_date,
    source: data.source,
    image_url: data.image_url,
  };
}

export function useLists(_includeArchived: boolean = false) {
  const { lists, saveList, deleteList: removeList } = useApp();

  const createList = useCallback(async (data: CreateListInput): Promise<TaskList> => {
    const now = new Date().toISOString();
    const newList: TaskList = {
      id: uuidv4(),
      name: data.name,
      description: data.description ?? '',
      list_type: data.list_type ?? 'eternal',
      items: [],
      categories: data.categories ?? [],
      linked_habit_ids: data.linked_habit_ids ?? [],
      linked_project_ids: data.linked_project_ids ?? [],
      created_at: now,
      updated_at: now,
      archived: false,
      is_pinned: data.is_pinned ?? false,
      color: data.color,
      icon: data.icon,
      default_sort: data.default_sort,
      completed_at: null,
    };
    await saveList(newList);
    return newList;
  }, [saveList]);

  const updateList = useCallback(async (id: string, data: UpdateListInput): Promise<TaskList> => {
    const existing = lists.find(l => l.id === id);
    if (!existing) {
      throw new Error(`List ${id} not found`);
    }
    const updated: TaskList = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveList(updated);
    return updated;
  }, [lists, saveList]);

  const archiveList = useCallback(async (id: string): Promise<TaskList> => {
    return updateList(id, { archived: true });
  }, [updateList]);

  const unarchiveList = useCallback(async (id: string): Promise<TaskList> => {
    return updateList(id, { archived: false });
  }, [updateList]);

  const completeList = useCallback(async (id: string): Promise<TaskList> => {
    return updateList(id, { completed_at: new Date().toISOString() });
  }, [updateList]);

  const uncompleteList = useCallback(async (id: string): Promise<TaskList> => {
    return updateList(id, { completed_at: null });
  }, [updateList]);

  const pinList = useCallback(async (id: string): Promise<TaskList> => {
    const list = lists.find(l => l.id === id);
    return updateList(id, { is_pinned: !list?.is_pinned });
  }, [lists, updateList]);

  const setListColor = useCallback(async (id: string, color: string | null): Promise<TaskList> => {
    return updateList(id, { color: color ?? undefined });
  }, [updateList]);

  const setListSort = useCallback(async (id: string, sortBy: 'order' | 'rating' | 'price' | 'priority' | 'due_date'): Promise<TaskList> => {
    return updateList(id, { default_sort: sortBy });
  }, [updateList]);

  // Item operations
  const addItem = useCallback(async (listId: string, data: CreateListItemInput): Promise<TaskList> => {
    const existing = lists.find(l => l.id === listId);
    if (!existing) {
      throw new Error(`List ${listId} not found`);
    }

    // If parent_item_id is specified, add as a child item
    if (data.parent_item_id) {
      const addChildRecursive = (items: ListItem[]): ListItem[] => {
        return items.map(item => {
          if (item.id === data.parent_item_id) {
            const newChild = createListItem(data, item.children?.length ?? 0);
            return {
              ...item,
              children: [...(item.children ?? []), newChild],
            };
          }
          if (item.children && item.children.length > 0) {
            return { ...item, children: addChildRecursive(item.children) };
          }
          return item;
        });
      };

      const updated: TaskList = {
        ...existing,
        items: addChildRecursive(existing.items),
        updated_at: new Date().toISOString(),
      };
      await saveList(updated);
      return updated;
    }

    // Otherwise add as a root item
    const newItem = createListItem(data, existing.items.length);
    const updated: TaskList = {
      ...existing,
      items: [...existing.items, newItem],
      updated_at: new Date().toISOString(),
    };
    await saveList(updated);
    return updated;
  }, [lists, saveList]);

  const updateItem = useCallback(async (listId: string, itemId: string, data: UpdateListItemInput): Promise<TaskList> => {
    const existing = lists.find(l => l.id === listId);
    if (!existing) {
      throw new Error(`List ${listId} not found`);
    }

    const updateItemRecursive = (items: ListItem[]): ListItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return { ...item, ...data };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: updateItemRecursive(item.children) };
        }
        return item;
      });
    };

    const updated: TaskList = {
      ...existing,
      items: updateItemRecursive(existing.items),
      updated_at: new Date().toISOString(),
    };
    await saveList(updated);
    return updated;
  }, [lists, saveList]);

  const toggleItem = useCallback(async (listId: string, itemId: string): Promise<TaskList> => {
    const existing = lists.find(l => l.id === listId);
    if (!existing) {
      throw new Error(`List ${listId} not found`);
    }

    const toggleItemRecursive = (items: ListItem[]): ListItem[] => {
      return items.map(item => {
        if (item.id === itemId) {
          return {
            ...item,
            completed_at: item.completed_at ? undefined : new Date().toISOString(),
          };
        }
        if (item.children && item.children.length > 0) {
          return { ...item, children: toggleItemRecursive(item.children) };
        }
        return item;
      });
    };

    const updated: TaskList = {
      ...existing,
      items: toggleItemRecursive(existing.items),
      updated_at: new Date().toISOString(),
    };
    await saveList(updated);
    return updated;
  }, [lists, saveList]);

  const deleteItem = useCallback(async (listId: string, itemId: string): Promise<TaskList> => {
    const existing = lists.find(l => l.id === listId);
    if (!existing) {
      throw new Error(`List ${listId} not found`);
    }

    const deleteItemRecursive = (items: ListItem[]): ListItem[] => {
      return items
        .filter(item => item.id !== itemId)
        .map(item => ({
          ...item,
          children: item.children ? deleteItemRecursive(item.children) : [],
        }));
    };

    const updated: TaskList = {
      ...existing,
      items: deleteItemRecursive(existing.items),
      updated_at: new Date().toISOString(),
    };
    await saveList(updated);
    return updated;
  }, [lists, saveList]);

  // Sort function - pinned first, then by updated_at
  const sortLists = useCallback((listArr: TaskList[]) =>
    [...listArr].sort((a, b) => {
      if (a.is_pinned && !b.is_pinned) return -1;
      if (!a.is_pinned && b.is_pinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    }), []);

  // Filter helpers - now sorted with pinned first
  const eternalLists = useMemo(() => sortLists(lists.filter(l => l.list_type === 'eternal' && !l.archived)), [lists, sortLists]);
  const templateLists = useMemo(() => sortLists(lists.filter(l => l.list_type === 'template' && !l.archived)), [lists, sortLists]);
  const quickLists = useMemo(() => sortLists(lists.filter(l => l.list_type === 'quick' && !l.archived)), [lists, sortLists]);
  const archivedLists = useMemo(() => lists.filter(l => l.archived), [lists]);
  const pinnedLists = useMemo(() => lists.filter(l => l.is_pinned && !l.archived), [lists]);
  const completedLists = useMemo(() => sortLists(lists.filter(l => l.completed_at && !l.archived)), [lists, sortLists]);

  return {
    lists: sortLists(lists.filter(l => !l.archived)),
    eternalLists,
    templateLists,
    quickLists,
    archivedLists,
    pinnedLists,
    completedLists,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    createList,
    updateList,
    deleteList: removeList,
    archiveList,
    unarchiveList,
    completeList,
    uncompleteList,
    pinList,
    setListColor,
    setListSort,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
  };
}

export function useListInstances(listId: string, _includeArchived: boolean = false) {
  const { listInstances, saveListInstance, deleteListInstance: removeInstance, lists } = useApp();

  // Filter instances for this list
  const instances = useMemo(() =>
    listInstances.filter(i => i.list_id === listId),
    [listInstances, listId]);

  const createInstance = useCallback(async (name?: string): Promise<ListInstance> => {
    const list = lists.find(l => l.id === listId);
    const now = new Date().toISOString();
    const newInstance: ListInstance = {
      id: uuidv4(),
      list_id: listId,
      name: name ?? `${list?.name ?? 'List'} - ${new Date().toLocaleDateString()}`,
      item_states: {},
      extra_items: [],
      created_at: now,
    };
    await saveListInstance(newInstance);
    return newInstance;
  }, [listId, lists, saveListInstance]);

  const toggleItem = useCallback(async (instanceId: string, itemId: string): Promise<ListInstance> => {
    const existing = listInstances.find(i => i.id === instanceId);
    if (!existing) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    const updated: ListInstance = {
      ...existing,
      item_states: {
        ...existing.item_states,
        [itemId]: !existing.item_states[itemId],
      },
    };
    await saveListInstance(updated);
    return updated;
  }, [listInstances, saveListInstance]);

  const addItem = useCallback(async (instanceId: string, data: CreateListItemInput): Promise<ListInstance> => {
    const existing = listInstances.find(i => i.id === instanceId);
    if (!existing) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    const newItem = createListItem(data, existing.extra_items.length);
    const updated: ListInstance = {
      ...existing,
      extra_items: [...existing.extra_items, newItem],
    };
    await saveListInstance(updated);
    return updated;
  }, [listInstances, saveListInstance]);

  const completeInstance = useCallback(async (instanceId: string): Promise<ListInstance> => {
    const existing = listInstances.find(i => i.id === instanceId);
    if (!existing) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    const updated: ListInstance = {
      ...existing,
      completed_at: new Date().toISOString(),
    };
    await saveListInstance(updated);
    return updated;
  }, [listInstances, saveListInstance]);

  const archiveInstance = useCallback(async (instanceId: string): Promise<ListInstance> => {
    const existing = listInstances.find(i => i.id === instanceId);
    if (!existing) {
      throw new Error(`Instance ${instanceId} not found`);
    }
    const updated: ListInstance = {
      ...existing,
      archived_at: new Date().toISOString(),
    };
    await saveListInstance(updated);
    return updated;
  }, [listInstances, saveListInstance]);

  // Filter helpers
  const activeInstances = useMemo(() => instances.filter(i => !i.archived_at), [instances]);
  const completedInstances = useMemo(() => instances.filter(i => i.completed_at && !i.archived_at), [instances]);
  const archivedInstances = useMemo(() => instances.filter(i => i.archived_at), [instances]);

  return {
    instances,
    activeInstances,
    completedInstances,
    archivedInstances,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    createInstance,
    toggleItem,
    addItem,
    completeInstance,
    archiveInstance,
    deleteInstance: removeInstance,
  };
}
