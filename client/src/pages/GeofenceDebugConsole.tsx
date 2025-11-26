import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft,
  RefreshCw,
  Copy,
  Trash2,
  MapPin,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
  CheckCircle2,
  Info,
  Bug,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { debugLog, type DebugLogEntry } from "@/lib/geofenceDebugLog";
import { getFailedOperationsQueue, processFailedOperationsQueue } from "@/lib/geofencing";

export default function GeofenceDebugConsole() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [failedOps, setFailedOps] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info' | 'debug'>('all');

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const entries = await debugLog.getLogs();
      setLogs(entries);
      setFailedOps(getFailedOperationsQueue());
    } catch (error) {
      console.error("Failed to load logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleCopyLogs = async () => {
    try {
      const logText = logs.map(log => 
        `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${log.details ? ` ${log.details}` : ''}${log.stackTrace ? `\nStack: ${log.stackTrace}` : ''}`
      ).join('\n');
      
      await navigator.clipboard.writeText(logText);
      toast({
        title: "Copied",
        description: `${logs.length} log entries copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy logs to clipboard",
        variant: "destructive",
      });
    }
  };

  const handleClearLogs = async () => {
    try {
      await debugLog.clear();
      setLogs([]);
      toast({
        title: "Cleared",
        description: "All debug logs have been cleared",
      });
    } catch (error) {
      toast({
        title: "Clear Failed",
        description: "Unable to clear logs",
        variant: "destructive",
      });
    }
  };

  const handleRetryFailedOps = async () => {
    try {
      await processFailedOperationsQueue();
      setFailedOps(getFailedOperationsQueue());
      toast({
        title: "Retry Complete",
        description: "Failed operations have been retried",
      });
      loadLogs();
    } catch (error) {
      toast({
        title: "Retry Failed",
        description: "Unable to process failed operations",
        variant: "destructive",
      });
    }
  };

  const toggleLogExpand = (index: number) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <AlertCircle className="h-3.5 w-3.5 text-red-500" />;
      case 'warn':
        return <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />;
      case 'info':
        return <Info className="h-3.5 w-3.5 text-blue-500" />;
      case 'debug':
        return <Bug className="h-3.5 w-3.5 text-gray-500" />;
      default:
        return null;
    }
  };

  const getLevelBadgeVariant = (level: string) => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warn':
        return 'secondary';
      case 'info':
        return 'default';
      case 'debug':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'geofence':
        return <MapPin className="h-3 w-3" />;
      case 'clock':
        return <Clock className="h-3 w-3" />;
      case 'network':
        return <Wifi className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.level === filter);

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit',
        hour12: false,
      });
    } catch {
      return timestamp;
    }
  };

  if (!Capacitor.isNativePlatform()) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Bug className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">Debug Console</h2>
            <p className="text-muted-foreground text-sm">
              The debug console is only available on native iOS/Android devices where geofencing is active.
            </p>
            <Button 
              variant="outline" 
              className="mt-4"
              onClick={() => setLocation("/settings")}
            >
              Back to Settings
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col" data-testid="page-debug-console">
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/settings")}
              data-testid="button-back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold ml-2">Debug Console</h1>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={loadLogs}
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopyLogs}
              data-testid="button-copy"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearLogs}
              data-testid="button-clear"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {failedOps.length > 0 && (
          <div className="p-3 border-b border-border bg-orange-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WifiOff className="h-4 w-4 text-orange-500" />
                <span className="text-sm font-medium text-orange-700 dark:text-orange-400">
                  {failedOps.length} queued operation{failedOps.length > 1 ? 's' : ''}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRetryFailedOps}
                data-testid="button-retry-ops"
              >
                Retry Now
              </Button>
            </div>
          </div>
        )}

        <div className="px-3 py-2 border-b border-border flex gap-1 overflow-x-auto">
          {(['all', 'error', 'warn', 'info', 'debug'] as const).map(level => (
            <Button
              key={level}
              variant={filter === level ? 'default' : 'ghost'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setFilter(level)}
              data-testid={`button-filter-${level}`}
            >
              {level === 'all' && 'All'}
              {level === 'error' && (
                <>
                  <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                  Errors ({logs.filter(l => l.level === 'error').length})
                </>
              )}
              {level === 'warn' && (
                <>
                  <AlertCircle className="h-3 w-3 mr-1 text-yellow-500" />
                  Warnings
                </>
              )}
              {level === 'info' && (
                <>
                  <Info className="h-3 w-3 mr-1 text-blue-500" />
                  Info
                </>
              )}
              {level === 'debug' && (
                <>
                  <Bug className="h-3 w-3 mr-1" />
                  Debug
                </>
              )}
            </Button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                {isLoading ? 'Loading logs...' : 'No logs to display'}
              </div>
            ) : (
              filteredLogs.map((log, index) => {
                const isExpanded = expandedLogs.has(index);
                const hasDetails = log.details || log.stackTrace;
                
                return (
                  <div
                    key={index}
                    className="bg-muted/30 rounded-lg p-2 text-xs font-mono"
                    data-testid={`log-entry-${index}`}
                  >
                    <div 
                      className="flex items-start gap-2 cursor-pointer"
                      onClick={() => hasDetails && toggleLogExpand(index)}
                    >
                      <span className="text-muted-foreground flex-shrink-0">
                        {formatTime(log.timestamp)}
                      </span>
                      {getLevelIcon(log.level)}
                      <Badge 
                        variant={getLevelBadgeVariant(log.level) as any}
                        className="text-[10px] py-0 px-1 h-4 flex-shrink-0"
                      >
                        {log.category}
                      </Badge>
                      <span className="flex-1 break-words">{log.message}</span>
                      {hasDetails && (
                        <span className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                        </span>
                      )}
                    </div>
                    
                    {isExpanded && hasDetails && (
                      <div className="mt-2 pl-4 border-l-2 border-muted space-y-1">
                        {log.details && (
                          <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                            {log.details}
                          </pre>
                        )}
                        {log.stackTrace && (
                          <div className="text-red-500 text-[10px]">
                            Stack: {log.stackTrace}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3 bg-muted/30">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{filteredLogs.length} entries</span>
            <span>Max 100 stored</span>
          </div>
        </div>
      </div>
    </div>
  );
}
