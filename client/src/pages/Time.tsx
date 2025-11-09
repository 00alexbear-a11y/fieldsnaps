import { Link } from "wouter";
import { ClockStatusCard } from "@/components/ClockStatusCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, ArrowRight } from "lucide-react";

export default function Time() {
  return (
    <div className="flex flex-col h-full overflow-y-auto pb-32 bg-white dark:bg-black">
      {/* Header */}
      <div className="p-4 space-y-2">
        <h1 className="text-2xl font-semibold" data-testid="text-time-heading">
          Time Tracking
        </h1>
        <p className="text-sm text-muted-foreground">
          Track your work hours and view timesheets
        </p>
      </div>

      {/* Clock In/Out Card */}
      <div className="px-4 pb-4">
        <ClockStatusCard />
      </div>

      {/* Quick Links */}
      <div className="px-4 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          Quick Links
        </h2>
        
        <Link href="/timesheets">
          <Card className="p-4 cursor-pointer hover-elevate active-elevate-2" data-testid="card-link-timesheets">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">View Timesheets</h3>
                  <p className="text-sm text-muted-foreground">
                    See weekly hours and export records
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-muted-foreground" />
            </div>
          </Card>
        </Link>
      </div>

      {/* Info Section */}
      <div className="px-4 pt-6 space-y-2">
        <p className="text-sm text-muted-foreground">
          Track your work hours throughout the day. Clock in when you start work, 
          take breaks as needed, and clock out when you're done.
        </p>
        <p className="text-sm text-muted-foreground">
          Your time entries are automatically saved and can be viewed in the 
          Timesheets section for reporting and payroll purposes.
        </p>
      </div>
    </div>
  );
}
