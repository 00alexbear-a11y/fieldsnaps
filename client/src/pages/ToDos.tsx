import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon, MoreVertical, Settings, Camera, Upload, CalendarIcon, Calendar as CalendarIconOutline, User, Home, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, isPast, isThisWeek, startOfDay, isSameDay, startOfWeek, endOfWeek } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardManager } from "@/hooks/useKeyboardManager";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import type { ToDo, Project } from "@shared/schema";

const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required"),
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

export default function ToDos() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  useKeyboardManager();
  
  const [view, setView] = useState<'my-tasks' | 'team-tasks' | 'calendar'>('my-tasks');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterCompleted, setFilterCompleted] = useState<string>('active');
  const [filterCreator, setFilterCreator] = useState<string>('all'); // 'all' or 'me'
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarMode, setCalendarMode] = useState<'week' | 'month'>('month');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedTodoForDetails, setSelectedTodoForDetails] = useState<TodoWithDetails | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showDetailsSection, setShowDetailsSection] = useState(false);
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
              projectId: formData.projectId || '',
              assignedTo: formData.assignedTo || '',
              dueDate: formData.dueDate || '',
            });
            localStorage.removeItem('todo-form-draft');
            toast({ title: "Photo attached!" });
          } else {
            form.reset({
              title: "",
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

  // Fetch todos
  const { data: allTodos = [], isLoading } = useQuery<TodoWithDetails[]>({
    queryKey: ['/api/todos', view],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      const response = await fetch(`/api/todos?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch todos: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Apply filters to todos
  const filteredTodos = useMemo(() => {
    return allTodos.filter((todo) => {
      // Project filter
      if (filterProject !== 'all' && todo.projectId !== filterProject) return false;
      
      // Completed filter
      if (filterCompleted === 'active' && todo.completed) return false;
      if (filterCompleted === 'completed' && !todo.completed) return false;
      
      // Creator filter (I Created)
      if (filterCreator === 'me' && todo.creator?.id !== user?.id) return false;
      
      return true;
    });
  }, [allTodos, filterProject, filterCompleted, filterCreator, user?.id]);

  // Group todos by urgency for list views
  const groupedTodos = useMemo(() => {
    const now = startOfDay(new Date());
    const groups = {
      overdue: [] as TodoWithDetails[],
      today: [] as TodoWithDetails[],
      thisWeek: [] as TodoWithDetails[],
      later: [] as TodoWithDetails[],
      noDueDate: [] as TodoWithDetails[],
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
  }, [filteredTodos]);

  // Calculate task counts by date for calendar
  const taskCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    
    filteredTodos.forEach((todo) => {
      if (todo.dueDate) {
        const date = new Date(todo.dueDate);
        const dateString = format(date, 'yyyy-MM-dd');
        counts.set(dateString, (counts.get(dateString) || 0) + 1);
      }
    });
    
    return counts;
  }, [filteredTodos]);

  // Filter todos by selected date for calendar view
  const calendarTodos = view === 'calendar' 
    ? filteredTodos.filter((todo) => {
        if (!todo.dueDate) return false;
        const todoDate = new Date(todo.dueDate);
        const selected = new Date(selectedDate);
        return (
          todoDate.getFullYear() === selected.getFullYear() &&
          todoDate.getMonth() === selected.getMonth() &&
          todoDate.getDate() === selected.getDate()
        );
      })
    : [];

  const selectedDateTaskCount = useMemo(() => {
    const dateString = format(selectedDate, 'yyyy-MM-dd');
    return taskCountsByDate.get(dateString) || 0;
  }, [selectedDate, taskCountsByDate]);

  // Fetch projects for filter
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Fetch company members for assignment
  const { data: members = [] } = useQuery<Array<{ id: string; firstName: string | null; lastName: string | null }>>({
    queryKey: ['/api/companies/members'],
  });

  // Complete todo mutation
  const completeMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('POST', `/api/todos/${todoId}/complete`, {});
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
              ? { ...todo, completed: true, completedAt: new Date() }
              : todo
          );
        }
      );
      
      return { previousQueries };
    },
    onSuccess: () => {
      toast({ title: "Task completed!" });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 800);
    },
    onError: (error, variables, context) => {
      if (context?.previousQueries) {
        context.previousQueries.forEach(({ queryKey, data }) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      toast({ title: "Failed to complete task", variant: "destructive" });
    },
  });

  // Delete todo mutation
  const deleteMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('DELETE', `/api/todos/${todoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete task", variant: "destructive" });
    },
  });

  // Create todo mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTodoForm) => {
      return apiRequest('POST', '/api/todos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task created!" });
      setShowAddDialog(false);
      form.reset();
      setSelectedPhotoId(null);
      setSelectedPhotoUrl(null);
    },
    onError: () => {
      toast({ title: "Failed to create task", variant: "destructive" });
    },
  });

  // Update todo mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTodoForm> }) => {
      return apiRequest('PATCH', `/api/todos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task updated!" });
      setShowEditDialog(false);
      setEditingTodo(null);
      form.reset();
      setSelectedPhotoId(null);
      setSelectedPhotoUrl(null);
    },
    onError: () => {
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
      projectId: "",
      assignedTo: "",
      dueDate: "",
    },
  });

  const handleSubmit = (data: CreateTodoForm) => {
    const payload: any = {
      title: data.title,
    };
    
    if (data.projectId) payload.projectId = data.projectId;
    if (data.dueDate) payload.dueDate = data.dueDate;
    if (selectedPhotoId) payload.photoId = selectedPhotoId;
    if (data.assignedTo) payload.assignedTo = data.assignedTo;
    
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
      projectId: form.watch('projectId'),
      assignedTo: form.watch('assignedTo'),
      dueDate: form.watch('dueDate'),
    };
    localStorage.setItem('todo-form-draft', JSON.stringify(formData));
    
    const projectId = form.watch('projectId');
    setLocation(`/camera?projectId=${projectId || ''}&mode=attachToTodo`);
  };

  const handleEditTodo = (todo: TodoWithDetails) => {
    setEditingTodo(todo);
    form.reset({
      title: todo.title,
      projectId: todo.projectId || "",
      assignedTo: todo.assignedTo || "",
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

  const getDueDateColor = (dueDate: Date | string | null, completed: boolean) => {
    if (!dueDate || completed) return 'text-muted-foreground';
    
    const date = new Date(dueDate);
    const now = startOfDay(new Date());
    const due = startOfDay(date);
    
    if (isPast(due) && !isSameDay(due, now)) return 'text-destructive font-medium';
    if (isToday(due)) return 'text-orange-500 dark:text-orange-400 font-medium';
    return 'text-muted-foreground';
  };

  const getDueDateText = (dueDate: Date | string) => {
    const date = new Date(dueDate);
    if (isToday(date)) return 'Due today';
    if (isPast(date) && !isToday(date)) return `Overdue ${format(date, 'MMM d')}`;
    return `Due ${format(date, 'MMM d')}`;
  };

  // Render task card
  const renderTaskCard = (todo: TodoWithDetails) => {
    const showProject = filterProject === 'all' && todo.project;
    const showAssignee = view === 'my-tasks' ? (todo.assignee && todo.assignee.id !== user?.id) : todo.assignee;
    
    return (
      <Card
        key={todo.id}
        className={`hover-elevate cursor-pointer transition-opacity ${todo.completed ? 'opacity-50' : ''} ${todo.photo ? 'p-3' : 'p-4'}`}
        onClick={() => { setSelectedTodoForDetails(todo); setShowDetailsDrawer(true); }}
        data-testid={`card-todo-${todo.id}`}
      >
        <div className="flex items-start gap-3">
          {/* Checkbox - LEFT */}
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
            className="mt-0.5 h-5 w-5"
            data-testid={`checkbox-todo-complete-${todo.id}`}
          />

          {/* Photo thumbnail if available */}
          {todo.photo && (
            <div
              className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-muted cursor-pointer"
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

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3
              className={`font-semibold text-base leading-tight ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
              data-testid={`text-todo-title-${todo.id}`}
            >
              {todo.title}
            </h3>
            
            {/* Secondary info - one line */}
            {(showProject || showAssignee || todo.dueDate) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs flex-wrap">
                {showProject && (
                  <span className="text-muted-foreground" data-testid={`text-todo-project-${todo.id}`}>
                    {todo.project!.name}
                  </span>
                )}
                {showProject && (showAssignee || todo.dueDate) && (
                  <span className="text-muted-foreground">•</span>
                )}
                {showAssignee && (
                  <span className="text-muted-foreground">
                    {getDisplayName(todo.assignee!)}
                  </span>
                )}
                {showAssignee && todo.dueDate && (
                  <span className="text-muted-foreground">•</span>
                )}
                {todo.dueDate && (
                  <span className={getDueDateColor(todo.dueDate, todo.completed)}>
                    {getDueDateText(todo.dueDate)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Three-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
                data-testid={`button-menu-todo-${todo.id}`}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEditTodo(todo); }} data-testid={`menu-edit-todo-${todo.id}`}>
                Edit
              </DropdownMenuItem>
              {!todo.completed && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); completeMutation.mutate(todo.id); }}
                  disabled={completeMutation.isPending}
                  data-testid={`menu-complete-todo-${todo.id}`}
                >
                  Mark Complete
                </DropdownMenuItem>
              )}
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
      </Card>
    );
  };

  // Render section
  const renderSection = (title: string, todos: TodoWithDetails[], testId: string) => {
    if (todos.length === 0) return null;
    
    return (
      <div className="space-y-3" data-testid={testId}>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          {title} ({todos.length})
        </h2>
        <div className="space-y-2">
          {todos.map(renderTaskCard)}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center px-4 h-14">
          <h1 className="text-xl font-bold">Tasks</h1>
        </div>

        {/* Tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0 h-11">
            <TabsTrigger
              value="my-tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-my-tasks"
            >
              My Tasks
            </TabsTrigger>
            <TabsTrigger
              value="team-tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-team-tasks"
            >
              Team
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              data-testid="tab-calendar"
            >
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex gap-2 px-4 py-3 border-b">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="h-9 flex-1" data-testid="select-filter-project">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCompleted} onValueChange={setFilterCompleted}>
            <SelectTrigger className="h-9 w-28" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Done</SelectItem>
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" data-testid="button-filter-more">
                <Filter className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={() => setFilterCreator(filterCreator === 'all' ? 'me' : 'all')}
                data-testid="menu-filter-created-by-me"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-sm border flex items-center justify-center ${filterCreator === 'me' ? 'bg-primary border-primary' : 'border-input'}`}>
                    {filterCreator === 'me' && <Check className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <span>I Created</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Content */}
      {view === 'calendar' ? (
        <div className="p-4 space-y-6">
          {/* Calendar Header with Week/Month Toggle */}
          <div className="flex justify-end gap-1 mb-2">
            <Button
              variant={calendarMode === 'week' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCalendarMode('week')}
              className="h-8 px-3"
              data-testid="button-calendar-week"
            >
              Week
            </Button>
            <Button
              variant={calendarMode === 'month' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setCalendarMode('month')}
              className="h-8 px-3"
              data-testid="button-calendar-month"
            >
              Month
            </Button>
          </div>

          {/* Calendar */}
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            className="rounded-lg border w-full"
            data-testid="calendar-view"
            fromDate={calendarMode === 'week' ? startOfWeek(selectedDate, { weekStartsOn: 0 }) : undefined}
            toDate={calendarMode === 'week' ? endOfWeek(selectedDate, { weekStartsOn: 0 }) : undefined}
            defaultMonth={calendarMode === 'week' ? selectedDate : undefined}
            components={{
              DayContent: ({ date, ...props }) => {
                const dateString = format(date, 'yyyy-MM-dd');
                const count = taskCountsByDate.get(dateString) || 0;
                
                return (
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span>{date.getDate()}</span>
                    {count > 0 && (
                      <div 
                        className="absolute top-0 right-0 flex items-center justify-center bg-primary text-primary-foreground rounded-full min-w-[18px] h-[18px] px-1 text-[10px] font-semibold"
                        data-testid={`badge-count-${dateString}`}
                      >
                        {count}
                      </div>
                    )}
                  </div>
                );
              },
            }}
          />

          {/* Selected Date Header */}
          <div className="text-center">
            <h2 className="text-lg font-semibold" data-testid="text-selected-date">
              {format(selectedDate, "EEEE, MMMM d, yyyy")}
            </h2>
            {selectedDateTaskCount > 0 && (
              <p className="text-sm text-muted-foreground mt-1" data-testid="text-task-count">
                {selectedDateTaskCount} {selectedDateTaskCount === 1 ? 'task' : 'tasks'}
              </p>
            )}
          </div>

          {/* Tasks for Selected Date */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : calendarTodos.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No tasks</h3>
              <p className="text-muted-foreground">
                No tasks scheduled for this date
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {calendarTodos.map(renderTaskCard)}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-2xl mx-auto p-4 space-y-6">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTodos.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tasks</h2>
              <p className="text-muted-foreground">
                {view === 'my-tasks' ? 'You have no assigned tasks' : 'Your team has no tasks'}
              </p>
            </div>
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-photo"
      />

      {/* Task Details Drawer */}
      <Sheet open={showDetailsDrawer} onOpenChange={setShowDetailsDrawer} data-testid="sheet-task-details">
        <SheetContent side="bottom" className="h-[85vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>Task Details</SheetTitle>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {selectedTodoForDetails?.photo && (
              <img 
                src={selectedTodoForDetails.photo.url} 
                alt="Task photo"
                className="w-full h-48 object-cover rounded-lg" 
                data-testid="img-task-detail-photo"
              />
            )}
            
            <h2 className="text-xl font-bold" data-testid="text-task-detail-title">
              {selectedTodoForDetails?.title}
            </h2>
            
            <div className="space-y-3 pt-2">
              {selectedTodoForDetails?.dueDate && (
                <div className="flex items-center gap-3">
                  <CalendarIconOutline className="w-5 h-5 text-muted-foreground" />
                  <span>Due: {format(new Date(selectedTodoForDetails.dueDate), "PPP")}</span>
                </div>
              )}
              
              {selectedTodoForDetails?.assignee && (
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5 text-muted-foreground" />
                  <span>Assigned: {getDisplayName(selectedTodoForDetails.assignee)}</span>
                </div>
              )}
              
              {selectedTodoForDetails?.project && (
                <div className="flex items-center gap-3">
                  <Home className="w-5 h-5 text-muted-foreground" />
                  <span>Project: {selectedTodoForDetails.project.name}</span>
                </div>
              )}
            </div>
          </div>
          
          <SheetFooter className="flex-row gap-3 sm:gap-3">
            <Button 
              variant="outline" 
              className="flex-1"
              onClick={() => {
                if (selectedTodoForDetails) {
                  handleEditTodo(selectedTodoForDetails);
                  setShowDetailsDrawer(false);
                }
              }}
              data-testid="button-edit-task"
            >
              Edit
            </Button>
            {!selectedTodoForDetails?.completed && (
              <Button 
                className="flex-1" 
                onClick={() => {
                  if (selectedTodoForDetails) {
                    completeMutation.mutate(selectedTodoForDetails.id);
                    setShowDetailsDrawer(false);
                  }
                }}
                data-testid="button-complete-task"
              >
                <Check className="w-4 h-4 mr-2" />
                Complete
              </Button>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Floating Action Button */}
      <Button
        onClick={() => {
          setEditingTodo(null);
          setShowDetailsSection(false);
          form.reset({
            title: "",
            projectId: filterProject !== "all" ? filterProject : "",
            assignedTo: "",
            dueDate: "",
          });
          setSelectedPhotoId(null);
          setSelectedPhotoUrl(null);
          setShowAddDialog(true);
        }}
        size="icon"
        className="!fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
        style={{ position: 'fixed', bottom: '5rem', right: '1rem' }}
        data-testid="button-add-todo-fab"
      >
        <Plus className="w-6 h-6" />
      </Button>

      {/* Quick Add Sheet (Bottom Sheet) */}
      <Sheet open={showAddDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowDetailsSection(false);
          setEditingTodo(null);
          setSelectedPhotoId(null);
          setSelectedPhotoUrl(null);
          form.reset({
            title: "",
            projectId: "",
            assignedTo: "",
            dueDate: "",
          });
        }
      }}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh] flex flex-col p-0">
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col max-h-[90vh]">
            {/* Main Title Input Section - Fixed at top */}
            <div className="flex-shrink-0 p-6 pb-4">
              <SheetHeader className="mb-4">
                <SheetTitle>New Task</SheetTitle>
              </SheetHeader>
              
              <div className="space-y-2">
                <Input
                  {...form.register("title")}
                  placeholder="What needs to be done?"
                  className="text-base h-12"
                  autoFocus
                  data-testid="input-todo-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive">{form.formState.errors.title.message}</p>
                )}
              </div>

              {/* Add Details Toggle Button */}
              {!showDetailsSection && (
                <button
                  type="button"
                  onClick={() => setShowDetailsSection(true)}
                  className="mt-3 text-sm text-primary hover:underline"
                  data-testid="button-show-details"
                >
                  Add Details
                </button>
              )}
            </div>

            {/* Expandable Details Section - Scrollable middle */}
            {showDetailsSection && (
              <div className="flex-1 px-6 pb-4 space-y-4 border-t pt-4 overflow-y-auto min-h-0">
                {/* Photo */}
                <div>
                  <Label className="text-sm text-muted-foreground">Photo</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCameraClick}
                      className="flex-1 h-11"
                      data-testid="button-camera"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Camera
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex-1 h-11"
                      data-testid="button-album"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Album
                    </Button>
                  </div>
                  
                  {uploadPhotoMutation.isPending && (
                    <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                      <span>Uploading...</span>
                    </div>
                  )}

                  {selectedPhotoUrl && !uploadPhotoMutation.isPending && (
                    <div className="mt-3 relative rounded-lg overflow-hidden border">
                      <img
                        src={selectedPhotoUrl}
                        alt="Selected photo"
                        className="w-full h-32 object-cover"
                        data-testid="img-preview-photo"
                      />
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
                </div>

                {/* Assign To */}
                <div>
                  <Label htmlFor="assignedTo" className="text-sm text-muted-foreground">Assign to</Label>
                  <Select onValueChange={(value) => form.setValue("assignedTo", value)} value={form.watch("assignedTo") || undefined}>
                    <SelectTrigger id="assignedTo" className="h-11 mt-2" data-testid="select-todo-assignee">
                      <SelectValue placeholder="Select team member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {getDisplayName({ firstName: member.firstName, lastName: member.lastName })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Due Date */}
                <div>
                  <Label htmlFor="dueDate" className="text-sm text-muted-foreground">Due Date</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    {...form.register("dueDate")}
                    className="h-11 mt-2"
                    data-testid="input-due-date"
                  />
                </div>

                {/* Project */}
                <div>
                  <Label htmlFor="projectId" className="text-sm text-muted-foreground">Project</Label>
                  <Select onValueChange={(value) => form.setValue("projectId", value)} value={form.watch("projectId") || undefined}>
                    <SelectTrigger id="projectId" className="h-11 mt-2" data-testid="select-todo-project">
                      <SelectValue placeholder="None" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Footer Buttons - Sticky at bottom */}
            <div className="flex-shrink-0 flex gap-3 p-6 pt-4 border-t bg-background">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setShowAddDialog(false);
                  setShowDetailsSection(false);
                }}
                className="flex-1 h-12"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending}
                className="flex-1 h-12"
                data-testid="button-submit-todo"
              >
                {createMutation.isPending ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                ) : null}
                Create
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Edit Todo Dialog (Keep as Dialog for editing) */}
      <Dialog open={showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowEditDialog(false);
          setEditingTodo(null);
          setSelectedPhotoId(null);
          setSelectedPhotoUrl(null);
          form.reset({
            title: "",
            projectId: "",
            assignedTo: "",
            dueDate: "",
          });
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            
            {/* Photo */}
            <div>
              <Label>Photo</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraClick}
                  className="flex-1"
                  data-testid="button-camera"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
                  data-testid="button-album"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Album
                </Button>
              </div>
              
              {uploadPhotoMutation.isPending && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Uploading...</span>
                </div>
              )}

              {selectedPhotoUrl && !uploadPhotoMutation.isPending && (
                <div className="mt-3 relative rounded-lg overflow-hidden border">
                  <img
                    src={selectedPhotoUrl}
                    alt="Selected photo"
                    className="w-full h-40 object-cover"
                    data-testid="img-preview-photo"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-2 right-2 h-8 w-8"
                    onClick={() => {
                      setSelectedPhotoId(null);
                      setSelectedPhotoUrl(null);
                    }}
                    data-testid="button-remove-photo"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <Label htmlFor="title-edit">Task *</Label>
              <Input
                id="title-edit"
                {...form.register("title")}
                placeholder="What needs to be done?"
                className="mt-2"
                data-testid="input-todo-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* Assign To */}
            <div>
              <Label htmlFor="assignedTo-edit">Assign to</Label>
              <Select onValueChange={(value) => form.setValue("assignedTo", value)} value={form.watch("assignedTo") || undefined}>
                <SelectTrigger id="assignedTo-edit" className="mt-2" data-testid="select-todo-assignee">
                  <SelectValue placeholder="Select team member" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {getDisplayName({ firstName: member.firstName, lastName: member.lastName })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date */}
            <div>
              <Label htmlFor="dueDate-edit">Due Date</Label>
              <Input
                id="dueDate-edit"
                type="date"
                {...form.register("dueDate")}
                className="mt-2"
                data-testid="input-due-date"
              />
            </div>

            {/* Project */}
            <div>
              <Label htmlFor="projectId-edit">Project</Label>
              <Select onValueChange={(value) => form.setValue("projectId", value)} value={form.watch("projectId") || undefined}>
                <SelectTrigger id="projectId-edit" className="mt-2" data-testid="select-todo-project">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            </div>

            <DialogFooter className="flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => {
                setShowEditDialog(false);
                setEditingTodo(null);
              }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
                data-testid="button-submit-todo"
              >
                {updateMutation.isPending ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                ) : null}
                Update
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
