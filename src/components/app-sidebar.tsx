import { Link, useRouterState } from "@tanstack/react-router";
import { cases } from "@/lib/mock-data";
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

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Cases", url: "/cases", icon: FolderKanban },
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
            <span className="text-xs opacity-70">v0.4</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
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

        <SidebarGroup>
          <SidebarGroupLabel>Open Cases</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {cases.map((c) => (
                <SidebarMenuItem key={c.id}>
                  <SidebarMenuButton asChild isActive={pathname.startsWith(`/cases/${c.id}`)}>
                    <Link to="/cases/$caseId" params={{ caseId: c.id }} className="flex items-center gap-2">
                      <FolderKanban className="h-4 w-4" />
                      <span className="truncate">{c.id} · {c.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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