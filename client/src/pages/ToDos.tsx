import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon, MoreVertical, Settings, Camera, Upload, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  description: z.string().optional(),
  projectId: z.string().optional(),
  assignedTo: z.string().min(1, "Assignee is required"),
  dueDate: z.string().optional(),
});

type CreateTodoForm = z.infer<typeof createTodoSchema>;

type TodoWithDetails = ToDo & {
  project?: { id: string; name: string };
  photo?: { id: string; url: string };
  assignee: { id: string; firstName: string | null; lastName: string | null };
  creator: { id: string; firstName: string | null; lastName: string | null };
};

export default function ToDos() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [view, setView] = useState<'my-tasks' | 'team-tasks' | 'i-created'>('my-tasks');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterCompleted, setFilterCompleted] = useState<string>('active');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingTodo, setEditingTodo] = useState<TodoWithDetails | null>(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch todos
  const { data: todos = [], isLoading } = useQuery<TodoWithDetails[]>({
    queryKey: ['/api/todos', view, filterProject, filterCompleted],
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
      queryClient.invalidateQueries({ queryKey: ['/api/todos'] });
      toast({ title: "To-do completed!" });
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
        : '/api/photos/standalone'; // Will need to create this endpoint
      
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
      description: "",
      projectId: "",
      assignedTo: "",
      dueDate: "",
    },
  });

  const handleSubmit = (data: CreateTodoForm) => {
    // Remove empty optional fields
    const payload: any = {
      title: data.title,
      assignedTo: data.assignedTo,
    };
    
    if (data.description) payload.description = data.description;
    if (data.projectId) payload.projectId = data.projectId;
    if (data.dueDate) payload.dueDate = data.dueDate;
    if (selectedPhotoId) payload.photoId = selectedPhotoId;
    
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
    const projectId = form.watch('projectId');
    // Navigate to camera with return URL
    setLocation(`/camera?projectId=${projectId || ''}&returnUrl=/todos`);
  };

  const handleEditTodo = (todo: TodoWithDetails) => {
    setEditingTodo(todo);
    form.reset({
      title: todo.title,
      description: todo.description || "",
      projectId: todo.projectId || "",
      assignedTo: todo.assignedTo,
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
                setDatePickerOpen(false);
                form.reset({
                  title: "",
                  description: "",
                  projectId: "",
                  assignedTo: "",
                  dueDate: "",
                });
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
              className={`hover-elevate ${todo.completed ? 'opacity-60' : ''} ${todo.photo ? 'px-2 py-2' : 'px-3 py-1'}`}
              data-testid={`card-todo-${todo.id}`}
            >
              <div className="flex items-center gap-2">
                {/* Photo thumbnail if available - 60px square */}
                {todo.photo && (
                  <div
                    className="flex-shrink-0 w-[60px] h-[60px] rounded-md overflow-hidden bg-muted cursor-pointer"
                    onClick={() => setLocation(`/photo/${todo.photoId}/view`)}
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

                {/* Three-dot menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-12 w-12 flex-shrink-0"
                      data-testid={`button-menu-todo-${todo.id}`}
                    >
                      <MoreVertical className="w-5 h-5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditTodo(todo)} data-testid={`menu-edit-todo-${todo.id}`}>
                      Edit
                    </DropdownMenuItem>
                    {!todo.completed && (
                      <DropdownMenuItem
                        onClick={() => completeMutation.mutate(todo.id)}
                        disabled={completeMutation.isPending}
                        data-testid={`menu-complete-todo-${todo.id}`}
                      >
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      onClick={() => deleteMutation.mutate(todo.id)}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        data-testid="input-file-photo"
      />

      {/* Add/Edit Todo Dialog */}
      <Dialog open={showAddDialog || showEditDialog} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setShowEditDialog(false);
          setEditingTodo(null);
          setSelectedPhotoId(null);
          setSelectedPhotoUrl(null);
          setDatePickerOpen(false);
          form.reset({
            title: "",
            description: "",
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
              <Label htmlFor="projectId">Project (optional)</Label>
              <Select onValueChange={(value) => form.setValue("projectId", value)} value={form.watch("projectId") || undefined}>
                <SelectTrigger id="projectId" data-testid="select-todo-project">
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

            <div>
              <Label htmlFor="assignedTo">Assign to *</Label>
              <Select onValueChange={(value) => form.setValue("assignedTo", value)} value={form.watch("assignedTo")}>
                <SelectTrigger id="assignedTo" data-testid="select-todo-assignee">
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
              {form.formState.errors.assignedTo && (
                <p className="text-sm text-destructive mt-1">{form.formState.errors.assignedTo.message}</p>
              )}
            </div>

            <div>
              <Label>Due Date (optional)</Label>
              <div className="flex gap-2 mt-2">
                <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex-1 justify-start text-left font-normal h-12"
                      data-testid="button-date-picker"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("dueDate") ? (
                        format(new Date(form.watch("dueDate")), "PPP")
                      ) : (
                        <span className="text-muted-foreground">Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("dueDate") ? new Date(form.watch("dueDate")) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          form.setValue("dueDate", format(date, "yyyy-MM-dd"));
                          setDatePickerOpen(false);
                        }
                      }}
                      initialFocus
                      data-testid="calendar-date-picker"
                    />
                  </PopoverContent>
                </Popover>
                
                {form.watch("dueDate") && (
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 flex-shrink-0"
                    onClick={() => form.setValue("dueDate", "")}
                    data-testid="button-clear-date"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div>
              <Label>Attach Photo (optional)</Label>
              <div className="flex gap-2 mt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCameraClick}
                  className="flex-1"
                  data-testid="button-camera"
                >
                  <Camera className="w-4 h-4 mr-2" />
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1"
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
            </div>

            <DialogFooter className="flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => {
                setShowAddDialog(false);
                setShowEditDialog(false);
                setEditingTodo(null);
                setDatePickerOpen(false);
              }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={createMutation.isPending || updateMutation.isPending} 
                data-testid="button-submit-todo"
              >
                {editingTodo 
                  ? (updateMutation.isPending ? "Updating..." : "Update")
                  : (createMutation.isPending ? "Creating..." : "Create")
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
