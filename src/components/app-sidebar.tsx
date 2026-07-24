import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  Upload,
  ShieldCheck,
  Banknote,
  Activity,
  ScanText,
  Video,
  Clock,
  ScrollText,
  FileText,
  LogOut,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";

const groups = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Cases", url: "/cases", icon: FolderKanban },
    ],
  },
  {
    label: "Evidence",
    items: [
      { title: "Upload", url: "/evidence/upload", icon: Upload },
      { title: "Integrity", url: "/evidence/integrity", icon: ShieldCheck },
      { title: "Chain of Custody", url: "/custody", icon: ScrollText },
    ],
  },
  {
    label: "AI Analysis",
    items: [
      { title: "Financial Anomalies", url: "/analysis/financial", icon: Banknote },
      { title: "System Logs", url: "/analysis/logs", icon: Activity },
      { title: "OCR & Chat", url: "/analysis/ocr", icon: ScanText },
      { title: "Deepfake Check", url: "/analysis/deepfake", icon: Video },
    ],
  },
  {
    label: "Reporting",
    items: [
      { title: "Timeline", url: "/timeline", icon: Clock },
      { title: "Forensic Report", url: "/report", icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (url: string) =>
    url === "/" ? pathname === "/" : pathname.startsWith(url);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/30">
            <Shield className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold tracking-wide">IntelTrace</span>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Forensic Console
            </span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {groups.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={isActive(item.url)}>
                      <Link to={item.url} className="flex items-center gap-2">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link to="/login" className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                <span>Sign out</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}