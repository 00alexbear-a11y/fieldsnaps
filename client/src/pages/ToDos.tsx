import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon, MoreVertical, Settings, Camera, Upload, CalendarIcon, Calendar as CalendarIconOutline, User, Home } from "lucide-react";
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
import { format } from "date-fns";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import type { ToDo, Project } from "@shared/schema";

const createTodoSchema = z.object({
  title: z.string().min(1, "Title is required"),
  projectId: z.string().optional(),
  assignedTo: z.string().optional(), // Optional - defaults to creator
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
  const [view, setView] = useState<'my-tasks' | 'team-tasks' | 'i-created' | 'calendar'>('my-tasks');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterCompleted, setFilterCompleted] = useState<string>('active');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [selectedTodoForDetails, setSelectedTodoForDetails] = useState<TodoWithDetails | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle photo attachment from camera or quick task creation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const photoId = params.get('photoId');
    
    if (photoId) {
      // Check if this is from camera (has saved form data) or quick task creation
      const savedFormData = localStorage.getItem('todo-form-draft');
      
      // Fetch photo details to get the URL
      fetch(`/api/photos/${photoId}`)
        .then(res => {
          if (!res.ok) throw new Error('Photo not found');
          return res.json();
        })
        .then(photo => {
          // Attach the photo
          setSelectedPhotoId(photoId);
          setSelectedPhotoUrl(photo.url);
          
          if (savedFormData) {
            // Coming from camera with saved form data
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
            // Quick task creation from camera preview - start fresh
            form.reset({
              title: "",
              projectId: photo.projectId || "",
              assignedTo: "",
              dueDate: "",
            });
            toast({ title: "Create a task for this photo" });
          }
          
          // Open the dialog
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
      
      // Clean URL (remove photoId param)
      window.history.replaceState({}, '', '/todos');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]); // Re-run when location/URL changes

  // Fetch todos
  const { data: todos = [], isLoading } = useQuery<TodoWithDetails[]>({
    queryKey: ['/api/todos', view, filterProject, filterCompleted, selectedDate],
    queryFn: async () => {
      const params = new URLSearchParams({ view });
      if (filterProject !== 'all') params.append('projectId', filterProject);
      if (filterCompleted !== 'all') params.append('completed', filterCompleted === 'completed' ? 'true' : 'false');
      const response = await fetch(`/api/todos?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch todos: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
  });

  // Calculate task counts by date (memoized for performance)
  const taskCountsByDate = useMemo(() => {
    const counts = new Map<string, number>();
    
    // Only count todos that match current filters
    const filteredTodos = todos.filter((todo) => {
      if (!todo.dueDate) return false;
      
      // Apply project filter
      if (filterProject !== 'all' && todo.projectId !== filterProject) return false;
      
      // Apply completed filter
      if (filterCompleted === 'active' && todo.completed) return false;
      if (filterCompleted === 'completed' && !todo.completed) return false;
      
      return true;
    });
    
    // Group by date
    filteredTodos.forEach((todo) => {
      if (todo.dueDate) {
        const date = new Date(todo.dueDate);
        const dateString = format(date, 'yyyy-MM-dd');
        counts.set(dateString, (counts.get(dateString) || 0) + 1);
      }
    });
    
    return counts;
  }, [todos, filterProject, filterCompleted]);

  // Filter todos by selected date for calendar view
  const calendarTodos = view === 'calendar' 
    ? todos.filter((todo) => {
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

  // Get task count for selected date
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
    onSuccess: () => {
      toast({ title: "To-do completed!" });
      // Small delay to show completion animation before task disappears from active view
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      }, 800);
    },
    onError: () => {
      toast({ title: "Failed to complete to-do", variant: "destructive" });
    },
  });

  // Delete todo mutation
  const deleteMutation = useMutation({
    mutationFn: async (todoId: string) => {
      return apiRequest('DELETE', `/api/todos/${todoId}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "To-do deleted" });
    },
    onError: () => {
      toast({ title: "Failed to delete to-do", variant: "destructive" });
    },
  });

  // Create todo mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateTodoForm) => {
      return apiRequest('POST', '/api/todos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "To-do created!" });
      setShowAddDialog(false);
      form.reset();
      setSelectedPhotoId(null);
      setSelectedPhotoUrl(null);
    },
    onError: () => {
      toast({ title: "Failed to create to-do", variant: "destructive" });
    },
  });

  // Update todo mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateTodoForm> }) => {
      return apiRequest('PATCH', `/api/todos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "To-do updated!" });
      setShowEditDialog(false);
      setEditingTodo(null);
      form.reset();
      setSelectedPhotoId(null);
      setSelectedPhotoUrl(null);
    },
    onError: () => {
      toast({ title: "Failed to update to-do", variant: "destructive" });
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
    // Remove empty optional fields
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
    // Save current form data to localStorage before navigating
    const formData = {
      title: form.watch('title'),
      projectId: form.watch('projectId'),
      assignedTo: form.watch('assignedTo'),
      dueDate: form.watch('dueDate'),
    };
    localStorage.setItem('todo-form-draft', JSON.stringify(formData));
    
    const projectId = form.watch('projectId');
    // Navigate to camera in Photo Attachment Mode
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

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b">
        <div className="flex items-center justify-between p-4">
          <h1 className="text-2xl font-bold">To-Do</h1>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                setEditingTodo(null);
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
              className="h-12"
              data-testid="button-add-todo"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add To-Do
            </Button>
            <Button 
              size="icon" 
              variant="outline" 
              className="h-12 w-12" 
              onClick={() => setLocation('/settings')}
              data-testid="button-settings"
            >
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={view} onValueChange={(v) => setView(v as any)} className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger
              value="my-tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              data-testid="tab-my-tasks"
            >
              My Tasks
            </TabsTrigger>
            <TabsTrigger
              value="team-tasks"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              data-testid="tab-team-tasks"
            >
              Team Tasks
            </TabsTrigger>
            <TabsTrigger
              value="i-created"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              data-testid="tab-i-created"
            >
              I Created
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary"
              data-testid="tab-calendar"
            >
              Calendar
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filters */}
        <div className="flex gap-2 p-4 max-w-screen-sm mx-auto border-b">
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-[180px]" data-testid="select-filter-project">
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
            <SelectTrigger className="w-[140px]" data-testid="select-filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Content */}
      {view === 'calendar' ? (
        <div className="p-4 space-y-6">
          {/* Calendar */}
          <div>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border w-full"
              data-testid="calendar-view"
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
          </div>

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
            <div className="space-y-3">
              {calendarTodos.map((todo) => (
                <Card
                  key={todo.id}
                  className={`hover-elevate cursor-pointer ${todo.completed ? 'opacity-60' : ''} ${todo.photo ? 'px-2 py-2' : 'px-3 py-1'}`}
                  onClick={() => { setSelectedTodoForDetails(todo); setShowDetailsDrawer(true); }}
                  data-testid={`card-todo-${todo.id}`}
                >
                  <div className="flex items-center gap-2">
                    {/* Photo thumbnail if available - 60px square */}
                    {todo.photo && (
                      <div
                        className="flex-shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden bg-muted cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLocation(`/photo/${todo.photoId}/view`);
                        }}
                        data-testid={`img-todo-photo-${todo.id}`}
                      >
                        <img
                          src={todo.photo.url}
                          alt="Todo photo"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}

                    {/* Content - flex-1 to take remaining space */}
                    <div className="flex-1 min-w-0">
                      <h3
                        className={`font-medium text-sm leading-snug ${todo.completed ? 'line-through' : ''}`}
                        data-testid={`text-todo-title-${todo.id}`}
                      >
                        {todo.title}
                      </h3>
                      
                      {/* Only show project if viewing all projects */}
                      {filterProject === 'all' && todo.project && (
                        <p className="text-xs text-muted-foreground leading-none mt-0.5" data-testid={`text-todo-project-${todo.id}`}>
                          {todo.project.name}
                        </p>
                      )}
                    </div>

                    {/* Completion checkbox - RIGHT side (44x44pt minimum) */}
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
                      className="flex-shrink-0 h-11 w-11"
                      data-testid={`checkbox-todo-complete-${todo.id}`}
                    />

                    {/* Three-dot menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-12 w-12 flex-shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`button-menu-todo-${todo.id}`}
                        >
                          <MoreVertical className="w-5 h-5" />
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
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="max-w-screen-sm mx-auto p-4 space-y-3">
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : todos.length === 0 ? (
            <div className="text-center py-12">
              <CheckSquare className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">No tasks yet</h2>
              <p className="text-muted-foreground">
                {view === 'my-tasks' ? 'You have no assigned tasks' :
                 view === 'team-tasks' ? 'Your team has no tasks' :
                 'You haven\'t created any tasks'}
              </p>
            </div>
          ) : (
            todos.map((todo) => (
              <Card
                key={todo.id}
                className={`hover-elevate cursor-pointer ${todo.completed ? 'opacity-60' : ''} ${todo.photo ? 'px-2 py-2' : 'px-3 py-1'}`}
                onClick={() => { setSelectedTodoForDetails(todo); setShowDetailsDrawer(true); }}
                data-testid={`card-todo-${todo.id}`}
              >
                <div className="flex items-center gap-2">
                  {/* Photo thumbnail if available - 60px square */}
                  {todo.photo && (
                    <div
                      className="flex-shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden bg-muted cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        setLocation(`/photo/${todo.photoId}/view`);
                      }}
                      data-testid={`img-todo-photo-${todo.id}`}
                    >
                      <img
                        src={todo.photo.url}
                        alt="Todo photo"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Content - flex-1 to take remaining space */}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={`font-medium text-sm leading-snug ${todo.completed ? 'line-through' : ''}`}
                      data-testid={`text-todo-title-${todo.id}`}
                    >
                      {todo.title}
                    </h3>
                    
                    {/* Secondary info - assignee and due date */}
                    <p className="text-xs text-muted-foreground leading-none mt-0.5">
                      {todo.assignee && (
                        <span>Assigned to: {getDisplayName(todo.assignee)}</span>
                      )}
                      {todo.assignee && todo.dueDate && <span> • </span>}
                      {todo.dueDate && (
                        <span>Due: {format(new Date(todo.dueDate), 'MMM d')}</span>
                      )}
                    </p>
                  </div>

                  {/* Completion checkbox - RIGHT side (44x44pt minimum) */}
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
                    className="flex-shrink-0 h-11 w-11"
                    data-testid={`checkbox-todo-complete-${todo.id}`}
                  />

                  {/* Three-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-12 w-12 flex-shrink-0"
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`button-menu-todo-${todo.id}`}
                      >
                        <MoreVertical className="w-5 h-5" />
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
            ))
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
            {/* Photo if attached - large display */}
            {selectedTodoForDetails?.photo && (
              <img 
                src={selectedTodoForDetails.photo.url} 
                alt="Task photo"
                className="w-full h-48 object-cover rounded-lg" 
                data-testid="img-task-detail-photo"
              />
            )}
            
            {/* Title - bold, large */}
            <h2 className="text-xl font-bold" data-testid="text-task-detail-title">
              {selectedTodoForDetails?.title}
            </h2>
            
            {/* Metadata with icons */}
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
          
          {/* Action buttons at bottom - Edit LEFT, Complete RIGHT */}
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

      {/* Add/Edit Todo Dialog - SIMPLIFIED FORM */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
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
            <DialogTitle>{editingTodo ? "Edit To-Do" : "Create To-Do"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
            
            {/* 1. PHOTO FIRST - At the very top */}
            <div>
              <Label>Attach Photo (optional)</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraClick}
                  className="flex-1 h-12"
                  data-testid="button-camera"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-12"
                  data-testid="button-album"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  From Album
                </Button>
              </div>
              
              {uploadPhotoMutation.isPending && (
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span>Uploading photo...</span>
                </div>
              )}

              {selectedPhotoUrl && !uploadPhotoMutation.isPending && (
                <div className="mt-3 relative rounded-md overflow-hidden border">
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

            {/* 2. TITLE - Only required field */}
            <div>
              <Label htmlFor="title">What needs to be done? *</Label>
              <Input
                id="title"
                {...form.register("title")}
                placeholder="Sweep upstairs"
                className="h-12 mt-2"
                data-testid="input-todo-title"
              />
              {form.formState.errors.title && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.title.message}</p>
              )}
            </div>

            {/* 3. ASSIGN TO - Optional */}
            <div>
              <Label htmlFor="assignedTo">Assign to (optional)</Label>
              <Select onValueChange={(value) => form.setValue("assignedTo", value)} value={form.watch("assignedTo") || undefined}>
                <SelectTrigger id="assignedTo" className="h-12 mt-2" data-testid="select-todo-assignee">
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

            {/* 4. DUE DATE - Optional, native HTML5 date picker */}
            <div>
              <Label htmlFor="dueDate">Due Date (optional)</Label>
              <Input
                id="dueDate"
                type="date"
                {...form.register("dueDate")}
                className="h-12 mt-2 w-full"
                data-testid="input-due-date"
              />
            </div>

            {/* Project selector - optional, hidden if in project context */}
            <div>
              <Label htmlFor="projectId">Project (optional)</Label>
              <Select onValueChange={(value) => form.setValue("projectId", value)} value={form.watch("projectId") || undefined}>
                <SelectTrigger id="projectId" className="h-12 mt-2" data-testid="select-todo-project">
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
                setShowAddDialog(false);
                setShowEditDialog(false);
                setEditingTodo(null);
              }} className="h-12">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending}
                className="h-12"
                data-testid="button-submit-todo"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                ) : null}
                {editingTodo ? "Update To-Do" : "Create To-Do"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
