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
    label: "Main",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard },
      { title: "Cases", url: "/cases", icon: FolderKanban },
    ],
  },
  {
    label: "Evidence",
    items: [
      { title: "Upload Evidence", url: "/evidence/upload", icon: Upload },
      { title: "Hash Check", url: "/evidence/integrity", icon: ShieldCheck },
      { title: "Chain of Custody", url: "/custody", icon: ScrollText },
    ],
  },
  {
    label: "Analysis Modules",
    items: [
      { title: "Financial Anomaly", url: "/analysis/financial", icon: Banknote },
      { title: "Log Analysis", url: "/analysis/logs", icon: Activity },
      { title: "OCR / Chat", url: "/analysis/ocr", icon: ScanText, planned: true },
      { title: "Deepfake Check", url: "/analysis/deepfake", icon: Video, planned: true },
    ],
  },
  {
    label: "Output",
    items: [
      { title: "Timeline", url: "/timeline", icon: Clock },
      { title: "Report", url: "/report", icon: FileText },
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
          <Shield className="h-5 w-5" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">IntelTrace</span>
            <span className="text-xs opacity-70">Mini Project v0.4</span>
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
                        {"planned" in item && item.planned && (
                          <span className="ml-auto text-[10px] opacity-60">soon</span>
                        )}
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