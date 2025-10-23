import { RefreshCw } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface RefreshIndicatorProps {
  interval: number;
  onRefresh: () => void;
}

export const RefreshIndicator = ({ interval, onRefresh }: RefreshIndicatorProps) => {
  const [timeLeft, setTimeLeft] = useState(interval);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          setIsRefreshing(true);
          onRefreshRef.current();
          setTimeout(() => setIsRefreshing(false), 500);
          return interval;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interval]);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
      <RefreshCw
        className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-primary' : 'text-foreground'}`}
      />
      <span className="text-foreground">Auto-refresh in {timeLeft}s</span>
    </div>
  );
};
