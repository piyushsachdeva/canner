import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowUpDown } from "lucide-react";
import { useState } from "react";

export interface EndpointData {
  id: string;
  endpoint: string;
  method: string;
  requests: number;
  avgLatency: number;
  errorRate: number;
}

interface EndpointsTableProps {
  data: EndpointData[];
}

type SortKey = keyof EndpointData;
type SortOrder = "asc" | "desc";

export const EndpointsTable = ({ data }: EndpointsTableProps) => {
  const [sortKey, setSortKey] = useState<SortKey>("requests");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortOrder("desc");
    }
  };

  const sortedData = [...data].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    const modifier = sortOrder === "asc" ? 1 : -1;
    
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * modifier;
    }
    return ((aVal as number) - (bVal as number)) * modifier;
  });

  const getMethodColor = (method: string) => {
    const colors: Record<string, string> = {
      GET: "bg-success/10 text-success border-success/20",
      POST: "bg-primary/10 text-primary border-primary/20",
      PUT: "bg-warning/10 text-warning border-warning/20",
      DELETE: "bg-destructive/10 text-destructive border-destructive/20",
    };
    return colors[method] || "bg-muted text-muted-foreground";
  };

  const getErrorRateColor = (rate: number) => {
    if (rate < 1) return "text-success";
    if (rate < 5) return "text-warning";
    return "text-destructive";
  };

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-card border-border shadow-sm p-8">
        <div className="text-center text-muted-foreground">
          <p className="text-lg font-medium mb-2">No endpoints found</p>
          <p className="text-sm">Endpoints will appear here once they start receiving requests</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card border-border shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-muted/50 transition-colors">
            <TableHead className="w-[100px] font-semibold text-foreground">Method</TableHead>
            <TableHead>
              <button
                onClick={() => handleSort("endpoint")}
                className="flex items-center gap-1 hover:text-foreground transition-colors font-semibold text-foreground"
              >
                Endpoint
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead className="text-right font-semibold text-foreground">
              <button
                onClick={() => handleSort("requests")}
                className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold text-foreground"
              >
                Requests
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead className="text-right font-semibold text-foreground">
              <button
                onClick={() => handleSort("avgLatency")}
                className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold text-foreground"
              >
                Avg Latency
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead className="text-right font-semibold text-foreground">
              <button
                onClick={() => handleSort("errorRate")}
                className="flex items-center gap-1 ml-auto hover:text-foreground transition-colors font-semibold text-foreground"
              >
                Error Rate
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row) => (
            <TableRow key={row.id} className="hover:bg-muted/50 transition-colors border-b border-border">
              <TableCell>
                <Badge variant="outline" className={getMethodColor(row.method)}>
                  {row.method}
                </Badge>
              </TableCell>
              <TableCell className="font-mono text-sm text-foreground">{row.endpoint}</TableCell>
              <TableCell className="text-right font-medium text-foreground">
                {row.requests.toLocaleString()}
              </TableCell>
              <TableCell className="text-right text-foreground">
                <span className="font-medium">{row.avgLatency}ms</span>
              </TableCell>
              <TableCell className="text-right text-foreground">
                <span className={`font-semibold ${getErrorRateColor(row.errorRate)}`}>
                  {row.errorRate.toFixed(2)}%
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
