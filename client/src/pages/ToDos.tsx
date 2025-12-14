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
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/lib/nativeHaptics";
import type { ToDo, Project } from "@shared/schema";
import { ToDosFilterSheet } from "@/components/ToDosFilterSheet";
import { InlineMonthCalendar } from "@/components/InlineMonthCalendar";
import { InlineWeekCalendar } from "@/components/InlineWeekCalendar";
import { InlineDayHeader } from "@/components/InlineDayHeader";

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
type ViewMode = 'month' | 'week' | 'day';

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
    return (params.get('view') || 'month') as ViewMode;
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
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle photo attachment from camera
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    
    if (photoId) {
      const savedFormData = localStorage.getItem('todo-form-draft');
      
      fetch(`/api/photos/${photoId}`)
        .then(res => {
          if (!res.ok) throw new Error('Photo not found');
          return res.json();
        })
        .then(photo => {
          setSelectedPhotoId(photoId);
          setSelectedPhotoUrl(photo.url);
          
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
  // IMPORTANT: Keep todos that are animating (in animatingTasks) so the slide-out animation
  // can play before they're removed from the DOM
  const filteredTodos = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let todos: TodoWithDetails[] = [];
    
    switch (selectedList) {
      case 'today':
        todos = allTodos.filter(todo => {
          // Keep animating todos in the list so animation can play
          if (animatingTasks.has(todo.id)) return true;
          if (todo.completed || !todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate < tomorrow;
        });
        break;
      case 'flagged':
        todos = allTodos.filter(todo => animatingTasks.has(todo.id) || todo.flag);
        break;
      case 'assigned-to-me':
        todos = allTodos.filter(todo => animatingTasks.has(todo.id) || (todo.assignedTo === user?.id && !todo.completed));
        break;
      case 'all':
        todos = allTodos.filter(todo => animatingTasks.has(todo.id) || !todo.completed);
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
        if (animatingTasks.has(todo.id)) return true;
        if (!todo.dueDate) return false;
        const dueDate = startOfDay(new Date(todo.dueDate));
        return isSameDay(dueDate, filterDate);
      });
    }
    
    return todos;
  }, [allTodos, selectedList, user?.id, dateFilter, animatingTasks]);

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

  // Fetch projects for assignment
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch company members for assignment
  const { data: members = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null }>>({
    queryKey: ['/api/companies/members'],
  });

  // Complete todo mutation with slide-out animation
  const completeMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('POST', `/api/todos/${todoId}/complete`, {});
    },
    onMutate: async (todoId: string) => {
      // Start slide-out animation
      setAnimatingTasks(prev => new Set(prev).add(todoId));
      
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
      // Wait for animation to complete before refreshing
      setTimeout(() => {
        setAnimatingTasks(prev => {
          const next = new Set(prev);
          next.delete(todoId);
          return next;
        });
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 500);
    },
    onError: (error, todoId, context) => {
      haptics.error();
      // Clear animation state on error
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
      setSelectedPhotoUrl(todo.photo.url);
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

  // Render task card - simplified, minimal design with iOS-style swipe gestures
  const renderTaskCard = (todo: TodoWithDetails) => {
    const isThisTodoSwiped = swipedTodo === todo.id;
    const currentOffset = isThisTodoSwiped ? swipeOffset : 0;
    const isAnimating = animatingTasks.has(todo.id);

    return (
      <div 
        className={`transition-all duration-500 ease-out ${isAnimating ? 'max-h-0 opacity-0 mb-0 overflow-hidden' : 'max-h-96 opacity-100 mb-2'}`}
        key={todo.id}
      >
      <div className="relative overflow-hidden rounded-lg">
        {/* Swipe action backgrounds with dynamic visual feedback */}
        {/* Right swipe - complete action (green) */}
        <div className="absolute inset-0 bg-green-500 flex items-center justify-start px-4 rounded-lg overflow-hidden">
          <div className="flex items-center gap-2">
            <Check className="w-6 h-6 text-white" />
            <span className="text-white font-medium">Complete</span>
          </div>
        </div>
        
        {/* Left swipe - delete action (red shows when swiped far, gray for reveal) */}
        <div className={`absolute inset-0 flex items-center justify-end px-4 transition-colors rounded-lg overflow-hidden ${
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
          className={`relative cursor-pointer overflow-hidden ${todo.completed ? 'opacity-50' : ''} px-3 py-2 ${!isSwiping.current ? 'transition-all duration-200 ease-out' : ''} ${currentOffset > 0 ? 'bg-transparent' : ''} ${animatingTasks.has(todo.id) ? 'translate-x-full opacity-0 scale-95' : ''}`}
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
        <div className="flex items-center gap-2">
          {/* Checkbox */}
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
            className="h-4 w-4 flex-shrink-0"
            data-testid={`checkbox-todo-complete-${todo.id}`}
          />

          {/* Photo thumbnail - small indicator */}
          {todo.photo && (
            <div
              className="flex-shrink-0 w-8 h-8 rounded overflow-hidden bg-muted"
              onClick={(e) => {
                e.stopPropagation();
                setLocation(`/photo/${todo.photoId}/view`);
              }}
              data-testid={`img-todo-photo-${todo.id}`}
            >
              <img
                src={todo.photo.url}
                alt="Task photo"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Title and metadata - main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3
                className={`font-medium text-sm leading-tight truncate ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
                data-testid={`text-todo-title-${todo.id}`}
              >
                {todo.title}
              </h3>
              
              {/* Inline indicators */}
              {todo.project && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal" data-testid={`badge-project-${todo.id}`}>
                  {todo.project.name}
                </Badge>
              )}
            </div>
            
            {/* Secondary info row - only show if has content */}
            {(todo.assignee || todo.description) && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                {todo.assignee && (
                  <span className="flex items-center gap-0.5" data-testid={`text-assignee-${todo.id}`}>
                    <User className="w-2.5 h-2.5" />
                    {getDisplayName(todo.assignee)}
                  </span>
                )}
                {todo.description && (
                  <span className="truncate max-w-[150px]" data-testid={`text-description-preview-${todo.id}`}>
                    {todo.description.substring(0, 40)}{todo.description.length > 40 ? '...' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right indicators - flag and due date */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Due date indicator (icon with color coding for all tasks) */}
            {todo.dueDate && (() => {
              const date = new Date(todo.dueDate);
              const now = startOfDay(new Date());
              const due = startOfDay(date);
              
              if (todo.completed) {
                return <Clock className="w-3.5 h-3.5 text-muted-foreground" data-testid={`icon-due-completed-${todo.id}`} />;
              }
              
              if (isPast(due) && !isSameDay(due, now)) {
                return <Clock className="w-3.5 h-3.5 text-destructive" data-testid={`icon-overdue-${todo.id}`} />;
              } else if (isToday(due)) {
                return <Clock className="w-3.5 h-3.5 text-orange-500" data-testid={`icon-due-today-${todo.id}`} />;
              } else {
                return <Clock className="w-3.5 h-3.5 text-muted-foreground" data-testid={`icon-due-future-${todo.id}`} />;
              }
            })()}

            {/* Flag indicator */}
            {todo.flag && (
              <Flag className="w-3.5 h-3.5 text-orange-500 fill-orange-500" data-testid={`icon-flag-${todo.id}`} />
            )}

            {/* Actions menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  data-testid={`button-todo-menu-${todo.id}`}
                >
                  <MoreVertical className="w-3.5 h-3.5" />
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
                    src={selectedTodoForDetails.photo.url} 
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
