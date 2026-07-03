"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, buildTopicTargetLink, type AppStatus, type GroupRow, type ItemRow, type LogRow, type ProgressState, type QueueState, type TopicRow } from "../lib/api";

export type WorkspaceState = {
  loading: boolean;
  appStatus: AppStatus;
  groups: GroupRow[];
  queue: QueueState;
  activeGroup: GroupRow | null;
  topics: TopicRow[];
  selectedTopic: TopicRow | null;
  items: ItemRow[];
  groupProgress: ProgressState;
  groupLogs: LogRow[];
  itemLogs: LogRow[];
  logItemId: number;
  notice: { type: "ok" | "error"; text: string };
  drawerOpen: boolean;
  formOpen: boolean;
  showCampaignLogs: boolean;
  showGroupLogs: boolean;
  groupForm: { name: string; source_key: string; source_link: string; target_link: string };
  groupAutoForm: { auto_enabled: boolean; auto_slots: string; auto_pick_count: number; auto_strategy: string };
  topicForm: { name: string; topic_link: string; source_topic_id: number; target_topic_id: number; last_msg_id: number };
  itemForm: {
    title: string;
    source_start_link: string;
    source_end_link: string;
    follow_latest: boolean;
    target_link: string;
    caption: string;
    group_mode: string;
    order_mode: string;
    batch_size: number;
    delay_min: number;
    delay_max: number;
  };
  editingItemId: number | null;
  targetReadonly: boolean;
  itemFormError: string;
  topicSearch: string;
  topicFilter: string;
  filteredTopics: TopicRow[];
  setGroupForm: (next: { name: string; source_key: string; source_link: string; target_link: string }) => void;
  setGroupAutoForm: (next: { auto_enabled: boolean; auto_slots: string; auto_pick_count: number; auto_strategy: string }) => void;
  setTopicForm: (next: { name: string; topic_link: string; source_topic_id: number; target_topic_id: number; last_msg_id: number }) => void;
  setItemForm: (next: WorkspaceState["itemForm"] | ((prev: WorkspaceState["itemForm"]) => WorkspaceState["itemForm"])) => void;
  setTargetReadonly: (value: boolean) => void;
  setItemFormError: (value: string) => void;
  setTopicSearch: (value: string) => void;
  setTopicFilter: (value: string) => void;
  setDrawerOpen: (value: boolean) => void;
  setFormOpen: (value: boolean) => void;
  setShowCampaignLogs: (value: boolean) => void;
  setShowGroupLogs: (value: boolean) => void;
  setSelectedTopic: (value: TopicRow | null) => void;
  setItems: (value: ItemRow[]) => void;
  setGroupProgress: (value: ProgressState) => void;
  setGroupLogs: (value: LogRow[]) => void;
  setItemLogs: (value: LogRow[]) => void;
  setLogItemId: (value: number) => void;
  setTimedNotice: (type: "ok" | "error", text: string) => void;
  refreshAll: () => Promise<void>;
  openGroup: (group: GroupRow) => Promise<void>;
  closeDrawer: () => void;
  createGroup: () => Promise<void>;
  deleteGroup: (groupId: number) => Promise<void>;
  saveGroupAuto: () => Promise<void>;
  toggleGroupAuto: () => Promise<void>;
  createTopic: () => Promise<void>;
  deleteTopic: (topicId: number) => Promise<void>;
  renameTopic: (topic: TopicRow) => Promise<void>;
  selectTopic: (topic: TopicRow) => Promise<void>;
  resetItemForm: () => void;
  openCreateForm: () => void;
  editItem: (item: ItemRow) => void;
  saveItem: () => Promise<void>;
  deleteItem: (itemId: number) => Promise<void>;
  runItem: (itemId: number, full?: boolean) => Promise<void>;
  stopItem: (itemId: number) => Promise<void>;
  resetItem: (itemId: number) => Promise<void>;
  runTopic: () => Promise<void>;
  stopAllInTopic: () => Promise<void>;
  resetErrorsInTopic: () => Promise<void>;
  viewItemLog: (itemId: number) => Promise<void>;
};

export function useWorkspace(): WorkspaceState {
  const [loading, setLoading] = useState(false);
  const [appStatus, setAppStatus] = useState<AppStatus>({});
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [queue, setQueue] = useState<QueueState>({});
  const [activeGroup, setActiveGroup] = useState<GroupRow | null>(null);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicRow | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [groupProgress, setGroupProgress] = useState<ProgressState>({});
  const [groupLogs, setGroupLogs] = useState<LogRow[]>([]);
  const [itemLogs, setItemLogs] = useState<LogRow[]>([]);
  const [logItemId, setLogItemId] = useState(0);
  const [notice, setNotice] = useState<{ type: "ok" | "error"; text: string }>({ type: "ok", text: "" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [showCampaignLogs, setShowCampaignLogs] = useState(false);
  const [showGroupLogs, setShowGroupLogs] = useState(false);
  const [groupForm, setGroupForm] = useState({ name: "", source_key: "", source_link: "", target_link: "" });
  const [groupAutoForm, setGroupAutoForm] = useState({ auto_enabled: false, auto_slots: "09:00, 12:00, 15:00, 21:00", auto_pick_count: 1, auto_strategy: "round_robin" });
  const [topicForm, setTopicForm] = useState({ name: "", topic_link: "", source_topic_id: 0, target_topic_id: 0, last_msg_id: 0 });
  const [itemForm, setItemForm] = useState({
    title: "",
    source_start_link: "",
    source_end_link: "",
    follow_latest: true,
    target_link: "",
    caption: "",
    group_mode: "keep",
    order_mode: "auto",
    batch_size: 1,
    delay_min: 1,
    delay_max: 7,
  });
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [targetReadonly, setTargetReadonly] = useState(true);
  const [itemFormError, setItemFormError] = useState("");
  const [topicSearch, setTopicSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("all");

  const setTimedNotice = (type: "ok" | "error", text: string) => setNotice({ type, text });
  const filteredTopics = useMemo(() => {
    const query = String(topicSearch || "").trim().toLowerCase();
    return (topics || [])
      .filter((topic) => {
        const name = String(topic?.name || "").toLowerCase();
        const key = String(topic?.source_topic_id || "");
        const matchQuery = !query || name.includes(query) || key.includes(query);
        if (!matchQuery) return false;
        if (topicFilter === "all") return true;
        if (topicFilter === "running") return Boolean(topic?.is_running_topic);
        if (topicFilter === "done") return Number(topic?.remaining_items || 0) <= 0 && Number(topic?.total_items || 0) > 0;
        if (topicFilter === "pending") return Number(topic?.remaining_items || 0) > 0;
        return true;
      })
      .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
  }, [topicFilter, topicSearch, topics]);

  const loadStatus = async () => setAppStatus(await apiFetch<AppStatus>("/api/app/status"));
  const loadGroups = async () => {
    const data = await apiFetch<GroupRow[]>("/api/content_hub/groups");
    setGroups(data || []);
    return data || [];
  };
  const loadQueue = async () => setQueue(await apiFetch<QueueState>("/api/content_hub/queue"));
  const loadTopics = async (groupId: number) => {
    const data = await apiFetch<TopicRow[]>(`/api/content_hub/topics/${groupId}`);
    setTopics(data || []);
    return data || [];
  };
  const loadItems = async (topicId: number) => {
    const data = await apiFetch<ItemRow[]>(`/api/content_hub/items/${topicId}`);
    setItems(data || []);
    return data || [];
  };
  const loadGroupDetail = async (groupId: number) => {
    const [progress, logs] = await Promise.all([
      apiFetch<ProgressState>(`/api/content_hub/group_progress/${groupId}`),
      apiFetch<LogRow[]>(`/api/content_hub/group_events/${groupId}?limit=60`).catch(() => []),
    ]);
    setGroupProgress(progress || {});
    setGroupLogs(logs || []);
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([loadStatus(), loadGroups(), loadQueue()]);
      if (activeGroup) {
        await loadTopics(activeGroup.id);
        await loadGroupDetail(activeGroup.id);
      }
      if (selectedTopic) await loadItems(selectedTopic.id);
    } catch (err) {
      setTimedNotice("error", err instanceof Error ? err.message : "Không tải được dữ liệu");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadGroupAutoForm = (group: GroupRow | null) => {
    setGroupAutoForm({
      auto_enabled: Boolean(Number(group?.auto_enabled || 0)),
      auto_slots: String(group?.auto_slots || "09:00, 12:00, 15:00, 21:00"),
      auto_pick_count: Math.max(1, Number(group?.auto_pick_count || 1)),
      auto_strategy: String(group?.auto_strategy || "round_robin"),
    });
  };

  const openGroup = async (group: GroupRow) => {
    setActiveGroup(group);
    setDrawerOpen(true);
    setSelectedTopic(null);
    setItems([]);
    setFormOpen(false);
    setShowCampaignLogs(false);
    setShowGroupLogs(false);
    loadGroupAutoForm(group);
    setGroupProgress({});
    setGroupLogs([]);
    await loadTopics(group.id);
    await loadGroupDetail(group.id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setActiveGroup(null);
    setSelectedTopic(null);
    setTopics([]);
    setItems([]);
    setFormOpen(false);
    setShowCampaignLogs(false);
    setShowGroupLogs(false);
    setGroupProgress({});
    setGroupLogs([]);
    setItemLogs([]);
    setLogItemId(0);
  };

  const createGroup = async () => {
    if (!groupForm.name || !groupForm.source_key) {
      setTimedNotice("error", "Nhập tên group và source key");
      return;
    }
    const out = await apiFetch<{ ok: boolean; group?: GroupRow }>("/api/content_hub/groups", {
      method: "POST",
      body: JSON.stringify(groupForm),
    });
    if ((out as { error?: string }).error) {
      setTimedNotice("error", String((out as { error?: string }).error));
      return;
    }
    setTimedNotice("ok", "Đã tạo group thành công.");
    setGroupForm({ name: "", source_key: "", source_link: "", target_link: "" });
    await refreshAll();
    if (out.group) await openGroup(out.group);
  };

  const deleteGroup = async (groupId: number) => {
    if (!confirm("Xoá group và toàn bộ topic/nội dung?")) return;
    await apiFetch(`/api/content_hub/groups/${groupId}`, { method: "DELETE" });
    if (activeGroup?.id === groupId) closeDrawer();
    await refreshAll();
  };

  const saveGroupAuto = async () => {
    if (!activeGroup) return;
    const out = await apiFetch<Record<string, unknown>>(`/api/content_hub/groups/${activeGroup.id}/auto`, {
      method: "POST",
      body: JSON.stringify(groupAutoForm),
    });
    if ((out as { error?: string }).error) {
      setTimedNotice("error", String((out as { error?: string }).error));
      return;
    }
    setTimedNotice("ok", `Đã lưu auto-run cho group ${activeGroup.name || ""}.`);
    await refreshAll();
  };

  const toggleGroupAuto = async () => {
    const next = !groupAutoForm.auto_enabled;
    setGroupAutoForm((prev) => ({ ...prev, auto_enabled: next }));
    await apiFetch<Record<string, unknown>>(`/api/content_hub/groups/${activeGroup?.id}/auto`, {
      method: "POST",
      body: JSON.stringify({ ...groupAutoForm, auto_enabled: next }),
    });
    setTimedNotice("ok", next ? "Đã bật auto-run." : "Đã tắt auto-run.");
    await refreshAll();
  };

  const createTopic = async () => {
    if (!activeGroup) return;
    if (!topicForm.topic_link && !topicForm.name) {
      setTimedNotice("error", "Dán link msg topic hoặc nhập tên topic");
      return;
    }
    const name = topicForm.name || (topicForm.topic_link ? `Topic ${topicForm.topic_link.split("/").pop() || "mới"}` : "Topic mới");
    const out = await apiFetch<{ ok: boolean; topic?: TopicRow }>(`/api/content_hub/topics/${activeGroup.id}`, {
      method: "POST",
      body: JSON.stringify({ ...topicForm, name }),
    });
    if ((out as { error?: string }).error) {
      setTimedNotice("error", String((out as { error?: string }).error));
      return;
    }
    setTimedNotice("ok", "Đã tạo topic thành công.");
    setTopicForm({ name: "", topic_link: "", source_topic_id: 0, target_topic_id: 0, last_msg_id: 0 });
    await loadTopics(activeGroup.id);
    await loadGroupDetail(activeGroup.id);
  };

  const deleteTopic = async (topicId: number) => {
    if (!confirm("Xoá topic và toàn bộ nội dung?")) return;
    await apiFetch(`/api/content_hub/topics/${topicId}`, { method: "DELETE" });
    if (selectedTopic?.id === topicId) {
      setSelectedTopic(null);
      setItems([]);
    }
    if (activeGroup) {
      await loadTopics(activeGroup.id);
      await loadGroupDetail(activeGroup.id);
    }
  };

  const renameTopic = async (topic: TopicRow) => {
    const value = prompt("Nhập tên topic mới:", String(topic?.name || ""));
    if (value === null) return;
    const name = String(value || "").trim();
    if (!name) return;
    await apiFetch(`/api/content_hub/topics_rename/${topic.id}`, { method: "POST", body: JSON.stringify({ name }) });
    if (activeGroup) await loadTopics(activeGroup.id);
    if (selectedTopic?.id === topic.id) setSelectedTopic({ ...topic, name });
  };

  const selectTopic = async (topic: TopicRow) => {
    if (!activeGroup) return;
    setSelectedTopic(topic);
    setFormOpen(false);
    setShowCampaignLogs(false);
    setLogItemId(0);
    setItemLogs([]);
    const seed = String(topic?.target_link_seed || "").trim();
    const base = String(activeGroup?.target_link || "").trim() || String(activeGroup?.source_key || "").trim();
    setItemForm((prev) => ({ ...prev, target_link: seed || buildTopicTargetLink(base, Number(topic?.target_topic_id || 0)) }));
    setTargetReadonly(true);
    await loadItems(topic.id);
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemFormError("");
    setItemForm({
      title: "",
      source_start_link: "",
      source_end_link: "",
      follow_latest: true,
      target_link: selectedTopic ? buildTopicTargetLink(activeGroup?.target_link || activeGroup?.source_key || "", Number(selectedTopic.target_topic_id || selectedTopic.source_topic_id || 0)) : "",
      caption: "",
      group_mode: "keep",
      order_mode: "auto",
      batch_size: 1,
      delay_min: 1,
      delay_max: 7,
    });
  };

  const openCreateForm = () => {
    resetItemForm();
    setFormOpen(true);
    setTargetReadonly(true);
  };

  const editItem = (item: ItemRow) => {
    setEditingItemId(item.id);
    setItemFormError("");
    setFormOpen(true);
    setItemForm({
      title: item.title || "",
      source_start_link: item.source_start_link || "",
      source_end_link: item.source_end_link || "",
      follow_latest: !String(item.source_end_link || "").trim(),
      target_link: item.target_link || "",
      caption: "",
      group_mode: item.group_mode || "keep",
      order_mode: item.order_mode || "auto",
      batch_size: Number(item.batch_size || 1),
      delay_min: Number(item.delay_min || 1),
      delay_max: Number(item.delay_max || 7),
    });
    setTargetReadonly(true);
    void viewItemLog(item.id);
  };

  const saveItem = async () => {
    if (!activeGroup || !selectedTopic) {
      setItemFormError("Chọn topic trước khi lưu campaign.");
      setTimedNotice("error", "Chọn topic trước");
      return;
    }
    if (!String(itemForm.title || "").trim()) {
      setItemFormError("Tiêu đề nội dung không được để trống.");
      setTimedNotice("error", "Thiếu tiêu đề campaign");
      return;
    }
    if (!String(itemForm.source_start_link || "").trim()) {
      setItemFormError("Link nguồn / Topic không được để trống.");
      setTimedNotice("error", "Thiếu link nguồn");
      return;
    }
    if (!String(itemForm.target_link || "").trim()) {
      setItemFormError("Thiếu kênh đích.");
      setTimedNotice("error", "Thiếu kênh đích");
      return;
    }
    if (Number(itemForm.batch_size || 0) < 1) {
      setItemFormError("Số lượng phải lớn hơn 0.");
      setTimedNotice("error", "Batch size không hợp lệ");
      return;
    }
    if (Number(itemForm.delay_max || 0) < Number(itemForm.delay_min || 0)) {
      setItemFormError("Delay Max phải lớn hơn hoặc bằng Delay Min.");
      setTimedNotice("error", "Khoảng delay không hợp lệ");
      return;
    }
    setItemFormError("");
    const method = editingItemId ? "PUT" : "POST";
    const url = editingItemId ? `/api/content_hub/items/${editingItemId}` : `/api/content_hub/items/${activeGroup.id}/${selectedTopic.id}`;
    await apiFetch(url, { method, body: JSON.stringify(itemForm) });
    setTimedNotice("ok", "Đã lưu nội dung");
    setFormOpen(false);
    resetItemForm();
    await selectTopic(selectedTopic);
    await loadGroupDetail(activeGroup.id);
  };

  const deleteItem = async (itemId: number) => {
    if (!confirm("Xoá item này?")) return;
    await apiFetch(`/api/content_hub/items/${itemId}`, { method: "DELETE" });
    if (logItemId === itemId) {
      setLogItemId(0);
      setItemLogs([]);
    }
    if (selectedTopic) await selectTopic(selectedTopic);
  };

  const runItem = async (itemId: number, full = false) => {
    await apiFetch(`/api/content_hub/${full ? "run_item_full" : "run_item"}/${itemId}`, { method: "POST" });
    await viewItemLog(itemId);
    if (selectedTopic) await selectTopic(selectedTopic);
    await refreshAll();
  };

  const stopItem = async (itemId: number) => {
    await apiFetch(`/api/content_hub/stop_item/${itemId}`, { method: "POST" });
    await viewItemLog(itemId);
    if (selectedTopic) await selectTopic(selectedTopic);
    await refreshAll();
  };

  const resetItem = async (itemId: number) => {
    if (!confirm("Reset campaign này để chạy lại từ đầu?")) return;
    await apiFetch(`/api/content_hub/reset_item/${itemId}`, { method: "POST" });
    await viewItemLog(itemId);
    if (selectedTopic) await selectTopic(selectedTopic);
    await refreshAll();
  };

  const runTopic = async () => {
    if (!selectedTopic) return;
    await apiFetch(`/api/content_hub/run_topic/${selectedTopic.id}`, { method: "POST" });
    await selectTopic(selectedTopic);
    await refreshAll();
  };

  const stopAllInTopic = async () => {
    if (!selectedTopic) return;
    for (const item of items) await apiFetch(`/api/content_hub/stop_item/${item.id}`, { method: "POST" });
    await selectTopic(selectedTopic);
    await refreshAll();
  };

  const resetErrorsInTopic = async () => {
    if (!selectedTopic) return;
    const errors = items.filter((item) => String(item.status || "") === "Lỗi");
    for (const item of errors) await apiFetch(`/api/content_hub/reset_item/${item.id}`, { method: "POST" });
    await selectTopic(selectedTopic);
    await refreshAll();
  };

  const viewItemLog = async (itemId: number) => {
    setLogItemId(itemId);
    setShowCampaignLogs(true);
    const data = await apiFetch<LogRow[]>(`/api/content_hub/events/${itemId}?limit=80`).catch(() => []);
    setItemLogs(data || []);
  };

  return {
    loading,
    appStatus,
    groups,
    queue,
    activeGroup,
    topics,
    selectedTopic,
    items,
    groupProgress,
    groupLogs,
    itemLogs,
    logItemId,
    notice,
    drawerOpen,
    formOpen,
    showCampaignLogs,
    showGroupLogs,
    groupForm,
    setGroupForm,
    groupAutoForm,
    setGroupAutoForm,
    topicForm,
    setTopicForm,
    itemForm,
    setItemForm,
    editingItemId,
    targetReadonly,
    setTargetReadonly,
    itemFormError,
    setItemFormError,
    topicSearch,
    setTopicSearch,
    topicFilter,
    setTopicFilter,
    filteredTopics,
    setTimedNotice,
    refreshAll,
    openGroup,
    closeDrawer,
    createGroup,
    deleteGroup,
    saveGroupAuto,
    toggleGroupAuto,
    createTopic,
    deleteTopic,
    renameTopic,
    selectTopic,
    resetItemForm,
    openCreateForm,
    editItem,
    saveItem,
    deleteItem,
    runItem,
    stopItem,
    resetItem,
    runTopic,
    stopAllInTopic,
    resetErrorsInTopic,
    viewItemLog,
    setDrawerOpen,
    setFormOpen,
    setShowCampaignLogs,
    setShowGroupLogs,
    setSelectedTopic,
    setItems,
    setGroupProgress,
    setGroupLogs,
    setItemLogs,
    setLogItemId,
  };
}
