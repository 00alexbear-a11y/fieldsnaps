import { Bell } from "lucide-react";

export default function Inbox() {
  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b pt-safe-3 pb-3">
        <div className="flex items-center justify-between px-4 max-w-screen-sm mx-auto">
          <h1 className="text-2xl font-bold">Notifications</h1>
        </div>
      </div>

      {/* Placeholder Content */}
      <div className="flex flex-col items-center justify-center py-24 px-4">
        <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-8 text-center max-w-md">
          <Bell className="w-16 h-16 mb-4 text-muted-foreground mx-auto" />
          <h2 className="text-xl font-semibold mb-2">No notifications</h2>
          <p className="text-muted-foreground">
            Task assignments and mentions will appear here
          </p>
        </div>
      </div>
    </div>
  );
}
