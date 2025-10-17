import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CheckSquare, Plus, Check, X, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
    
    createMutation.mutate(payload);
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
        <div className="flex items-center justify-between p-4 max-w-screen-sm mx-auto">
          <h1 className="text-2xl font-bold">To-Do</h1>
          <Button
            onClick={() => setShowAddDialog(true)}
            className="h-12 px-6"
            data-testid="button-add-todo"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add To-Do
          </Button>
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
              className={`p-4 hover-elevate ${todo.completed ? 'opacity-60' : ''}`}
              data-testid={`card-todo-${todo.id}`}
            >
              <div className="flex items-start gap-3">
                {/* Photo thumbnail if available */}
                {todo.photo && (
                  <div
                    className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted cursor-pointer"
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

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3
                    className={`font-semibold mb-1 ${todo.completed ? 'line-through' : ''}`}
                    data-testid={`text-todo-title-${todo.id}`}
                  >
                    {todo.title}
                  </h3>
                  {todo.description && (
                    <p className="text-sm text-muted-foreground mb-2" data-testid={`text-todo-description-${todo.id}`}>
                      {todo.description}
                    </p>
                  )}
                  
                  {/* Meta info */}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {todo.project && (
                      <span className="bg-muted px-2 py-1 rounded" data-testid={`text-todo-project-${todo.id}`}>
                        {todo.project.name}
                      </span>
                    )}
                    <span data-testid={`text-todo-assignee-${todo.id}`}>
                      Assigned to: {getDisplayName(todo.assignee)}
                    </span>
                    <span data-testid={`text-todo-creator-${todo.id}`}>
                      By: {getDisplayName(todo.creator)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex gap-2">
                  {!todo.completed ? (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => completeMutation.mutate(todo.id)}
                      disabled={completeMutation.isPending}
                      data-testid={`button-complete-todo-${todo.id}`}
                    >
                      <Check className="w-5 h-5 text-green-600" />
                    </Button>
                  ) : (
                    <div className="px-3 py-2 bg-green-100 dark:bg-green-900 rounded text-green-700 dark:text-green-300 text-xs font-medium">
                      Done
                    </div>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => deleteMutation.mutate(todo.id)}
                    disabled={deleteMutation.isPending}
                    data-testid={`button-delete-todo-${todo.id}`}
                  >
                    <X className="w-5 h-5 text-destructive" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Add Todo Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create To-Do</DialogTitle>
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
                  {members.map((member: any) => (
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-todo">
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
