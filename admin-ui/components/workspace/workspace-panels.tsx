"use client";

import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ChevronRight, Filter, LayoutDashboard, Plus, Search, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

export type GroupRow = {
  id: number;
  name: string;
  source_key: string;
  source_link?: string;
  target_link?: string;
  auto_enabled?: number;
  auto_slots?: string;
  auto_pick_count?: number;
  auto_strategy?: string;
  auto_next_run_in_sec?: number;
  auto_last_result?: string;
  auto_attention?: string;
  topic_count?: number;
  item_count?: number;
  auto_slots_count?: number;
};
export type TopicRow = {
  id: number;
  name: string;
  source_topic_id?: number;
  target_topic_id?: number;
  target_link_seed?: string;
  last_msg_id?: number;
  item_count?: number;
  total_items?: number;
  done_items?: number;
  remaining_items?: number;
  queued_count?: number;
  is_running_topic?: boolean;
};
export type ItemRow = {
  id: number;
  title?: string;
  status?: string;
  source_start_link?: string;
  source_end_link?: string;
  follow_latest?: number | boolean;
  target_link?: string;
  group_mode?: string;
  order_mode?: string;
  batch_size?: number;
  delay_min?: number;
  delay_max?: number;
  last_msg_id?: number;
  sent_count?: number;
  sent_units_count?: number;
  queue_position?: number;
  next_run_in_sec?: number;
};
export type QueueState = { queue_size?: number; active_workers?: number; max_concurrency?: number };
export type ProgressState = { total_topics?: number; total_items?: number; running_items?: number; queued_items?: number; done_items?: number };
export type LogRow = { id: number; created_at?: number; code?: string; message?: string; level?: string };

export function WorkspaceGroupSidebar({
  groups,
  activeGroupId,
  queue,
  groupForm,
  setGroupForm,
  onCreateGroup,
  onOpenGroup,
  onDeleteGroup,
}: {
  groups: GroupRow[];
  activeGroupId: number | null;
  queue: QueueState;
  groupForm: { name: string; source_key: string; source_link: string; target_link: string };
  setGroupForm: (next: { name: string; source_key: string; source_link: string; target_link: string }) => void;
  onCreateGroup: () => void;
  onOpenGroup: (group: GroupRow) => void;
  onDeleteGroup: (groupId: number) => void;
}) {
  return (
    <Card className="panel-card">
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Danh sách group
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Queue: {queue.queue_size || 0} · Worker: {(queue.active_workers || 0)}/{queue.max_concurrency || 1}
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Plus size={16} />} onClick={onCreateGroup}>
            Thêm group
          </Button>
        </Stack>

        <Stack gap={1.2} sx={{ mb: 2 }}>
          <TextField fullWidth size="small" placeholder="Tên group" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} />
          <TextField fullWidth size="small" placeholder="Group ID / source key" value={groupForm.source_key} onChange={(e) => setGroupForm({ ...groupForm, source_key: e.target.value })} />
          <TextField fullWidth size="small" placeholder="Link nguồn" value={groupForm.source_link} onChange={(e) => setGroupForm({ ...groupForm, source_link: e.target.value })} />
          <TextField fullWidth size="small" placeholder="Kênh đích mặc định" value={groupForm.target_link} onChange={(e) => setGroupForm({ ...groupForm, target_link: e.target.value })} />
        </Stack>

        <Stack gap={1}>
          {groups.map((g) => (
            <Card
              key={g.id}
              variant="outlined"
              sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", borderColor: activeGroupId === g.id ? "#2f80ff" : "rgba(148,163,184,0.18)" }}
              onClick={() => onOpenGroup(g)}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1.5}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800 }} noWrap>
                    {g.name} ({g.source_key})
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {(g.topic_count || 0)} topics • {(g.item_count || 0)} items • {(g.auto_slots_count || 0)} slots
                  </Typography>
                </Box>
                <Stack direction="row" gap={0.75} alignItems="center">
                  <Chip label={Number(g.auto_enabled || 0) ? "AUTO ON" : "AUTO OFF"} size="small" color={Number(g.auto_enabled || 0) ? "success" : "default"} variant="outlined" />
                  <IconButton onClick={(e) => { e.stopPropagation(); onDeleteGroup(g.id); }} size="small">
                    <Trash2 size={16} />
                  </IconButton>
                  <ChevronRight size={16} />
                </Stack>
              </Stack>
            </Card>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function WorkspaceTopicRail({
  topics,
  selectedTopicId,
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
}: {
  topics: TopicRow[];
  selectedTopicId: number | null;
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
}) {
  return (
    <Card className="panel-card">
      <CardContent sx={{ p: 2 }}>
        <Stack gap={1.2}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Topic rail
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Chọn topic để mở workspace.
              </Typography>
            </Box>
          </Stack>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 0.75 }}>
            {[
              ["all", "Tất cả"],
              ["pending", "Cần chạy"],
              ["running", "Đang chạy"],
              ["done", "Hoàn tất"],
            ].map(([value, label]) => (
              <Button key={value} variant={topicFilter === value ? "contained" : "outlined"} onClick={() => setTopicFilter(value)} sx={{ minWidth: 0 }}>
                {label}
              </Button>
            ))}
          </Box>
          <TextField size="small" placeholder="Tìm topic theo tên / id..." value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><Search size={16} /></InputAdornment> }} />
          <Stack direction={{ xs: "column", md: "row" }} gap={1}>
            <TextField size="small" fullWidth placeholder="dán link msg topic..." value={topicForm.topic_link} onChange={(e) => setTopicForm({ ...topicForm, topic_link: e.target.value })} />
            <Button variant="contained" onClick={onCreateTopic}>
              Tạo topic
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Ví dụ: t.me/c/123456/1989/2288
          </Typography>
          <Divider />

          <Stack gap={1}>
            {topics.map((topic) => (
              <Card key={topic.id} variant="outlined" sx={{ p: 1.5, borderRadius: 3, cursor: "pointer", borderColor: selectedTopicId === topic.id ? "#2f80ff" : "rgba(148,163,184,0.18)" }} onClick={() => onSelectTopic(topic)}>
                <Stack direction="row" justifyContent="space-between" gap={1.5}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }} noWrap>
                      {topic.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      #{topic.source_topic_id || 0} {"->"} #{topic.target_topic_id || 0} · {topic.item_count || 0} items
                    </Typography>
                  </Box>
                  <Stack direction="row" gap={0.5} alignItems="center">
                    <Button size="small" onClick={(e) => { e.stopPropagation(); onRenameTopic(topic); }}>
                      Sửa
                    </Button>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteTopic(topic.id); }}>
                      <Trash2 size={16} />
                    </IconButton>
                  </Stack>
                </Stack>
                <Stack direction="row" gap={0.75} sx={{ mt: 1 }}>
                  <Chip size="small" label={`Còn lại ${topic.remaining_items || 0}`} variant="outlined" />
                  <Chip size="small" label={`Đã chạy ${topic.done_items || 0}`} color="success" variant="outlined" />
                  <Chip size="small" label={`Queue ${topic.queued_count || 0}`} color="info" variant="outlined" />
                </Stack>
              </Card>
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function WorkspaceCampaignTable({
  selectedTopic,
  items,
  onEditItem,
  onRunItem,
  onStopItem,
  onResetItem,
  onDeleteItem,
  onViewLog,
}: {
  selectedTopic: TopicRow | null;
  items: ItemRow[];
  onEditItem: (item: ItemRow) => void;
  onRunItem: (itemId: number, full?: boolean) => void;
  onStopItem: (itemId: number) => void;
  onResetItem: (itemId: number) => void;
  onDeleteItem: (itemId: number) => void;
  onViewLog: (itemId: number) => void;
}) {
  return (
    <Card className="panel-card">
      <CardContent sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Campaign table
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedTopic ? `Topic đang chọn: ${selectedTopic.name}` : "Chưa chọn topic"}
            </Typography>
          </Box>
        </Stack>
        <Box className="table-wrap">
          <Box component="table" sx={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <Box component="thead">
              <Box component="tr" sx={{ "& th": { textAlign: "left", py: 1.3, px: 1.5, fontSize: 13, fontWeight: 800, color: "#334155", borderBottom: "1px solid rgba(148,163,184,0.18)", background: "#f8fafc" } }}>
                <Box component="th">Campaign</Box>
                <Box component="th">Trạng thái</Box>
                <Box component="th">Tiến trình</Box>
                <Box component="th">Cursor</Box>
                <Box component="th">Queue</Box>
                <Box component="th">Hành động</Box>
              </Box>
            </Box>
            <Box component="tbody">
              {items.map((item) => (
                <Box component="tr" key={item.id} sx={{ "& td": { px: 1.5, py: 1.4, borderBottom: "1px solid rgba(148,163,184,0.12)", verticalAlign: "top" }, "&:hover": { background: "#f8fafc" } }}>
                  <Box component="td">
                    <Typography sx={{ fontWeight: 800 }}>{item.title || `Campaign #${item.id}`}</Typography>
                    <Typography variant="body2" color="text.secondary">{item.target_link || "-"}</Typography>
                  </Box>
                  <Box component="td">
                    <Chip size="small" label={item.status || "Nháp"} variant="outlined" />
                  </Box>
                  <Box component="td">
                    <Typography sx={{ fontWeight: 800 }}>Msg {Number(item.sent_count || 0)}</Typography>
                    <Typography variant="body2" color="text.secondary">Unit {Number(item.sent_units_count || 0)}</Typography>
                  </Box>
                  <Box component="td">
                    <Typography sx={{ fontWeight: 800 }}>{Number(item.last_msg_id || 0) || "-"}</Typography>
                    <Typography variant="body2" color="text.secondary">{String(item.follow_latest) === "1" || item.follow_latest === true ? "Auto follow latest" : "Range fixed"}</Typography>
                  </Box>
                  <Box component="td">
                    <Typography sx={{ fontWeight: 800 }}>#{item.queue_position || 0} · {item.next_run_in_sec || 0}s</Typography>
                  </Box>
                  <Box component="td">
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      <Button size="small" variant="outlined" onClick={() => onEditItem(item)}>Sửa</Button>
                      <Button size="small" variant="contained" onClick={() => onRunItem(item.id)}>Chạy 1</Button>
                      <Button size="small" variant="outlined" onClick={() => onRunItem(item.id, true)}>Chạy hết</Button>
                      <Button size="small" color="warning" variant="contained" onClick={() => onStopItem(item.id)}>Dừng</Button>
                      <Button size="small" variant="outlined" onClick={() => onResetItem(item.id)}>Reset</Button>
                      <Button size="small" variant="outlined" onClick={() => onViewLog(item.id)}>Log</Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => onDeleteItem(item.id)}>Xoá</Button>
                    </Stack>
                  </Box>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export function WorkspaceDialogShell({ open, onClose, title, subtitle, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>{title}</Typography>
            {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography> : null}
          </Box>
          <IconButton onClick={onClose} size="small"><X size={18} /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>{children}</DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" onClick={onClose}>Đóng</Button>
        <Button variant="contained">Lưu thay đổi</Button>
      </DialogActions>
    </Dialog>
  );
}
