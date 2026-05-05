import { useMemo, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/context/AppContext';
import type { Project } from '@trackmind/core';

export interface CreateProjectInput {
  name: string;
  description?: string;
  priority?: number;
  parent_id?: string;
  color?: string;
}

export function useProjects() {
  const { projects, saveProject, deleteProject: removeProject } = useApp();

  const createProject = useCallback(async (data: CreateProjectInput): Promise<Project> => {
    const now = new Date().toISOString();
    const newProject: Project = {
      id: uuidv4(),
      name: data.name,
      description: data.description ?? '',
      priority: data.priority ?? 5,
      status: 'active',
      tags: [],
      parent_id: data.parent_id,
      created_at: now,
      updated_at: now,
    };
    await saveProject(newProject);
    return newProject;
  }, [saveProject]);

  const updateProject = useCallback(async (id: string, data: Partial<Project>): Promise<Project> => {
    const existing = projects.find(p => p.id === id);
    if (!existing) {
      throw new Error(`Project ${id} not found`);
    }
    const updated: Project = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };
    await saveProject(updated);
    return updated;
  }, [projects, saveProject]);

  // Helper: Check if a parent project is paused (recursive check up the tree)
  const isParentPaused = useCallback((projectId: string): boolean => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !project.parent_id) return false;

    const parent = projects.find(p => p.id === project.parent_id);
    if (!parent) return false;

    if (parent.status === 'paused') return true;
    return isParentPaused(parent.id);
  }, [projects]);

  // Helper: Check if a project is effectively paused (directly or through parent)
  const isEffectivelyPaused = useCallback((projectId: string): boolean => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return false;
    if (project.status === 'paused') return true;
    return isParentPaused(projectId);
  }, [projects, isParentPaused]);

  // Helper: Get all descendant project IDs
  const getDescendantIds = useCallback((projectId: string): string[] => {
    const descendants: string[] = [];
    const addChildren = (parentId: string) => {
      for (const p of projects) {
        if (p.parent_id === parentId) {
          descendants.push(p.id);
          addChildren(p.id);
        }
      }
    };
    addChildren(projectId);
    return descendants;
  }, [projects]);

  // Helper: Get direct children of a project
  const getChildProjects = useCallback((projectId: string): Project[] => {
    return projects.filter(p => p.parent_id === projectId);
  }, [projects]);

  // Unpause all sub-projects of a given project
  const unpauseAllSubprojects = useCallback(async (parentProjectId: string): Promise<void> => {
    const descendantIds = getDescendantIds(parentProjectId);
    const pausedDescendants = projects.filter(
      p => descendantIds.includes(p.id) && p.status === 'paused'
    );

    // Unpause all paused descendants
    for (const project of pausedDescendants) {
      await saveProject({
        ...project,
        status: 'active',
        updated_at: new Date().toISOString(),
      });
    }
  }, [projects, getDescendantIds, saveProject]);

  // Delete project with cascade delete of sub-projects
  const deleteProjectWithCascade = useCallback(async (projectId: string): Promise<void> => {
    const descendantIds = getDescendantIds(projectId);

    // Delete all descendants first (children, grandchildren, etc.)
    for (const id of descendantIds.reverse()) {
      await removeProject(id);
    }

    // Then delete the project itself
    await removeProject(projectId);
  }, [getDescendantIds, removeProject]);

  // Filter helpers
  const activeProjects = useMemo(() => projects.filter(p => p.status === 'active'), [projects]);
  const completedProjects = useMemo(() => projects.filter(p => p.status === 'completed'), [projects]);
  const pausedProjects = useMemo(() => projects.filter(p => p.status === 'paused'), [projects]);

  // Top-level projects (no parent)
  const topLevelProjects = useMemo(() => projects.filter(p => !p.parent_id), [projects]);

  return {
    projects,
    activeProjects,
    completedProjects,
    pausedProjects,
    topLevelProjects,
    loading: false,
    error: null,
    refetch: () => Promise.resolve(),
    createProject,
    updateProject,
    deleteProject: deleteProjectWithCascade,  // Use cascade delete by default
    deleteProjectSingle: removeProject,  // For deleting a single project without cascade
    // Pause inheritance helpers
    isParentPaused,
    isEffectivelyPaused,
    getDescendantIds,
    getChildProjects,
    unpauseAllSubprojects,
  };
}
