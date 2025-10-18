import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@/components/ui/select";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeSelector() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // useEffect only runs on the client, so now we can safely show the UI
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Select>
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Select theme" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={theme} onValueChange={setTheme}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Select theme">
          {theme === "light" && (
            <div className="flex items-center gap-2">
              <Sun className="h-4 w-4" />
              <span>Light</span>
            </div>
          )}
          {theme === "dark" && (
            <div className="flex items-center gap-2">
              <Moon className="h-4 w-4" />
              <span>Dark</span>
            </div>
          )}
          {theme === "system" && (
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4" />
              <span>System</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="light">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4" />
            <span>Light</span>
          </div>
        </SelectItem>
        <SelectItem value="dark">
          <div className="flex items-center gap-2">
            <Moon className="h-4 w-4" />
            <span>Dark</span>
          </div>
        </SelectItem>
        <SelectItem value="system">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            <span>System</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}