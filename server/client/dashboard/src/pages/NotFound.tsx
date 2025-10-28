import { useLocation, Link } from "react-router-dom";
import { Home } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  if (process.env.NODE_ENV === "development") {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center max-w-md p-6">
        <h1 className="mb-4 text-6xl font-bold text-foreground">404</h1>
        <p className="mb-2 text-2xl font-semibold text-foreground">Page not found</p>
        <p className="mb-6 text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <Home className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
