import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon, MoreVertical, Settings, Camera, Upload, CalendarIcon, Calendar as CalendarIconOutline, User, Home, Filter, Flag, ListTodo, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, isToday, isPast, isThisWeek, startOfDay, isSameDay } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useKeyboardManager } from "@/hooks/useKeyboardManager";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/lib/nativeHaptics";
import type { ToDo, Project } from "@shared/schema";

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

export default function ToDos() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  
  useKeyboardManager();
  
  const [selectedList, setSelectedList] = useState<SmartList>('assigned-to-me');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedTodoForDetails, setSelectedTodoForDetails] = useState<TodoWithDetails | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
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
  const filteredTodos = useMemo(() => {
    const now = startOfDay(new Date());
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    switch (selectedList) {
      case 'today':
        return allTodos.filter(todo => {
          if (todo.completed || !todo.dueDate) return false;
          const dueDate = new Date(todo.dueDate);
          return dueDate >= now && dueDate < tomorrow;
        });
      case 'flagged':
        return allTodos.filter(todo => todo.flag);
      case 'assigned-to-me':
        return allTodos.filter(todo => todo.assignedTo === user?.id && !todo.completed);
      case 'all':
        return allTodos.filter(todo => !todo.completed);
      case 'completed':
        return allTodos.filter(todo => todo.completed);
      default:
        return allTodos;
    }
  }, [allTodos, selectedList, user?.id]);

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
      haptics.success();
      toast({ title: "Task completed!" });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 800);
    },
    onError: (error, variables, context) => {
      haptics.error();
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

  // Delete todo mutation
  const deleteMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('DELETE', `/api/todos/${todoId}`, {});
    },
    onSuccess: () => {
      haptics.warning();
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "Task deleted" });
      setShowDetailsDrawer(false);
    },
    onError: () => {
      haptics.error();
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
      projectId: "",
      assignedTo: "",
      dueDate: "",
    },
  });

  const handleSubmit = (data: CreateTodoForm) => {
    const payload: any = {
      title: data.title,
    };
    
    if (data.description) payload.description = data.description;
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
      description: form.watch('description'),
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
      description: todo.description || "",
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
    const showProject = todo.project;
    const showAssignee = todo.assignee && todo.assignee.id !== user?.id;
    
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
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`font-semibold text-base leading-tight ${todo.completed ? 'line-through text-muted-foreground' : ''}`}
                data-testid={`text-todo-title-${todo.id}`}
              >
                {todo.title}
              </h3>
              {todo.flag && (
                <Flag className="w-4 h-4 text-orange-500 fill-orange-500 flex-shrink-0" data-testid={`icon-flag-${todo.id}`} />
              )}
            </div>
            
            {/* Secondary info - one line */}
            {(showProject || showAssignee || todo.dueDate) && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs flex-wrap">
                {showProject && (
                  <span className="text-muted-foreground" data-testid={`text-project-${todo.id}`}>
                    {showProject.name}
                  </span>
                )}
                {showProject && (showAssignee || todo.dueDate) && (
                  <span className="text-muted-foreground">•</span>
                )}
                {showAssignee && todo.assignee && (
                  <span className="text-muted-foreground" data-testid={`text-assignee-${todo.id}`}>
                    {getDisplayName(todo.assignee)}
                  </span>
                )}
                {showAssignee && todo.dueDate && (
                  <span className="text-muted-foreground">•</span>
                )}
                {todo.dueDate && (
                  <span className={getDueDateColor(todo.dueDate, todo.completed)} data-testid={`text-due-date-${todo.id}`}>
                    {getDueDateText(todo.dueDate)}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Actions menu - RIGHT */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 flex-shrink-0"
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

  // Smart list items
  const smartLists = [
    { id: 'today' as SmartList, label: 'Today', icon: CalendarIcon, count: smartListCounts.today },
    { id: 'flagged' as SmartList, label: 'Flagged', icon: Flag, count: smartListCounts.flagged },
    { id: 'assigned-to-me' as SmartList, label: 'Assigned to Me', icon: User, count: smartListCounts.assignedToMe },
    { id: 'all' as SmartList, label: 'All', icon: ListTodo, count: smartListCounts.all },
    { id: 'completed' as SmartList, label: 'Completed', icon: CheckCircle, count: smartListCounts.completed },
  ];

  const sidebarStyle = {
    "--sidebar-width": "16rem",
  };

  return (
    <SidebarProvider style={sidebarStyle as React.CSSProperties}>
      <div className="flex h-screen w-full">
        {/* Sidebar */}
        <Sidebar>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Smart Lists</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {smartLists.map((list) => (
                    <SidebarMenuItem key={list.id}>
                      <SidebarMenuButton
                        onClick={() => setSelectedList(list.id)}
                        isActive={selectedList === list.id}
                        data-testid={`sidebar-${list.id}`}
                      >
                        <list.icon className="w-4 h-4" />
                        <span>{list.label}</span>
                        {list.count > 0 && (
                          <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full" data-testid={`count-${list.id}`}>
                            {list.count}
                          </span>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>
        </Sidebar>

        {/* Main Content */}
        <div className="flex flex-col flex-1">
          {/* Header */}
          <header className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-xl font-semibold" data-testid="text-list-title">
                {smartLists.find(l => l.id === selectedList)?.label}
              </h1>
            </div>
            <Button
              onClick={() => setShowAddDialog(true)}
              size="sm"
              data-testid="button-add-todo"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          </header>

          {/* Content */}
          <main className="flex-1 overflow-y-auto p-4 pb-20">
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
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false);
            setShowEditDialog(false);
            setEditingTodo(null);
            form.reset();
            setSelectedPhotoId(null);
            setSelectedPhotoUrl(null);
          }
        }}>
          <DialogContent data-testid="dialog-todo-form">
            <DialogHeader>
              <DialogTitle>{editingTodo ? 'Edit Task' : 'New Task'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  {...form.register("title")}
                  placeholder="What needs to be done?"
                  data-testid="input-todo-title"
                />
                {form.formState.errors.title && (
                  <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  {...form.register("description")}
                  placeholder="Add details..."
                  rows={3}
                  data-testid="input-todo-description"
                />
              </div>

              <div>
                <Label htmlFor="projectId">Project</Label>
                <Select value={form.watch('projectId') || ''} onValueChange={(value) => form.setValue('projectId', value)}>
                  <SelectTrigger id="projectId" data-testid="select-todo-project">
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No project</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="assignedTo">Assign to</Label>
                <Select value={form.watch('assignedTo') || ''} onValueChange={(value) => form.setValue('assignedTo', value)}>
                  <SelectTrigger id="assignedTo" data-testid="select-todo-assignee">
                    <SelectValue placeholder="Assign to someone (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {getDisplayName(member)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  {...form.register("dueDate")}
                  data-testid="input-todo-due-date"
                />
              </div>

              {selectedPhotoUrl && (
                <div className="relative">
                  <Label>Attached Photo</Label>
                  <div className="mt-2 relative">
                    <img src={selectedPhotoUrl} alt="Attached" className="w-full h-40 object-cover rounded-lg" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => {
                        setSelectedPhotoId(null);
                        setSelectedPhotoUrl(null);
                      }}
                      data-testid="button-remove-photo"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {!selectedPhotoUrl && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCameraClick}
                    className="flex-1"
                    data-testid="button-attach-camera"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Camera
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadPhotoMutation.isPending}
                    className="flex-1"
                    data-testid="button-attach-upload"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadPhotoMutation.isPending ? 'Uploading...' : 'Upload'}
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              )}

              <DialogFooter>
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
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-todo"
                >
                  {editingTodo ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Details Drawer */}
        <Sheet open={showDetailsDrawer} onOpenChange={setShowDetailsDrawer}>
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
              
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold" data-testid="text-task-detail-title">
                  {selectedTodoForDetails?.title}
                </h2>
                {selectedTodoForDetails?.flag && (
                  <Flag className="w-5 h-5 text-orange-500 fill-orange-500 flex-shrink-0" />
                )}
              </div>
              
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
      </div>
    </SidebarProvider>
  );
}
