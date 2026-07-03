"use client";

import { Box, Button, Card, CardContent, Chip, Dialog, DialogContent, DialogTitle, Divider, Stack, TextField, Typography } from "@mui/material";
import { Filter, LayoutDashboard } from "lucide-react";
import { WorkspaceCampaignTable, WorkspaceGroupSidebar, WorkspaceTopicRail, type GroupRow, type ItemRow, type LogRow, type ProgressState, type QueueState, type TopicRow } from "./workspace-panels";

export function WorkspaceDrawer({
  open,
  onClose,
  activeGroup,
  groupProgress,
  groupLogs,
  showGroupLogs,
  setShowGroupLogs,
  groupAutoForm,
  setGroupAutoForm,
  toggleGroupAuto,
  saveGroupAuto,
  groups,
  activeGroupId,
  queue,
  groupForm,
  setGroupForm,
  onCreateGroup,
  onOpenGroup,
  onDeleteGroup,
  filteredTopics,
  selectedTopic,
  topicSearch,
  setTopicSearch,
  topicFilter,
  setTopicFilter,
  topicForm,
  setTopicForm,
  onCreateTopic,
  onSelectTopic,
  onRenameTopic,
  onDeleteTopic,
  items,
  onEditItem,
  onRunItem,
  onStopItem,
  onResetItem,
  onDeleteItem,
  onViewLog,
}: {
  open: boolean;
  onClose: () => void;
  activeGroup: GroupRow | null;
  groupProgress: ProgressState;
  groupLogs: LogRow[];
  showGroupLogs: boolean;
  setShowGroupLogs: (next: boolean) => void;
  groupAutoForm: { auto_enabled: boolean; auto_slots: string; auto_pick_count: number; auto_strategy: string };
  setGroupAutoForm: (next: { auto_enabled: boolean; auto_slots: string; auto_pick_count: number; auto_strategy: string }) => void;
  toggleGroupAuto: () => void;
  saveGroupAuto: () => void;
  groups: GroupRow[];
  activeGroupId: number | null;
  queue: QueueState;
  groupForm: { name: string; source_key: string; source_link: string; target_link: string };
  setGroupForm: (next: { name: string; source_key: string; source_link: string; target_link: string }) => void;
  onCreateGroup: () => void;
  onOpenGroup: (group: GroupRow) => void;
  onDeleteGroup: (groupId: number) => void;
  filteredTopics: TopicRow[];
  selectedTopic: TopicRow | null;
  topicSearch: string;
  setTopicSearch: (value: string) => void;
  topicFilter: string;
  setTopicFilter: (value: string) => void;
  topicForm: { name: string; topic_link: string; source_topic_id: number; target_topic_id: number; last_msg_id: number };
  setTopicForm: (next: { name: string; topic_link: string; source_topic_id: number; target_topic_id: number; last_msg_id: number }) => void;
  onCreateTopic: () => void;
  onSelectTopic: (topic: TopicRow) => void;
  onRenameTopic: (topic: TopicRow) => void;
  onDeleteTopic: (topicId: number) => void;
  items: ItemRow[];
  onEditItem: (item: ItemRow) => void;
  onRunItem: (itemId: number, full?: boolean) => void;
  onStopItem: (itemId: number) => void;
  onResetItem: (itemId: number) => void;
  onDeleteItem: (itemId: number) => void;
  onViewLog: (itemId: number) => void;
}) {
  const groupStatTiles = [
    ["Topics", groupProgress.total_topics || 0],
    ["Running", groupProgress.running_items || 0],
    ["Queue", groupProgress.queued_items || 0],
    ["Done", groupProgress.done_items || 0],
  ] as const;

  return (
    <Dialog open={open} fullScreen onClose={onClose} PaperProps={{ sx: { bgcolor: "#eef2f7" } }}>
      <DialogTitle sx={{ px: 3, py: 2, borderBottom: "1px solid rgba(148,163,184,0.18)" }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, letterSpacing: "-0.03em" }}>
              {activeGroup?.name || "Workspace"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              ID: {activeGroup?.source_key || "—"} · Topics {groupProgress.total_topics || 0} · Items {groupProgress.total_items || 0}
            </Typography>
          </Box>
          <Stack direction="row" gap={1}>
            <Button variant="outlined" onClick={() => setShowGroupLogs(!showGroupLogs)} startIcon={<Filter size={16} />}>
              {showGroupLogs ? "Ẩn log" : "Xem log"}
            </Button>
            <Button variant="outlined" onClick={onClose}>
              Đóng
            </Button>
          </Stack>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 2.5 }}>
        <Stack gap={1.5}>
          <Card className="panel-card">
            <CardContent sx={{ p: 2 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>Group overview</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Auto-run, trạng thái và nhịp vận hành.
                  </Typography>
                </Box>
                <Stack direction="row" gap={1}>
                  <Chip size="small" label={`Topics ${groupProgress.total_topics || 0}`} variant="outlined" />
                  <Chip size="small" label={`Items ${groupProgress.total_items || 0}`} variant="outlined" />
                  <Button variant="outlined" startIcon={<LayoutDashboard size={16} />} onClick={() => void toggleGroupAuto()}>
                    {groupAutoForm.auto_enabled ? "Tắt auto" : "Bật auto"}
                  </Button>
                </Stack>
              </Stack>
              <Divider sx={{ mb: 1.5 }} />
              <Stack direction={{ xs: "column", md: "row" }} gap={1}>
                <TextField size="small" fullWidth label="Khung giờ" value={groupAutoForm.auto_slots} onChange={(e) => setGroupAutoForm({ ...groupAutoForm, auto_slots: e.target.value })} />
                <TextField size="small" fullWidth type="number" label="Số topic/lượt" value={groupAutoForm.auto_pick_count} onChange={(e) => setGroupAutoForm({ ...groupAutoForm, auto_pick_count: Number(e.target.value || 1) })} />
                <TextField size="small" fullWidth label="Chiến lược" value={groupAutoForm.auto_strategy} onChange={(e) => setGroupAutoForm({ ...groupAutoForm, auto_strategy: e.target.value })} />
                <Button variant="contained" onClick={() => void saveGroupAuto()}>
                  Lưu auto
                </Button>
              </Stack>
              <Box sx={{ mt: 1.5, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 1 }}>
                {groupStatTiles.map(([label, value]) => (
                  <Box key={label} sx={{ border: "1px solid rgba(148,163,184,0.16)", borderRadius: 3, p: 1.5, bgcolor: "#f8fafc" }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#667085", textTransform: "uppercase" }}>{label}</Typography>
                    <Typography sx={{ mt: 0.5, fontWeight: 900, fontSize: 20 }}>{String(value)}</Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>

          {showGroupLogs ? (
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Log Group</Typography>
              <Stack gap={0.8}>
                {(groupLogs || []).slice(0, 12).map((e) => (
                  <Box key={e.id} sx={{ fontSize: 12, border: "1px solid rgba(148,163,184,0.16)", borderRadius: 2, px: 1.2, py: 0.8 }}>
                    <span style={{ color: "#64748b" }}>{new Date((e.created_at || 0) * 1000).toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour12: false })}</span>
                    <span style={{ margin: "0 8px" }}>·</span>
                    <span style={{ color: e.level === "error" ? "#e11d48" : e.level === "ok" ? "#16a34a" : "#0ea5e9", fontWeight: 700 }}>{e.code}</span>
                    <span style={{ margin: "0 8px" }}>·</span>
                    <span>{e.message}</span>
                  </Box>
                ))}
              </Stack>
            </Card>
          ) : null}

          <Box className="panel-grid" sx={{ gridTemplateColumns: "0.88fr 1.12fr", alignItems: "start" }}>
            <Card className="panel-card">
              <CardContent sx={{ p: 2 }}>
                <WorkspaceGroupSidebar groups={groups} activeGroupId={activeGroupId} queue={queue} groupForm={groupForm} setGroupForm={setGroupForm} onCreateGroup={onCreateGroup} onOpenGroup={onOpenGroup} onDeleteGroup={onDeleteGroup} />
              </CardContent>
            </Card>
            <Card className="panel-card">
              <CardContent sx={{ p: 2 }}>
                <WorkspaceTopicRail
                  topics={filteredTopics}
                  selectedTopicId={selectedTopic?.id || null}
                  topicSearch={topicSearch}
                  setTopicSearch={setTopicSearch}
                  topicFilter={topicFilter}
                  setTopicFilter={setTopicFilter}
                  topicForm={topicForm}
                  setTopicForm={setTopicForm}
                  onCreateTopic={onCreateTopic}
                  onSelectTopic={onSelectTopic}
                  onRenameTopic={onRenameTopic}
                  onDeleteTopic={onDeleteTopic}
                />
              </CardContent>
            </Card>
          </Box>

          <Card className="panel-card">
            <CardContent sx={{ p: 2 }}>
              <WorkspaceCampaignTable selectedTopic={selectedTopic} items={items} onEditItem={onEditItem} onRunItem={onRunItem} onStopItem={onStopItem} onResetItem={onResetItem} onDeleteItem={onDeleteItem} onViewLog={onViewLog} />
            </CardContent>
          </Card>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
