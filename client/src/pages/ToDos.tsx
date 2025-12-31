import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon, MoreVertical, Settings, Camera, Upload, CalendarIcon, Calendar as CalendarIconOutline, User, Home, Filter, Flag, ListTodo, CheckCircle, Clock, FolderOpen, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { FullScreenCalendar } from "@/components/FullScreenCalendar";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, isPast, isThisWeek, startOfDay, isSameDay } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { getApiUrl } from "@/lib/apiUrl";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/lib/nativeHaptics";
import type { ToDo, Project, Subtask } from "@shared/schema";
import { ToDosFilterSheet } from "@/components/ToDosFilterSheet";
import { Trash2, ListChecks } from "lucide-react";
import { InlineMonthCalendar } from "@/components/InlineMonthCalendar";
import { InlineWeekCalendar } from "@/components/InlineWeekCalendar";
import { InlineDayHeader } from "@/components/InlineDayHeader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  projectId: z.string().optional(),
  assignedTo: z.string().optional(),
  dueDate: z.string().optional(),
  photoId: z.string().optional(),
});

type CreateTodoForm = z.infer<typeof createTodoSchema>;

type TodoWithDetails = ToDo & {
  project?: { id: string; name: string };
  photo?: { id: string; url: string };
  assignee?: { id: string; firstName: string | null; lastName: string | null };
  creator: { id: string; firstName: string | null; lastName: string | null };
};

type SmartList = 'today' | 'flagged' | 'assigned-to-me' | 'all' | 'completed';
type ViewMode = 'month' | 'week' | 'day' | 'list';

export default function ToDos() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Read selected list and view mode from URL query params
  const getSelectedList = (): SmartList => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('list') || 'assigned-to-me') as SmartList;
  };
  
  const getViewMode = (): ViewMode => {
    const params = new URLSearchParams(window.location.search);
    return (params.get('view') || 'week') as ViewMode;
  };
  
  const [selectedList, setSelectedList] = useState<SmartList>(getSelectedList());
  const [viewMode, setViewMode] = useState<ViewMode>(getViewMode());
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  
  // Listen for filter changes from AppSidebar and browser history navigation
  useEffect(() => {
    const handleFilterChange = () => {
      setSelectedList(getSelectedList());
      setViewMode(getViewMode());
    };
    
    // Listen for custom filterChange event from AppSidebar
    window.addEventListener('filterChange', handleFilterChange);
    // Listen for browser back/forward navigation
    window.addEventListener('popstate', handleFilterChange);
    
    return () => {
      window.removeEventListener('filterChange', handleFilterChange);
      window.removeEventListener('popstate', handleFilterChange);
    };
  }, []);
  
  // Auto-set dateFilter to today when entering day view without a date
  useEffect(() => {
    if (viewMode === 'day' && !dateFilter) {
      setDateFilter(new Date());
    }
  }, [viewMode, dateFilter]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedTodoForDetails, setSelectedTodoForDetails] = useState<TodoWithDetails | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showFullScreenCalendar, setShowFullScreenCalendar] = useState(false);
  const [showTodoDueDatePicker, setShowTodoDueDatePicker] = useState(false);
  const [animatingTasks, setAnimatingTasks] = useState<Set<string>>(new Set());
  const [completingTasks, setCompletingTasks] = useState<Set<string>>(new Set());
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle photo attachment from camera
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    
    if (photoId) {
      const savedFormData = localStorage.getItem('todo-form-draft');
      
      fetch(getApiUrl(`/api/photos/${photoId}`))
        .then(res => {
          if (!res.ok) throw new Error('Photo not found');
          return res.json();
        })
        .then(photo => {
          setSelectedPhotoId(photoId);
          setSelectedPhotoUrl(getApiUrl(photo.url));
          
          if (savedFormData) {
            const formData = JSON.parse(savedFormData);
            form.reset({
              title: formData.title || '',
              description: formData.description || '',
              projectId: formData.projectId || '',
              assignedTo: formData.assignedTo || '',
              dueDate: formData.dueDate || '',
            });
            localStorage.removeItem('todo-form-draft');
            toast({ title: "Photo attached!" });
          } else {
            form.reset({
              title: "",
              description: "",
              projectId: photo.projectId || "",
              assignedTo: "",
              dueDate: "",
            });
            toast({ title: "Create a task for this photo" });
          }
          
          setShowAddDialog(true);
        })
        .catch(err => {
          console.error('Failed to fetch photo:', err);
          toast({ 
            title: "Failed to attach photo", 
            description: "Photo may still be uploading",
            variant: "destructive" 
          });
        });
      
      window.history.replaceState({}, '', '/todos');
    }
  }, [location]);

  // Fetch all todos (for accurate badge counts)
  const { data: allTodos = [], isLoading } = useQuery<TodoWithDetails[]>({
    queryKey: ['/api/todos'],
    queryFn: async () => {
      const response = await fetch('/api/todos');
      if (!response.ok) {
        throw new Error(`Failed to fetch todos: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Filter todos based on selected smart list
  // IMPORTANT: Keep todos that are animating (in animatingTasks or completingTasks) so animations
  // can play before they're removed from the DOM
  const filteredTodos = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Helper to check if task is in any animation phase
    const isAnimating = (todoId: string) => animatingTasks.has(todoId) || completingTasks.has(todoId);

    let todos: TodoWithDetails[] = [];
    
    switch (selectedList) {
      case 'today':
        todos = allTodos.filter(todo => {
          // Keep animating todos in the list so animation can play
          if (isAnimating(todo.id)) return true;
          if (todo.completed || !todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate < tomorrow;
        });
        break;
      case 'flagged':
        todos = allTodos.filter(todo => isAnimating(todo.id) || todo.flag);
        break;
      case 'assigned-to-me':
        todos = allTodos.filter(todo => isAnimating(todo.id) || (todo.assignedTo === user?.id && !todo.completed));
        break;
      case 'all':
        todos = allTodos.filter(todo => isAnimating(todo.id) || !todo.completed);
        break;
      case 'completed':
        todos = allTodos.filter(todo => todo.completed);
        break;
      default:
        todos = allTodos;
    }
    
    // Apply date filter if set
    if (dateFilter) {
      const filterDate = startOfDay(dateFilter);
      todos = todos.filter(todo => {
        // Keep animating todos even if they don't match date filter
        if (isAnimating(todo.id)) return true;
        if (!todo.dueDate) return false;
        const dueDate = startOfDay(new Date(todo.dueDate));
        return isSameDay(dueDate, filterDate);
      });
    }
    
    return todos;
  }, [allTodos, selectedList, user?.id, dateFilter, animatingTasks, completingTasks]);

  // Calculate badge counts for all smart lists (from full dataset)
  const smartListCounts = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      today: allTodos.filter(todo => {
        if (todo.completed || !todo.dueDate) return false;
        const dueDate = new Date(todo.dueDate);
        return dueDate >= now && dueDate < tomorrow;
      }).length,
      flagged: allTodos.filter(todo => todo.flag).length,
      assignedToMe: allTodos.filter(todo => todo.assignedTo === user?.id && !todo.completed).length,
      all: allTodos.filter(todo => !todo.completed).length,
      completed: allTodos.filter(todo => todo.completed).length,
    };
  }, [allTodos, user?.id]);

  // Calculate task counts by date for calendar
  const taskCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    
    allTodos.forEach(todo => {
      if (!todo.dueDate) return;
      const dueDate = startOfDay(new Date(todo.dueDate));
      const dateKey = format(dueDate, 'yyyy-MM-dd');
      counts.set(dateKey, (counts.get(dateKey) || 0) + 1);
    });
    
    return counts;
  }, [allTodos]);

  // Group todos by urgency (for non-completed views)
  const groupedTodos = useMemo(() => {
    if (selectedList === 'completed') {
      return {
        completed: filteredTodos,
        overdue: [],
        today: [],
        thisWeek: [],
        later: [],
        noDueDate: [],
      };
    }

    const now = startOfDay(new Date());
    const groups = {
      overdue: [] as TodoWithDetails[],
      today: [] as TodoWithDetails[],
      thisWeek: [] as TodoWithDetails[],
      later: [] as TodoWithDetails[],
      noDueDate: [] as TodoWithDetails[],
      completed: [] as TodoWithDetails[],
    };

    filteredTodos.forEach((todo) => {
      if (!todo.dueDate) {
        groups.noDueDate.push(todo);
      } else {
        const dueDate = startOfDay(new Date(todo.dueDate));
        
        if (isPast(dueDate) && !isSameDay(dueDate, now) && !todo.completed) {
          groups.overdue.push(todo);
        } else if (isToday(dueDate)) {
          groups.today.push(todo);
        } else if (isThisWeek(dueDate, { weekStartsOn: 0 })) {
          groups.thisWeek.push(todo);
        } else {
          groups.later.push(todo);
        }
      }
    });

    return groups;
  }, [filteredTodos, selectedList]);

  // Group todos by project for list view
  const groupedByProject = useMemo(() => {
    const groups: Record<string, { projectName: string; todos: TodoWithDetails[] }> = {};
    
    filteredTodos.forEach((todo) => {
      const projectId = todo.project?.id || 'no-project';
      const projectName = todo.project?.name || 'No Project';
      
      if (!groups[projectId]) {
        groups[projectId] = { projectName, todos: [] };
      }
      groups[projectId].todos.push(todo);
    });
    
    // Sort groups: projects with tasks first, then alphabetically, "No Project" last
    const sortedEntries = Object.entries(groups).sort((a, b) => {
      if (a[0] === 'no-project') return 1;
      if (b[0] === 'no-project') return -1;
      return a[1].projectName.localeCompare(b[1].projectName);
    });
    
    return sortedEntries;
  }, [filteredTodos]);

  // Track expanded/collapsed state for list view project sections
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Memoize project IDs string for dependency tracking
  const projectIdsKey = useMemo(() => 
    groupedByProject.map(([id]) => id).join('|'),
    [groupedByProject]
  );

  // Reset and expand all project sections when entering list view or when project set changes
  useEffect(() => {
    if (viewMode === 'list') {
      const allProjectIds = groupedByProject.map(([id]) => id);
      setExpandedProjects(new Set(allProjectIds));
    }
  }, [viewMode, projectIdsKey]);

  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjects(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch company members for assignment
  const { data: members = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null }>>({
    queryKey: ['/api/companies/members'],
  });

  // Complete todo mutation with green checkmark + slide-out animation
  const completeMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('POST', `/api/todos/${todoId}/complete`, {});
    },
    onMutate: async (todoId: string) => {
      // Phase 1: Start green checkmark animation (mark as completing)
      setCompletingTasks(prev => new Set(prev).add(todoId));
      
      await queryClient.cancelQueries({ queryKey: ['/api/todos'] });
      
      const previousQueries: Array<{ queryKey: any; data: TodoWithDetails[] }> = [];
      queryClient.getQueryCache().findAll({ queryKey: ['/api/todos'] }).forEach((query) => {
        const data = query.state.data as TodoWithDetails[] | undefined;
        if (data) {
          previousQueries.push({ queryKey: query.queryKey, data });
        }
      });
      
      queryClient.setQueriesData<TodoWithDetails[]>(
        { queryKey: ['/api/todos'] },
        (old) => {
          if (!old) return old;
          return old.map(todo => 
            todo.id === todoId 
              ? { ...todo, completed: true, completedAt: new Date() }
              : todo
          );
        }
      );
      
      return { previousQueries };
    },
    onSuccess: (_, todoId) => {
      haptics.success();
      toast({ title: "Task completed!" });
      
      // Phase 2: After green checkmark shows (400ms), start slide-out animation
      setTimeout(() => {
        setAnimatingTasks(prev => new Set(prev).add(todoId));
        
        // Phase 3: After slide-out animation (500ms), clean up and refresh
        setTimeout(() => {
          setCompletingTasks(prev => {
            const next = new Set(prev);
            next.delete(todoId);
            return next;
          });
          setAnimatingTasks(prev => {
            const next = new Set(prev);
            next.delete(todoId);
            return next;
          });
          queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
        }, 500);
      }, 400);
    },
    onError: (error, todoId, context) => {
      haptics.error();
      // Clear all animation states on error
      setCompletingTasks(prev => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
      setAnimatingTasks(prev => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  // Toggle flag mutation
  const toggleFlagMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('POST', `/api/todos/${todoId}/flag`, {});
    },
    onMutate: async (todoId: string) => {
      await queryClient.cancelQueries({ queryKey: ['/api/todos'] });
      
      const previousQueries: Array<{ queryKey: any; data: TodoWithDetails[] }> = [];
      queryClient.getQueryCache().findAll({ queryKey: ['/api/todos'] }).forEach((query) => {
        const data = query.state.data as TodoWithDetails[] | undefined;
        if (data) {
          previousQueries.push({ queryKey: query.queryKey, data });
        }
      });
      
      queryClient.setQueriesData<TodoWithDetails[]>(
        { queryKey: ['/api/todos'] },
        (old) => {
          if (!old) return old;
          return old.map(todo => 
            todo.id === todoId 
              ? { ...todo, flag: !todo.flag }
              : todo
          );
        }
      );
      
      return { previousQueries };
    },
    onSuccess: () => {
      haptics.light();
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
    },
    onError: (error, variables, context) => {
      haptics.error();
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to toggle flag", variant: "destructive" });
    },
  });

  // Delete todo mutation with slide-out animation
  const deleteMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('DELETE', `/api/todos/${todoId}`, {});
    },
    onMutate: async (todoId: string) => {
      // Cancel any in-flight queries
      await queryClient.cancelQueries({ queryKey: ['/api/todos'] });
      
      // Save previous state for rollback
      const previousTodos = queryClient.getQueryData<TodoWithDetails[]>(['/api/todos']);
      
      // Start slide-out animation
      setAnimatingTasks(prev => new Set(prev).add(todoId));
      
      return { previousTodos };
    },
    onSuccess: (_, todoId) => {
      haptics.warning();
      toast({ title: "Task deleted" });
      setShowDetailsDrawer(false);
      // Wait for animation to complete before updating cache
      setTimeout(() => {
        // Optimistically remove from cache BEFORE clearing animation flag
        queryClient.setQueriesData<TodoWithDetails[]>(
          { queryKey: ['/api/todos'] },
          (old) => old ? old.filter(todo => todo.id !== todoId) : old
        );
        // Then clear animation flag
        setAnimatingTasks(prev => {
          const next = new Set(prev);
          next.delete(todoId);
          return next;
        });
        // Finally invalidate to sync with server
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 500);
    },
    onError: (_, todoId, context) => {
      haptics.error();
      // Clear animation state on error
      setAnimatingTasks(prev => {
        const next = new Set(prev);
        next.delete(todoId);
        return next;
      });
      // Restore previous state if we have it
      if (context?.previousTodos) {
        queryClient.setQueryData(['/api/todos'], context.previousTodos);
      }
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  // Create todo mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTodoForm) => {
      return apiRequest('POST', '/api/todos', data);
    },
    onSuccess: () => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task created!" });
      setShowAddDialog(false);
      form.reset();
      setSelectedPhotoId(null);
      setSelectedPhotoUrl(null);
    },
    onError: () => {
      haptics.error();
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  // Update todo mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data, silent }: { id: string; data: Partial<CreateTodoForm>; silent?: boolean }) => {
      return apiRequest('PATCH', `/api/todos/${id}`, data);
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      if (!variables.silent) {
        haptics.light();
        toast({ title: "Task updated!" });
        setShowEditDialog(false);
        setEditingTodo(null);
        form.reset();
        setSelectedPhotoId(null);
        setSelectedPhotoUrl(null);
      }
    },
    onError: () => {
      haptics.error();
      toast({ title: "Failed to update task", variant: "destructive" });
    },
  });

  // Subtasks query - fetch when a todo is selected for details
  // Uses default fetcher which builds URL from queryKey segments: ['/api/todos', id, 'subtasks'] -> /api/todos/{id}/subtasks
  const todoIdForSubtasks = selectedTodoForDetails?.id;
  const { data: subtasks = [], isLoading: subtasksLoading } = useQuery<Subtask[]>({
    queryKey: todoIdForSubtasks ? ['/api/todos', todoIdForSubtasks, 'subtasks'] : ['subtasks-disabled'],
    enabled: !!todoIdForSubtasks,
  });

  // Create subtask mutation
  const createSubtaskMutation = useMutation({
    mutationFn: async ({ todoId, title }: { todoId: string; title: string }) => {
      return apiRequest('POST', `/api/todos/${todoId}/subtasks`, { title });
    },
    onSuccess: (_, variables) => {
      haptics.light();
      queryClient.invalidateQueries({ queryKey: ['/api/todos', variables.todoId, 'subtasks'] });
      setNewSubtaskTitle('');
    },
    onError: () => {
      haptics.error();
      toast({ title: "Failed to add subtask", variant: "destructive" });
    },
  });

  // Complete subtask mutation
  const completeSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      return apiRequest('POST', `/api/subtasks/${subtaskId}/complete`, {});
    },
    onSuccess: () => {
      haptics.light();
      if (todoIdForSubtasks) {
        queryClient.invalidateQueries({ queryKey: ['/api/todos', todoIdForSubtasks, 'subtasks'] });
      }
    },
    onError: () => {
      haptics.error();
      toast({ title: "Failed to update subtask", variant: "destructive" });
    },
  });

  // Delete subtask mutation
  const deleteSubtaskMutation = useMutation({
    mutationFn: async (subtaskId: string) => {
      return apiRequest('DELETE', `/api/subtasks/${subtaskId}`, {});
    },
    onSuccess: () => {
      haptics.warning();
      if (todoIdForSubtasks) {
        queryClient.invalidateQueries({ queryKey: ['/api/todos', todoIdForSubtasks, 'subtasks'] });
      }
    },
    onError: () => {
      haptics.error();
      toast({ title: "Failed to delete subtask", variant: "destructive" });
    },
  });

  // Photo upload mutation
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({ file, projectId }: { file: File; projectId?: string }) => {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('caption', file.name);
      
      const endpoint = projectId 
        ? `/api/projects/${projectId}/photos`
        : '/api/photos/standalone';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(errorData.message || `Upload failed: ${res.statusText}`);
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      setSelectedPhotoId(data.id);
      setSelectedPhotoUrl(data.url);
      toast({ title: "Photo attached!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Photo upload failed", 
        description: error.message || 'Failed to upload photo',
        variant: "destructive" 
      });
    },
  });

  const form = useForm<CreateTodoForm>({
    resolver: zodResolver(createTodoSchema),
    defaultValues: {
      title: "",
      projectId: "none",
      assignedTo: "unassigned",
      dueDate: "",
    },
  });

  const handleSubmit = (data: CreateTodoForm) => {
    const payload: any = {
      title: data.title,
    };
    
    if (data.description) payload.description = data.description;
    if (data.projectId && data.projectId !== 'none') payload.projectId = data.projectId;
    if (data.dueDate) payload.dueDate = data.dueDate;
    if (selectedPhotoId) payload.photoId = selectedPhotoId;
    
    // For edits, always include assignedTo so backend can detect changes (Integration Task 3)
    // For creates, only include if not 'unassigned'
    if (editingTodo) {
      payload.assignedTo = data.assignedTo !== 'unassigned' ? data.assignedTo : null;
    } else {
      if (data.assignedTo && data.assignedTo !== 'unassigned') {
        payload.assignedTo = data.assignedTo;
      }
    }
    
    if (editingTodo) {
      updateMutation.mutate({ id: editingTodo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const projectId = form.watch('projectId');
      uploadPhotoMutation.mutate({ file, projectId });
    }
  };

  const handleCameraClick = () => {
    const formData = {
      title: form.watch('title'),
      description: form.watch('description'),
      projectId: form.watch('projectId'),
      assignedTo: form.watch('assignedTo'),
      dueDate: form.watch('dueDate'),
    };
    localStorage.setItem('todo-form-draft', JSON.stringify(formData));
    
    const projectId = form.watch('projectId');
    setLocation(`/camera?projectId=${projectId || ''}&mode=task-photo`);
  };

  const handleEditTodo = (todo: TodoWithDetails) => {
    setEditingTodo(todo);
    form.reset({
      title: todo.title,
      description: todo.description || "",
      projectId: todo.projectId || "none",
      assignedTo: todo.assignedTo || "unassigned",
      dueDate: todo.dueDate ? (typeof todo.dueDate === 'string' ? todo.dueDate : todo.dueDate.toISOString().split('T')[0]) : "",
    });
    if (todo.photo) {
      setSelectedPhotoId(todo.photoId || null);
      setSelectedPhotoUrl(getApiUrl(todo.photo.url));
    }
    setShowEditDialog(true);
  };

  const getDisplayName = (user: { firstName: string | null; lastName: string | null }) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return 'Unknown';
  };

  // Swipe gesture state - iOS-style with refs for synchronous updates
  const [swipedTodo, setSwipedTodo] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState<number>(0);
  const restingOffsetRef = useRef<number>(0); // Synchronous resting position
  const currentOffsetRef = useRef<number>(0); // Synchronous current position
  const touchStartX = useRef<number>(0);
  const isSwiping = useRef<boolean>(false);

  const handleTouchStart = (e: React.TouchEvent, todoId: string) => {
    touchStartX.current = e.touches[0].clientX;
    isSwiping.current = false;
    
    // Close other cards when starting a new swipe (immediate via refs)
    if (swipedTodo && swipedTodo !== todoId) {
      setSwipedTodo(null);
      setSwipeOffset(0);
      currentOffsetRef.current = 0;
      restingOffsetRef.current = 0;
    }
    
    // Remember current resting position synchronously
    if (swipedTodo === todoId) {
      restingOffsetRef.current = currentOffsetRef.current;
    } else {
      restingOffsetRef.current = 0;
      currentOffsetRef.current = 0;
    }
  };

  const handleTouchMove = (e: React.TouchEvent, todoId: string) => {
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartX.current;
    
    // Only activate swipe if moving more than 5px
    if (Math.abs(diff) > 5) {
      isSwiping.current = true;
      setSwipedTodo(todoId);
      
      // Calculate offset from resting position (synchronous)
      const newOffset = restingOffsetRef.current + diff;
      
      // Clamp: max 150px left, 120px right (increased to allow completion threshold)
      const maxLeft = -150;
      const maxRight = 120;
      const clampedOffset = Math.max(maxLeft, Math.min(maxRight, newOffset));
      
      currentOffsetRef.current = clampedOffset;
      setSwipeOffset(clampedOffset);
    }
  };

  const handleTouchEnd = (todo: TodoWithDetails) => {
    const completeThreshold = 100; // Swipe right threshold (increased for slower trigger)
    const deleteThreshold = -130; // Swipe far left for delete (increased for slower trigger)
    const revealThreshold = -70; // Swipe left for actions (increased for slower trigger)
    
    // Swipe right - complete task immediately
    if (currentOffsetRef.current > completeThreshold && !todo.completed) {
      haptics.success(); // Success haptic for completion
      completeMutation.mutate(todo.id);
      setSwipedTodo(null);
      setSwipeOffset(0);
      currentOffsetRef.current = 0;
      restingOffsetRef.current = 0;
    } 
    // Swipe far left - delete immediately
    else if (currentOffsetRef.current < deleteThreshold) {
      haptics.warning(); // Warning haptic for destructive action
      deleteMutation.mutate(todo.id);
      setSwipedTodo(null);
      setSwipeOffset(0);
      currentOffsetRef.current = 0;
      restingOffsetRef.current = 0;
    }
    // Swipe left (moderate) - reveal action buttons
    else if (currentOffsetRef.current < revealThreshold) {
      haptics.light(); // Light haptic for revealing actions
      currentOffsetRef.current = -150;
      restingOffsetRef.current = -150;
      setSwipeOffset(-150);
    } 
    // Not enough swipe - reset to closed
    else {
      setSwipedTodo(null);
      setSwipeOffset(0);
      currentOffsetRef.current = 0;
      restingOffsetRef.current = 0;
    }
    
    isSwiping.current = false;
  };

  const handleSwipeAction = (action: () => void) => {
    action();
    // Reset swipe state after action
    setSwipedTodo(null);
    setSwipeOffset(0);
    currentOffsetRef.current = 0;
    restingOffsetRef.current = 0;
  };

  // Render task card - Apple-inspired design with larger thumbnails and better visual hierarchy
  const renderTaskCard = (todo: TodoWithDetails) => {
    const isThisTodoSwiped = swipedTodo === todo.id;
    const currentOffset = isThisTodoSwiped ? swipeOffset : 0;
    const isAnimating = animatingTasks.has(todo.id);

    // Due date info for display
    const getDueDateInfo = () => {
      if (!todo.dueDate) return null;
      const date = new Date(todo.dueDate);
      const now = startOfDay(new Date());
      const due = startOfDay(date);
      
      if (todo.completed) {
        return { color: 'text-muted-foreground', label: format(date, 'MMM d') };
      }
      if (isPast(due) && !isSameDay(due, now)) {
        return { color: 'text-destructive', label: 'Overdue' };
      }
      if (isToday(due)) {
        return { color: 'text-orange-500', label: 'Today' };
      }
      return { color: 'text-muted-foreground', label: format(date, 'MMM d') };
    };

    const dueDateInfo = getDueDateInfo();

    return (
      <div 
        className={`transition-all duration-500 ease-out ${isAnimating ? 'max-h-0 opacity-0 mb-0 overflow-hidden' : 'max-h-96 opacity-100 mb-2'}`}
        key={todo.id}
      >
      <div className="relative overflow-hidden rounded-xl">
        {/* Swipe action backgrounds with dynamic visual feedback */}
        {/* Right swipe - complete action (green) */}
        <div className="absolute inset-0 bg-green-500 flex items-center justify-start px-4 rounded-xl overflow-hidden">
          <div className="flex items-center gap-2">
            <Check className="w-6 h-6 text-white" />
            <span className="text-white font-medium">Complete</span>
          </div>
        </div>
        
        {/* Left swipe - delete action (red shows when swiped far, gray for reveal) */}
        <div className={`absolute inset-0 flex items-center justify-end px-4 transition-colors rounded-xl overflow-hidden ${
          currentOffset < -100 ? 'bg-red-500' : 'bg-muted'
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-medium ${currentOffset < -100 ? 'text-white' : 'text-foreground'}`}>
              {currentOffset < -100 ? 'Delete' : 'Actions'}
            </span>
            <X className={`w-6 h-6 ${currentOffset < -100 ? 'text-white' : 'text-foreground'}`} />
          </div>
        </div>
        
        {/* Swipe action buttons - left (flag + delete) - shown when moderately swiped */}
        <div className="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12 bg-blue-500 hover:bg-blue-600 text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipeAction(() => toggleFlagMutation.mutate(todo.id));
            }}
            data-testid={`swipe-flag-${todo.id}`}
          >
            <Flag className="w-5 h-5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-12 w-12 bg-red-500 hover:bg-red-600 text-white"
            onClick={(e) => {
              e.stopPropagation();
              handleSwipeAction(() => deleteMutation.mutate(todo.id));
            }}
            data-testid={`swipe-delete-${todo.id}`}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <Card
          className={`relative cursor-pointer overflow-hidden ${todo.completed ? 'opacity-60' : ''} p-3 ${!isSwiping.current ? 'transition-all duration-200 ease-out' : ''} ${currentOffset > 0 ? 'bg-transparent' : ''} ${animatingTasks.has(todo.id) ? 'translate-x-full opacity-0 scale-95' : ''}`}
          style={{ transform: animatingTasks.has(todo.id) ? undefined : `translateX(${currentOffset}px)` }}
          onClick={() => { 
            if (!isSwiping.current) {
              setSelectedTodoForDetails(todo); 
              setShowDetailsDrawer(true); 
            }
          }}
          onTouchStart={(e) => handleTouchStart(e, todo.id)}
          onTouchMove={(e) => handleTouchMove(e, todo.id)}
          onTouchEnd={() => handleTouchEnd(todo)}
          data-testid={`card-todo-${todo.id}`}
        >
        <div className="flex gap-3">
          {/* Left side - Animated Checkbox */}
          <div className="flex-shrink-0 pt-0.5">
            {completingTasks.has(todo.id) ? (
              <div 
                className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center animate-in zoom-in-50 duration-200"
                data-testid={`checkbox-completing-${todo.id}`}
              >
                <Check className="h-4 w-4 text-white animate-in zoom-in-0 duration-300" strokeWidth={3} />
              </div>
            ) : (
              <Checkbox
                checked={todo.completed}
                onCheckedChange={(checked) => {
                  if (!checked && todo.completed) {
                    toast({ title: "Cannot uncomplete tasks", variant: "destructive" });
                  } else if (checked && !todo.completed) {
                    completeMutation.mutate(todo.id);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5"
                data-testid={`checkbox-todo-complete-${todo.id}`}
              />
            )}
          </div>

          {/* Photo thumbnail - larger, more prominent */}
          {todo.photo && (
            <div
              className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted shadow-sm"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/photo/${todo.photoId}/view`);
              }}
              data-testid={`img-todo-photo-${todo.id}`}
            >
              <img
                src={getApiUrl(todo.photo.url)}
                alt="Task photo"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Main content area */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Project label - above title */}
            {todo.project && (
              <span 
                className="text-[10px] font-medium text-primary uppercase tracking-wide mb-0.5"
                data-testid={`text-project-${todo.id}`}
              >
                {todo.project.name}
              </span>
            )}

            {/* Title */}
            <h3
              className={`font-semibold text-sm leading-tight ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
              data-testid={`text-todo-title-${todo.id}`}
            >
              {todo.title}
            </h3>
            
            {/* Metadata row - always show if any content exists */}
            {(dueDateInfo || todo.assignee) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {/* Due date */}
                {dueDateInfo && (
                  <span className={`text-[11px] font-medium flex items-center gap-1 ${dueDateInfo.color}`} data-testid={`text-due-${todo.id}`}>
                    <Clock className="w-3 h-3" />
                    {dueDateInfo.label}
                  </span>
                )}
                
                {/* Assignee */}
                {todo.assignee && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1" data-testid={`text-assignee-${todo.id}`}>
                    <User className="w-3 h-3" />
                    {getDisplayName(todo.assignee)}
                  </span>
                )}
              </div>
            )}

            {/* Description preview */}
            {todo.description && (
              <p 
                className="text-xs text-muted-foreground mt-1 line-clamp-2"
                data-testid={`text-description-preview-${todo.id}`}
              >
                {todo.description}
              </p>
            )}
          </div>

          {/* Right side - Flag & Actions */}
          <div className="flex-shrink-0 flex items-start gap-1">
            {/* Flag indicator - always visible when flagged */}
            {todo.flag && (
              <div className="pt-1">
                <Flag className="w-4 h-4 text-orange-500 fill-orange-500" data-testid={`icon-flag-${todo.id}`} />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  data-testid={`button-todo-menu-${todo.id}`}
                >
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); toggleFlagMutation.mutate(todo.id); }}
                  disabled={toggleFlagMutation.isPending}
                  data-testid={`menu-flag-todo-${todo.id}`}
                >
                  <Flag className="w-4 h-4 mr-2" />
                  {todo.flag ? 'Unflag' : 'Flag'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); handleEditTodo(todo); }}
                  data-testid={`menu-edit-todo-${todo.id}`}
                >
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(todo.id); }}
                  disabled={deleteMutation.isPending}
                  className="text-destructive"
                  data-testid={`menu-delete-todo-${todo.id}`}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </Card>
      </div>
      </div>
    );
  };

  // Render section
  const renderSection = (title: string, todos: TodoWithDetails[], testId: string) => {
    if (todos.length === 0) return null;
    
    return (
      <div className="space-y-2" data-testid={testId}>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
          {title} ({todos.length})
        </h2>
        <div className="space-y-1.5">
          {todos.map(renderTaskCard)}
        </div>
      </div>
    );
  };

  // Render list view with collapsible project sections
  const renderListView = () => {
    if (groupedByProject.length === 0) {
      return (
        <div className="text-center py-12">
          <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground" data-testid="text-no-projects-list">
            No tasks found
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-3" data-testid="list-view-container">
        {groupedByProject.map(([projectId, { projectName, todos }]) => {
          const isExpanded = expandedProjects.has(projectId);
          const completedCount = todos.filter(t => t.completed).length;
          
          return (
            <Collapsible
              key={projectId}
              open={isExpanded}
              onOpenChange={() => toggleProjectExpanded(projectId)}
              data-testid={`collapsible-project-${projectId}`}
            >
              <CollapsibleTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/30 hover:bg-muted/50 active:bg-muted rounded-lg transition-colors"
                  data-testid={`button-toggle-project-${projectId}`}
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                  <span className="font-medium text-sm flex-1 text-left truncate">
                    {projectName}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {completedCount > 0 ? `${completedCount}/${todos.length}` : todos.length}
                  </Badge>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2 pl-2">
                <div className="space-y-1.5">
                  {todos.map(renderTaskCard)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    );
  };

  // Smart list labels for display
  const smartListLabels: Record<SmartList, string> = {
    'today': 'Today',
    'flagged': 'Flagged',
    'assigned-to-me': 'Assigned to Me',
    'all': 'All',
    'completed': 'Completed',
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between p-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-xl font-semibold truncate" data-testid="text-list-title">
            {smartListLabels[selectedList]}
          </h1>
          <span className="text-muted-foreground text-sm whitespace-nowrap" data-testid="text-task-count">
            · {filteredTodos.length} {filteredTodos.length === 1 ? 'task' : 'tasks'} scheduled
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowFilterSheet(true)}
            data-testid="button-todo-filters"
          >
            <SlidersHorizontal className="w-5 h-5" />
          </Button>
          <Button
            variant={dateFilter ? "default" : "ghost"}
            size="sm"
            onClick={() => setShowFullScreenCalendar(true)}
            className="gap-1"
            data-testid="button-date-filter"
          >
            <CalendarIconOutline className="w-4 h-4" />
            {dateFilter && (
              <span className="text-xs">{format(dateFilter, 'MMM d')}</span>
            )}
          </Button>
          <Button
            onClick={() => setShowAddDialog(true)}
            size="icon"
            data-testid="button-add-todo"
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 pb-20">
            {/* Month View Calendar */}
            {viewMode === 'month' && (
              <InlineMonthCalendar
                selectedDate={dateFilter}
                taskCountByDate={taskCountByDate}
                onSelectDay={setDateFilter}
              />
            )}

            {/* Week View Calendar */}
            {viewMode === 'week' && (
              <InlineWeekCalendar
                selectedDate={dateFilter}
                taskCountByDate={taskCountByDate}
                onSelectDay={setDateFilter}
              />
            )}

            {/* Day View Header */}
            {viewMode === 'day' && (
              <InlineDayHeader
                selectedDate={dateFilter || new Date()}
                taskCount={filteredTodos.filter(t => !t.completed).length}
                onSelectDay={(date) => setDateFilter(date)}
                onOpenCalendar={() => setShowFullScreenCalendar(true)}
              />
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Loading tasks...</p>
              </div>
            ) : allTodos.length === 0 ? (
              <div className="text-center py-12">
                <CheckSquare className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground" data-testid="text-no-todos">
                  No tasks in this list
                </p>
                <Button
                  onClick={() => setShowAddDialog(true)}
                  variant="outline"
                  className="mt-4"
                  data-testid="button-add-first-todo"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Task
                </Button>
              </div>
            ) : viewMode === 'list' ? (
              renderListView()
            ) : (
              <div className="space-y-6 max-w-3xl">
                {selectedList === 'completed' ? (
                  renderSection('Completed', groupedTodos.completed, 'section-completed')
                ) : (
                  <>
                    {renderSection('Overdue', groupedTodos.overdue, 'section-overdue')}
                    {renderSection('Today', groupedTodos.today, 'section-today')}
                    {renderSection('This Week', groupedTodos.thisWeek, 'section-this-week')}
                    {renderSection('Later', groupedTodos.later, 'section-later')}
                    {renderSection('No Due Date', groupedTodos.noDueDate, 'section-no-due-date')}
                  </>
                )}
              </div>
            )}
          </main>

        {/* Add/Edit Dialog */}
        <MobileDialog 
          open={showAddDialog || showEditDialog} 
          onOpenChange={(open) => {
            if (!open) {
              setShowAddDialog(false);
              setShowEditDialog(false);
              setEditingTodo(null);
              form.reset();
              setSelectedPhotoId(null);
              setSelectedPhotoUrl(null);
            }
          }}
          title={editingTodo ? 'Edit Task' : 'New Task'}
          footer={
            <div className="flex gap-3 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  setShowEditDialog(false);
                  setEditingTodo(null);
                  form.reset();
                  setSelectedPhotoId(null);
                  setSelectedPhotoUrl(null);
                }}
                data-testid="button-cancel-todo"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                form="todo-form"
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-save-todo"
                className="flex-1"
              >
                {editingTodo ? 'Update' : 'Create'}
              </Button>
            </div>
          }
        >
          <form id="todo-form" onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3" autoComplete="off">
              <div>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="What needs to be done?"
                  aria-label="Task title (required)"
                  required
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="sentences"
                  spellCheck="false"
                  data-testid="input-todo-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Notes (optional)"
                  rows={2}
                  className="min-h-[56px] resize-none"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck="false"
                  data-testid="input-todo-description"
                />
              </div>

              <div className="flex gap-2">
                <Select value={form.watch('projectId') || ''} onValueChange={(value) => form.setValue('projectId', value)}>
                  <SelectTrigger id="projectId" data-testid="select-todo-project" className="flex-1">
                    <SelectValue placeholder="Project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={form.watch('assignedTo') || ''} onValueChange={(value) => form.setValue('assignedTo', value)}>
                  <SelectTrigger id="assignedTo" data-testid="select-todo-assignee" className="flex-1">
                    <SelectValue placeholder="Assignee" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getDisplayName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTodoDueDatePicker(true)}
                  className="flex-1 justify-start text-left font-normal"
                  data-testid="button-select-due-date"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {form.watch('dueDate') 
                    ? format(new Date(form.watch('dueDate')!), 'MMM d')
                    : 'Due date'}
                </Button>
                {!selectedPhotoUrl && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={handleCameraClick}
                      data-testid="button-attach-camera"
                    >
                      <Camera className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadPhotoMutation.isPending}
                      data-testid="button-attach-upload"
                    >
                      <Upload className="w-4 h-4" />
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                  </>
                )}
              </div>

              {selectedPhotoUrl && (
                <div className="relative">
                  <img src={selectedPhotoUrl} alt="Attached" className="w-full h-32 object-cover rounded-lg" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7"
                    onClick={() => {
                      setSelectedPhotoId(null);
                      setSelectedPhotoUrl(null);
                    }}
                    data-testid="button-remove-photo"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </form>
        </MobileDialog>

        {/* Details Drawer */}
        <Sheet open={showDetailsDrawer} onOpenChange={setShowDetailsDrawer}>
          <SheetContent side="bottom" className="h-[85vh] flex flex-col">
            <SheetHeader>
              <SheetTitle>Task Details</SheetTitle>
            </SheetHeader>
            
            <div className="flex-1 overflow-y-auto space-y-6 py-4">
              {/* Photo Preview - larger, more prominent */}
              {selectedTodoForDetails?.photo && (
                <div 
                  className="relative w-full h-64 rounded-lg overflow-hidden bg-muted cursor-pointer"
                  onClick={() => {
                    if (selectedTodoForDetails.photoId) {
                      setLocation(`/photo/${selectedTodoForDetails.photoId}/view`);
                    }
                  }}
                >
                  <img 
                    src={getApiUrl(selectedTodoForDetails.photo.url)} 
                    alt="Task photo"
                    className="w-full h-full object-cover" 
                    data-testid="img-task-detail-photo"
                  />
                  <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-1 rounded-md text-xs">
                    Tap to view
                  </div>
                </div>
              )}
              
              {/* Title and status */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-2xl font-bold flex-1" data-testid="text-task-detail-title">
                    {selectedTodoForDetails?.title}
                  </h2>
                  {selectedTodoForDetails?.flag && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Flag className="w-3 h-3 text-orange-500 fill-orange-500" />
                      Flagged
                    </Badge>
                  )}
                </div>
                
                {/* Status badge */}
                {selectedTodoForDetails && (
                  <div className="flex items-center gap-2 flex-wrap">
                    {selectedTodoForDetails.completed ? (
                      <Badge className="bg-green-500 text-white">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        <Clock className="w-3 h-3 mr-1" />
                        In Progress
                      </Badge>
                    )}
                    
                    {/* Due date status badge */}
                    {selectedTodoForDetails.dueDate && !selectedTodoForDetails.completed && (() => {
                      const date = new Date(selectedTodoForDetails.dueDate);
                      const now = startOfDay(new Date());
                      const due = startOfDay(date);
                      
                      if (isPast(due) && !isSameDay(due, now)) {
                        return (
                          <Badge variant="destructive">
                            <Clock className="w-3 h-3 mr-1" />
                            Overdue
                          </Badge>
                        );
                      } else if (isToday(due)) {
                        return (
                          <Badge className="bg-orange-500 text-white">
                            <Clock className="w-3 h-3 mr-1" />
                            Due Today
                          </Badge>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}
              </div>
              
              {/* Metadata cards - clean, organized */}
              <div className="grid gap-3">
                {selectedTodoForDetails?.dueDate && (
                  <Card className="p-3">
                    <div className="flex items-center gap-3">
                      <CalendarIconOutline className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Due Date</p>
                        <p className="font-medium">{format(new Date(selectedTodoForDetails.dueDate), "PPP")}</p>
                      </div>
                    </div>
                  </Card>
                )}
                
                {selectedTodoForDetails?.assignee && (
                  <Card className="p-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Assigned To</p>
                        <p className="font-medium">{getDisplayName(selectedTodoForDetails.assignee)}</p>
                      </div>
                    </div>
                  </Card>
                )}
                
                {selectedTodoForDetails?.project && (
                  <Card className="p-3">
                    <div className="flex items-center gap-3">
                      <FolderOpen className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Project</p>
                        <p className="font-medium">{selectedTodoForDetails.project.name}</p>
                      </div>
                    </div>
                  </Card>
                )}
                
                {/* Creator info */}
                {selectedTodoForDetails?.creator && (
                  <Card className="p-3">
                    <div className="flex items-center gap-3">
                      <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Created By</p>
                        <p className="font-medium">{getDisplayName(selectedTodoForDetails.creator)}</p>
                      </div>
                    </div>
                  </Card>
                )}
              </div>
              
              {/* Subtasks Section */}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <ListChecks className="w-4 h-4" />
                    Subtasks
                    {subtasks.length > 0 && (
                      <span className="text-xs text-muted-foreground font-normal">
                        ({subtasks.filter(s => s.completed).length}/{subtasks.length})
                      </span>
                    )}
                  </h3>
                </div>
                
                {/* Add subtask input */}
                <div className="flex gap-2 mb-3">
                  <Input
                    value={newSubtaskTitle}
                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                    placeholder="Add a subtask..."
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newSubtaskTitle.trim() && selectedTodoForDetails) {
                        e.preventDefault();
                        createSubtaskMutation.mutate({ 
                          todoId: selectedTodoForDetails.id, 
                          title: newSubtaskTitle.trim() 
                        });
                      }
                    }}
                    data-testid="input-new-subtask"
                  />
                  <Button
                    size="icon"
                    onClick={() => {
                      if (newSubtaskTitle.trim() && selectedTodoForDetails) {
                        createSubtaskMutation.mutate({ 
                          todoId: selectedTodoForDetails.id, 
                          title: newSubtaskTitle.trim() 
                        });
                      }
                    }}
                    disabled={!newSubtaskTitle.trim() || createSubtaskMutation.isPending}
                    data-testid="button-add-subtask"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Subtasks list */}
                {subtasksLoading ? (
                  <p className="text-sm text-muted-foreground">Loading subtasks...</p>
                ) : subtasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No subtasks yet</p>
                ) : (
                  <div className="space-y-2">
                    {subtasks.map((subtask) => (
                      <div 
                        key={subtask.id} 
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 group"
                        data-testid={`subtask-item-${subtask.id}`}
                      >
                        <Checkbox
                          checked={subtask.completed}
                          onCheckedChange={() => completeSubtaskMutation.mutate(subtask.id)}
                          className="flex-shrink-0"
                          data-testid={`checkbox-subtask-${subtask.id}`}
                        />
                        <span className={`flex-1 text-sm ${subtask.completed ? 'line-through text-muted-foreground' : ''}`}>
                          {subtask.title}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => deleteSubtaskMutation.mutate(subtask.id)}
                          disabled={deleteSubtaskMutation.isPending}
                          data-testid={`button-delete-subtask-${subtask.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-semibold mb-2">Notes</h3>
                <Textarea
                  value={selectedTodoForDetails?.description || ''}
                  onChange={(e) => {
                    if (selectedTodoForDetails) {
                      setSelectedTodoForDetails({
                        ...selectedTodoForDetails,
                        description: e.target.value
                      });
                    }
                  }}
                  onBlur={() => {
                    if (selectedTodoForDetails) {
                      updateMutation.mutate({
                        id: selectedTodoForDetails.id,
                        data: { description: selectedTodoForDetails.description || '' },
                        silent: true
                      });
                    }
                  }}
                  placeholder="Add notes..."
                  rows={6}
                  className="resize-none"
                  data-testid="textarea-task-notes"
                />
              </div>
            </div>
            
            <SheetFooter className="flex-row gap-2 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => selectedTodoForDetails && toggleFlagMutation.mutate(selectedTodoForDetails.id)}
                className="flex-1"
                data-testid="button-detail-flag"
              >
                <Flag className="w-4 h-4 mr-2" />
                {selectedTodoForDetails?.flag ? 'Unflag' : 'Flag'}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedTodoForDetails) {
                    handleEditTodo(selectedTodoForDetails);
                    setShowDetailsDrawer(false);
                  }
                }}
                className="flex-1"
                data-testid="button-detail-edit"
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                onClick={() => selectedTodoForDetails && deleteMutation.mutate(selectedTodoForDetails.id)}
                disabled={deleteMutation.isPending}
                className="flex-1"
                data-testid="button-detail-delete"
              >
                Delete
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

      {/* Full-Screen Calendar for filtering */}
      <FullScreenCalendar
        open={showFullScreenCalendar}
        onOpenChange={setShowFullScreenCalendar}
        selectedDate={dateFilter}
        taskCountByDate={taskCountByDate}
        onSelectDay={(date) => setDateFilter(date)}
      />

      {/* Todo Due Date Picker */}
      <FullScreenCalendar
        open={showTodoDueDatePicker}
        onOpenChange={setShowTodoDueDatePicker}
        selectedDate={form.watch('dueDate') ? new Date(form.watch('dueDate')!) : undefined}
        taskCountByDate={new Map()}
        onSelectDay={(date) => {
          if (date) {
            form.setValue('dueDate', format(date, 'yyyy-MM-dd'));
            setShowTodoDueDatePicker(false);
          }
        }}
      />

      {/* Filter Sheet */}
      <ToDosFilterSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        counts={smartListCounts}
      />
    </div>
  );
}
