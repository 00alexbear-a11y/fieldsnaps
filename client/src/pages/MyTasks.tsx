import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CheckCircle, Circle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

type TaskWithProject = {
  id: string;
  projectId: string;
  taskName: string;
  assignedTo: string;
  createdBy: string;
  completed: boolean;
  completedAt: string | null;
  completedBy: string | null;
  createdAt: string;
  project: {
    id: string;
    name: string;
  };
};

export default function MyTasks() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: tasks = [], isLoading } = useQuery<TaskWithProject[]>({
    queryKey: ["/api/tasks/my-tasks"],
    queryFn: async () => {
      const response = await fetch("/api/tasks/my-tasks", {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to fetch tasks");
      }
      return response.json();
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/complete`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
      toast({ 
        title: "Task completed",
        duration: 1500,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to complete task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const restoreTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest("POST", `/api/tasks/${taskId}/restore`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks/my-tasks"] });
      toast({ 
        title: "Task restored",
        duration: 1500,
      });
    },
    onError: (error: any) => {
      toast({ 
        title: "Failed to restore task", 
        description: error.message,
        variant: "destructive" 
      });
    },
  });

  const activeTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <div className="h-screen flex flex-col overflow-auto pb-20">
      <header className="border-b px-4 py-3 bg-background sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">My Tasks</h1>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-6">
        {isLoading ? (
          <div className="text-center py-12">Loading tasks...</div>
        ) : (
          <>
            {/* Active Tasks */}
            <section>
              <h2 className="text-lg font-semibold mb-3">Active Tasks ({activeTasks.length})</h2>
              {activeTasks.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Circle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No active tasks</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activeTasks.map((task) => (
                    <Card 
                      key={task.id} 
                      className="hover-elevate transition-all duration-200"
                      data-testid={`task-card-${task.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => completeTaskMutation.mutate(task.id)}
                            disabled={completeTaskMutation.isPending}
                            className="mt-0.5"
                            data-testid={`button-complete-${task.id}`}
                          >
                            <Circle className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium" data-testid={`task-name-${task.id}`}>
                              {task.taskName}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                data-testid={`task-project-${task.id}`}
                              >
                                {task.project.name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(task.createdAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            {/* Completed Tasks */}
            {completedTasks.length > 0 && (
              <section>
                <h2 className="text-lg font-semibold mb-3">Completed ({completedTasks.length})</h2>
                <div className="space-y-2">
                  {completedTasks.map((task) => (
                    <Card 
                      key={task.id} 
                      className="opacity-60 hover:opacity-100 transition-opacity"
                      data-testid={`task-card-completed-${task.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <button
                            onClick={() => restoreTaskMutation.mutate(task.id)}
                            disabled={restoreTaskMutation.isPending}
                            className="mt-0.5"
                            data-testid={`button-restore-${task.id}`}
                          >
                            <CheckCircle className="w-5 h-5 text-primary" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium line-through" data-testid={`task-name-completed-${task.id}`}>
                              {task.taskName}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge 
                                variant="outline" 
                                className="text-xs"
                                data-testid={`task-project-completed-${task.id}`}
                              >
                                {task.project.name}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Completed {format(new Date(task.completedAt!), 'MMM d, yyyy')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
