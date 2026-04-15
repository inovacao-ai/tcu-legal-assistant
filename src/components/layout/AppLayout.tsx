import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import SourcePanel from "./SourcePanel";

interface Source {
  id: string;
  type: string;
  title: string;
  excerpt: string;
  reference: string;
  url?: string;
}

interface AppLayoutProps {
  children: ReactNode;
  sources?: Source[];
  activeSourceId?: string | null;
  showSourcePanel?: boolean;
}

const AppLayout = ({ children, sources = [], activeSourceId, showSourcePanel = true }: AppLayoutProps) => {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
      {showSourcePanel && (
        <SourcePanel sources={sources} activeSourceId={activeSourceId} />
      )}
    </div>
  );
};

export default AppLayout;
