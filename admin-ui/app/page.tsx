"use client";

import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Toolbar,
  Typography,
} from "@mui/material";
import { Grid2x2, RefreshCw, SquareStack, Table2, Users2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DashboardPanels } from "../components/dashboard/dashboard-panels";
import { MuiDialogShell } from "../components/common/mui-dialog-shell";
import { WorkspaceDrawer } from "../components/workspace/workspace-drawer";
import { useWorkspace } from "../hooks/useWorkspace";

export default function HomePage() {
  const ws = useWorkspace();
  const [dialogOpen, setDialogOpen] = useState(false);
  const dashboardMetrics = [
    { label: "Groups", value: String(ws.appStatus.storage?.groups || 0), note: "Workspace nguồn đã tạo", icon: Grid2x2, tone: "blue" },
    { label: "Topics", value: String(ws.appStatus.storage?.topics || 0), note: "Mini-workspace theo topic", icon: Table2, tone: "cyan" },
    { label: "Campaigns", value: String(ws.appStatus.storage?.items || 0), note: "Campaign con đang lưu", icon: SquareStack, tone: "emerald" },
    { label: "Events", value: String(ws.appStatus.storage?.events || 0), note: "Log runtime hiện có", icon: Users2, tone: "amber" },
  ] as const;

  return (
    <Box className="app-shell">
      <Box className="sidebar">
        <Box className="sidebar-inner">
          <Box className="brand-box">
            <Box className="brand-dot" />
            <Box>
              <Box className="brand-title">Tele Content</Box>
              <Box className="brand-subtitle">prive_bot inspired UI</Box>
            </Box>
          </Box>

          <Box>
            {[
              { title: "VẬN HÀNH", items: [{ label: "Dashboard", count: String(ws.appStatus.storage?.groups || 0), view: "dashboard" }, { label: "Workspace", count: String(ws.groups.length), view: "workspace" }] },
              { title: "CẤU HÌNH", items: [{ label: "Settings", count: "", view: "settings" }] },
            ].map((section) => (
              <Box key={section.title} sx={{ mb: 1.5 }}>
                <Box className="nav-section-title">{section.title}</Box>
                <Stack gap={0.75}>
                  {section.items.map((item) => (
                    <Button key={item.label} className={`nav-item ${false ? "active" : ""}`} variant="text">
                      <span>{item.label}</span>
                      {item.count ? <span className="nav-badge">{item.count}</span> : <span />}
                    </Button>
                  ))}
                </Stack>
              </Box>
            ))}
          </Box>

          <Box className="sidebar-footer">
            <Box className="sidebar-quick">
              <Typography sx={{ fontWeight: 800, mb: 1, color: "#f8fafc" }}>QUICK ACTIONS</Typography>
              <Stack gap={1}>
                <Button fullWidth variant="outlined" sx={{ color: "#e2e8f0", borderColor: "rgba(255,255,255,0.14)" }} onClick={() => ws.setDrawerOpen(true)}>
                  Mở Workspace
                </Button>
                <Button fullWidth variant="outlined" sx={{ color: "#e2e8f0", borderColor: "rgba(255,255,255,0.14)" }} component={Link} href="/settings">
                  Đi tới Settings
                </Button>
                <Button fullWidth variant="outlined" sx={{ color: "#e2e8f0", borderColor: "rgba(255,255,255,0.14)" }} onClick={() => setDialogOpen(true)}>
                  Mở Dialog mẫu
                </Button>
              </Stack>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box className="content-shell">
        <AppBar position="sticky" elevation={0} color="transparent" sx={{ borderBottom: "1px solid rgba(148,163,184,0.14)", backdropFilter: "blur(10px)", background: "rgba(238,242,247,0.84)" }}>
          <Toolbar sx={{ minHeight: 76, px: 0, display: "flex", justifyContent: "space-between", gap: 2 }}>
            <Box className="topbar-left">
              <Box className="eyebrow">ADMIN CP</Box>
              <Box>
                <Box className="page-title">Tele Content Hub</Box>
                <Box className="page-subtitle">Bắt đầu bằng Dashboard, rồi Workspace table/filter, cuối cùng là Settings và modal/dialog.</Box>
              </Box>
            </Box>
            <Box className="topbar-right">
              <Chip label={ws.appStatus.db_mode || "loading"} variant="outlined" className="soft-chip" />
              <Chip label={ws.appStatus.database_url_set ? "Supabase Ready" : "SQLite Mode"} variant="outlined" className="soft-chip" />
              <Chip label={ws.appStatus.string_session ? "TG Session Ready" : "TG Session Missing"} variant="outlined" className="soft-chip" />
              <Button component={Link} href="/login" variant="outlined">
                Login
              </Button>
              <Button component={Link} href="/settings" variant="outlined">
                Settings
              </Button>
              <Button variant="outlined" startIcon={<RefreshCw size={16} />} onClick={() => void ws.refreshAll()} disabled={ws.loading}>
                Refresh
              </Button>
              <Avatar sx={{ width: 36, height: 36, bgcolor: "#2f80ff" }}>M</Avatar>
            </Box>
          </Toolbar>
        </AppBar>

        {ws.notice.text ? (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 3, border: "1px solid", borderColor: ws.notice.type === "error" ? "rgba(244, 63, 94, 0.25)" : "rgba(34,197,94,0.25)", bgcolor: ws.notice.type === "error" ? "#fff1f2" : "#ecfdf3", color: ws.notice.type === "error" ? "#be123c" : "#047857" }}>
            {ws.notice.text}
          </Box>
        ) : null}

        <Box sx={{ mt: 2 }}>
          <DashboardPanels appStatus={ws.appStatus} metrics={dashboardMetrics} onGoWorkspace={() => ws.setDrawerOpen(true)} onGoSettings={() => window.location.assign("/settings")} />
        </Box>
        <WorkspaceDrawer
          open={ws.drawerOpen}
          onClose={ws.closeDrawer}
          activeGroup={ws.activeGroup}
          groupProgress={ws.groupProgress}
          groupLogs={ws.groupLogs}
          showGroupLogs={ws.showGroupLogs}
          setShowGroupLogs={ws.setShowGroupLogs}
          groupAutoForm={ws.groupAutoForm}
          setGroupAutoForm={ws.setGroupAutoForm}
          toggleGroupAuto={() => void ws.toggleGroupAuto()}
          saveGroupAuto={() => void ws.saveGroupAuto()}
          groups={ws.groups}
          activeGroupId={ws.activeGroup?.id || null}
          queue={ws.queue}
          groupForm={ws.groupForm}
          setGroupForm={ws.setGroupForm}
          onCreateGroup={() => void ws.createGroup()}
          onOpenGroup={(group) => void ws.openGroup(group)}
          onDeleteGroup={(groupId) => void ws.deleteGroup(groupId)}
          filteredTopics={ws.filteredTopics}
          selectedTopic={ws.selectedTopic}
          topicSearch={ws.topicSearch}
          setTopicSearch={ws.setTopicSearch}
          topicFilter={ws.topicFilter}
          setTopicFilter={ws.setTopicFilter}
          topicForm={ws.topicForm}
          setTopicForm={ws.setTopicForm}
          onCreateTopic={() => void ws.createTopic()}
          onSelectTopic={(topic) => void ws.selectTopic(topic)}
          onRenameTopic={(topic) => void ws.renameTopic(topic)}
          onDeleteTopic={(topicId) => void ws.deleteTopic(topicId)}
          items={ws.items}
          onEditItem={(item) => ws.editItem(item)}
          onRunItem={(itemId, full) => void ws.runItem(itemId, Boolean(full))}
          onStopItem={(itemId) => void ws.stopItem(itemId)}
          onResetItem={(itemId) => void ws.resetItem(itemId)}
          onDeleteItem={(itemId) => void ws.deleteItem(itemId)}
          onViewLog={(itemId) => void ws.viewItemLog(itemId)}
        />

        <MuiDialogShell open={dialogOpen} onClose={() => setDialogOpen(false)} title="MuiDialogShell" subtitle="Dialog mẫu theo style prive_bot" actionLabel="Lưu">
          <Stack gap={2}>
            <TextField label="Tên cấu hình" fullWidth defaultValue="Tele Content" />
            <TextField label="Ghi chú" fullWidth multiline minRows={4} defaultValue="Skeleton dialog cho màn cấu hình, xác nhận và editor." />
          </Stack>
        </MuiDialogShell>
      </Box>
    </Box>
  );
}
