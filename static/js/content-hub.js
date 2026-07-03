window.contentHubController = function () {
  return {
    loading: false,
    groups: [],
    topics: [],
    items: [],
    queue: { queue_size: 0, active_workers: 0, max_concurrency: 1, items: [] },
    notice: { type: "ok", text: "" },
    drawerOpen: false,
    activeGroup: null,
    selectedTopic: null,
    editingItemId: null,
    targetReadonly: true,
    groupForm: { name: "", source_key: "", source_link: "", target_link: "" },
    topicForm: { name: "", topic_link: "", source_topic_id: 0, target_topic_id: 0, last_msg_id: 0 },
    itemForm: { title: "", source_start_link: "", source_end_link: "", follow_latest: true, target_link: "", caption: "", group_mode: "keep", order_mode: "auto", batch_size: 1, delay_min: 1, delay_max: 7 },
    itemLogs: [],
    logItemId: 0,
    groupProgress: { total_topics: 0, total_items: 0, running_items: 0, queued_items: 0, done_items: 0, error_items: 0, completed_ratio: 0 },
    groupLogs: [],
    showOps: false,
    showGroupLogs: false,
    showCampaignLogs: false,
    formOpen: false,
    openItemToolsId: 0,
    topicSearch: "",
    topicFilter: "all",
    groupAutoForm: { auto_enabled: false, auto_slots: "09:00, 12:00, 15:00, 21:00", auto_pick_count: 1, auto_strategy: "round_robin" },
    wizardIntentHandler: null,

    buildTopicTargetLink(baseLink, topicId) {
      const base = String(baseLink || "").trim();
      const tid = Number(topicId || 0);
      if (tid <= 0) return base;
      if (!base) return "";
      if (/^-?\d+$/.test(base)) {
        const cid = base.replace("-100", "");
        return `https://t.me/c/${cid}/${tid}/1`;
      }
      const norm = base.replace(/^https?:\/\//i, "");
      const match = norm.match(/^t\.me\/c\/(\d+)(?:\/(\d+))?(?:\/(\d+))?$/i);
      if (!match) return base;
      const cid = match[1];
      const msg = match[3] || match[2] || "1";
      return `https://t.me/c/${cid}/${tid}/${msg}`;
    },

    start() {
      this.refreshAll();
      this.timer = setInterval(() => this.refreshLight(), 3000);
      this.wizardIntentHandler = (event) => this.handleWizardIntent(event);
      window.addEventListener("contenthub:wizard-intent", this.wizardIntentHandler);
    },

    destroy() {
      if (this.timer) clearInterval(this.timer);
      if (this.wizardIntentHandler) {
        window.removeEventListener("contenthub:wizard-intent", this.wizardIntentHandler);
      }
    },

    handleWizardIntent(event) {
      const step = String(event?.detail?.step || "").trim();
      if (!step) return;
      if (step === "group") {
        this.$nextTick(() => this.$refs.groupNameInput?.focus());
        return;
      }
      if (step === "topic") {
        if (!this.groups.length) {
          this.notice = { type: "error", text: "Tạo group trước rồi mới thêm topic." };
          this.$nextTick(() => this.$refs.groupNameInput?.focus());
          return;
        }
        const firstGroup = this.groups[0];
        this.openGroup(firstGroup).then(() => {
          this.$nextTick(() => this.$refs.topicLinkInput?.focus());
        });
        return;
      }
      if (step === "campaign") {
        if (!this.groups.length) {
          this.notice = { type: "error", text: "Cần tạo group trước khi thêm campaign đầu tiên." };
          this.$nextTick(() => this.$refs.groupNameInput?.focus());
          return;
        }
        const firstGroup = this.groups[0];
        this.openGroup(firstGroup).then(async () => {
          if (!this.topics.length) {
            this.notice = { type: "error", text: "Cần tạo topic trước khi thêm campaign đầu tiên." };
            this.$nextTick(() => this.$refs.topicLinkInput?.focus());
            return;
          }
          await this.selectTopic(this.topics[0]);
          this.openCreateForm();
          this.$nextTick(() => this.$refs.campaignSourceInput?.focus());
        });
      }
    },

    loadGroupAutoForm(group) {
      this.groupAutoForm = {
        auto_enabled: Boolean(Number(group?.auto_enabled || 0)),
        auto_slots: String(group?.auto_slots || "09:00, 12:00, 15:00, 21:00"),
        auto_pick_count: Math.max(1, Number(group?.auto_pick_count || 1)),
        auto_strategy: String(group?.auto_strategy || "round_robin"),
      };
    },

    groupAutoSummary() {
      return `${this.groupAutoForm.auto_enabled ? "ON" : "OFF"} · ${Number(this.groupAutoForm.auto_pick_count || 1)} topic · ${this.groupAutoForm.auto_strategy || "round_robin"}`;
    },

    async refreshLight() {
      try {
        const groupsResponse = await fetch("/api/content_hub/groups", { cache: "no-store" });
        if (groupsResponse.ok) this.groups = await groupsResponse.json();
        const queueResponse = await fetch("/api/content_hub/queue", { cache: "no-store" });
        if (queueResponse.ok) this.queue = await queueResponse.json();
        if (this.drawerOpen && this.activeGroup?.id) {
          const gp = await fetch(`/api/content_hub/group_progress/${this.activeGroup.id}`, { cache: "no-store" });
          if (gp.ok) this.groupProgress = await gp.json();
          const ge = await fetch(`/api/content_hub/group_events/${this.activeGroup.id}?limit=60`, { cache: "no-store" });
          if (ge.ok) this.groupLogs = await ge.json();
        }
        if (this.drawerOpen && this.selectedTopic?.id) {
          const itemsResponse = await fetch(`/api/content_hub/items/${this.selectedTopic.id}`, { cache: "no-store" });
          if (itemsResponse.ok) this.items = await itemsResponse.json();
        }
      } catch (_) {}
    },

    async refreshAll() {
      this.loading = true;
      const keepGroupId = this.activeGroup?.id || 0;
      const keepTopicId = this.selectedTopic?.id || 0;
      try {
        const response = await fetch("/api/content_hub/groups", { cache: "no-store" });
        this.groups = response.ok ? await response.json() : [];
        await this.refreshLight();
        if (keepGroupId) {
          const group = this.groups.find((row) => Number(row.id) === Number(keepGroupId));
          if (group) {
            this.activeGroup = group;
            this.loadGroupAutoForm(group);
            await this.loadTopics(group.id);
            if (keepTopicId) {
              const topic = this.topics.find((row) => Number(row.id) === Number(keepTopicId));
              if (topic) await this.selectTopic(topic);
            }
          }
        }
      } finally {
        this.loading = false;
      }
    },

    async createGroup() {
      if (!this.groupForm.name || !this.groupForm.source_key) {
        alert("Nhập tên group và source key");
        return;
      }
      const response = await fetch("/api/content_hub/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.groupForm),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        alert(out.error || "Không tạo được group");
        return;
      }
      this.notice = { type: "ok", text: "Đã tạo group thành công." };
      this.groupForm = { name: "", source_key: "", source_link: "", target_link: "" };
      await this.refreshAll();
    },

    async deleteGroup(id) {
      if (!confirm("Xoá group và toàn bộ topic/nội dung?")) return;
      await fetch(`/api/content_hub/groups/${id}`, { method: "DELETE" });
      if (this.activeGroup && Number(this.activeGroup.id) === Number(id)) this.closeDrawer();
      await this.refreshAll();
    },

    async openGroup(group) {
      this.activeGroup = group;
      this.drawerOpen = true;
      this.loadGroupAutoForm(group);
      await this.loadTopics(group.id);
      this.selectedTopic = null;
      this.items = [];
      this.formOpen = false;
      this.openItemToolsId = 0;
      this.groupProgress = { total_topics: 0, total_items: 0, running_items: 0, queued_items: 0, done_items: 0, error_items: 0, completed_ratio: 0 };
      this.groupLogs = [];
      this.resetItemForm();
    },

    closeDrawer() {
      this.drawerOpen = false;
      this.activeGroup = null;
      this.selectedTopic = null;
      this.topics = [];
      this.items = [];
      this.formOpen = false;
      this.openItemToolsId = 0;
      this.groupProgress = { total_topics: 0, total_items: 0, running_items: 0, queued_items: 0, done_items: 0, error_items: 0, completed_ratio: 0 };
      this.groupLogs = [];
      this.resetItemForm();
    },

    async saveGroupAuto() {
      if (!this.activeGroup?.id) return;
      const response = await fetch(`/api/content_hub/groups/${this.activeGroup.id}/auto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.groupAutoForm),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        this.notice = { type: "error", text: out.error || "Không lưu được auto-run." };
        return;
      }
      this.notice = { type: "ok", text: `Đã lưu auto-run cho group ${this.activeGroup.name || ""}.` };
      this.activeGroup = { ...this.activeGroup, ...out };
      this.loadGroupAutoForm(this.activeGroup);
      await this.refreshAll();
    },

    async toggleGroupAuto() {
      this.groupAutoForm.auto_enabled = !this.groupAutoForm.auto_enabled;
      await this.saveGroupAuto();
    },

    async loadTopics(groupId) {
      const response = await fetch(`/api/content_hub/topics/${groupId}`, { cache: "no-store" });
      this.topics = response.ok ? await response.json() : [];
    },

    async createTopic() {
      if (!this.activeGroup) return;
      if (!this.topicForm.topic_link && !this.topicForm.name) {
        alert("Dán link msg topic hoặc nhập tên topic");
        return;
      }
      if (!this.topicForm.name && this.topicForm.topic_link) {
        const match = String(this.topicForm.topic_link || "").trim().match(/t\.me\/(?:c\/)?([^/]+)\/(\d+)(?:\/(\d+))?/i);
        const tid = match ? Number(match[2] || match[3] || 0) : 0;
        this.topicForm.name = tid > 0 ? `Topic ${tid}` : "Topic mới";
      }
      const response = await fetch(`/api/content_hub/topics/${this.activeGroup.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.topicForm),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        alert(out.error || "Không tạo được topic");
        return;
      }
      this.notice = { type: "ok", text: "Đã tạo topic thành công. Chọn topic để thêm nội dung." };
      this.topicForm = { name: "", topic_link: "", source_topic_id: 0, target_topic_id: 0, last_msg_id: 0 };
      await this.loadTopics(this.activeGroup.id);
    },

    async deleteTopic(topicId) {
      if (!confirm("Xoá topic và toàn bộ nội dung?")) return;
      await fetch(`/api/content_hub/topics/${topicId}`, { method: "DELETE" });
      if (this.selectedTopic && Number(this.selectedTopic.id) === Number(topicId)) {
        this.selectedTopic = null;
        this.items = [];
      }
      await this.loadTopics(this.activeGroup.id);
    },

    async renameTopic(topic) {
      const current = String(topic?.name || "").trim();
      const value = prompt("Nhập tên topic mới:", current);
      if (value === null) return;
      const name = String(value || "").trim();
      if (!name) {
        alert("Tên topic không được rỗng");
        return;
      }
      const response = await fetch(`/api/content_hub/topics_rename/${topic.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        alert(out.error || "Không đổi tên được topic");
        return;
      }
      this.notice = { type: "ok", text: `Đã đổi tên topic thành: ${name}` };
      await this.loadTopics(this.activeGroup.id);
      if (this.selectedTopic && Number(this.selectedTopic.id) === Number(topic.id)) {
        const fresh = this.topics.find((row) => Number(row.id) === Number(topic.id));
        if (fresh) this.selectedTopic = fresh;
      }
    },

    async selectTopic(topic) {
      this.selectedTopic = topic;
      this.formOpen = false;
      this.openItemToolsId = 0;
      this.resetItemForm();
      const seed = String(topic?.target_link_seed || "").trim();
      const base = String(this.activeGroup?.target_link || "").trim() || String(this.activeGroup?.source_key || "").trim();
      this.itemForm.target_link = seed || this.buildTopicTargetLink(base, topic?.target_topic_id || 0);
      this.targetReadonly = true;
      const response = await fetch(`/api/content_hub/items/${topic.id}`, { cache: "no-store" });
      this.items = response.ok ? await response.json() : [];
    },

    editItem(item) {
      this.editingItemId = item.id;
      this.formOpen = true;
      this.itemForm = {
        title: item.title || "",
        source_start_link: item.source_start_link || "",
        source_end_link: item.source_end_link || "",
        follow_latest: !String(item.source_end_link || "").trim(),
        target_link: item.target_link || "",
        caption: item.caption || "",
        group_mode: item.group_mode || "keep",
        order_mode: item.order_mode || "auto",
        batch_size: Number(item.batch_size || 0),
        delay_min: Number(item.delay_min || 1),
        delay_max: Number(item.delay_max || 7),
      };
      this.targetReadonly = true;
      this.viewItemLog(item.id);
    },

    resolveTopicTargetLink() {
      const topic = this.selectedTopic || {};
      const seed = String(topic?.target_link_seed || "").trim();
      if (seed) return seed;
      const base = String(this.activeGroup?.target_link || "").trim() || String(this.activeGroup?.source_key || "").trim();
      const tid = Number(topic?.target_topic_id || topic?.source_topic_id || 0);
      return this.buildTopicTargetLink(base, tid);
    },

    resetItemForm() {
      this.editingItemId = null;
      this.itemForm = {
        title: "",
        source_start_link: "",
        source_end_link: "",
        follow_latest: true,
        target_link: this.resolveTopicTargetLink() || (this.activeGroup?.target_link || this.activeGroup?.source_key || ""),
        caption: "",
        group_mode: "keep",
        order_mode: "auto",
        batch_size: 1,
        delay_min: 1,
        delay_max: 7,
      };
    },

    openCreateForm() {
      this.resetItemForm();
      this.itemForm.target_link = this.resolveTopicTargetLink() || this.itemForm.target_link;
      this.formOpen = true;
      this.targetReadonly = true;
    },

    toggleFollowLatest() {
      this.itemForm.follow_latest = !this.itemForm.follow_latest;
      if (this.itemForm.follow_latest && String(this.itemForm.source_end_link || "").trim()) {
        this.itemForm.source_end_link = "";
        this.notice = { type: "ok", text: "Đã xoá Link kết thúc để chuyển sang Auto follow latest." };
      }
    },

    onSourceEndInput(value) {
      this.itemForm.source_end_link = value;
      if (this.itemForm.follow_latest && String(value || "").trim()) {
        this.itemForm.source_end_link = "";
        this.notice = { type: "ok", text: "Auto follow latest đang bật nên Link kết thúc đã được xoá tự động." };
      }
    },

    toggleItemTools(itemId) {
      const iid = Number(itemId || 0);
      this.openItemToolsId = this.openItemToolsId === iid ? 0 : iid;
    },

    topicState(topic) {
      const total = Number(topic?.total_items || 0);
      const done = Number(topic?.done_items || 0);
      const err = Number(topic?.error_count || 0);
      if (total > 0 && done >= total && err <= 0) return "done";
      if ((topic?.is_running_topic || false) === true) return "running";
      if (err > 0) return "error";
      if (total > done) return "pending";
      return "all";
    },

    filteredTopics() {
      const query = String(this.topicSearch || "").trim().toLowerCase();
      return (this.topics || [])
        .filter((topic) => {
          const name = String(topic?.name || "").toLowerCase();
          const key = String(topic?.source_topic_id || "");
          const matchQuery = !query || name.includes(query) || key.includes(query);
          if (!matchQuery) return false;
          if (this.topicFilter === "all") return true;
          return this.topicState(topic) === this.topicFilter;
        })
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0));
    },

    async saveItem() {
      if (!this.activeGroup || !this.selectedTopic) {
        alert("Chọn topic trước");
        return;
      }
      if (!String(this.itemForm.target_link || "").trim()) {
        this.notice = { type: "error", text: "Thiếu kênh đích. Hãy chọn topic lại hoặc bấm Sửa tay để nhập target_link." };
        return;
      }
      if (this.itemForm.follow_latest) this.itemForm.source_end_link = "";
      const method = this.editingItemId ? "PUT" : "POST";
      const url = this.editingItemId
        ? `/api/content_hub/items/${this.editingItemId}`
        : `/api/content_hub/items/${this.activeGroup.id}/${this.selectedTopic.id}`;
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(this.itemForm),
      });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        alert(out.error || "Không lưu được nội dung");
        return;
      }
      this.notice = { type: "ok", text: "Đã lưu nội dung. Bấm Chạy 1 để chạy một nhịp hoặc Chạy hết để chạy liên tục cho campaign này." };
      await this.selectTopic(this.selectedTopic);
      this.resetItemForm();
      this.formOpen = false;
      await this.refreshAll();
    },

    async deleteItem(itemId) {
      if (!confirm("Xoá item này?")) return;
      await fetch(`/api/content_hub/items/${itemId}`, { method: "DELETE" });
      if (Number(this.logItemId) === Number(itemId)) {
        this.logItemId = 0;
        this.itemLogs = [];
      }
      await this.selectTopic(this.selectedTopic);
      await this.refreshAll();
    },

    async runItem(itemId) {
      await fetch(`/api/content_hub/run_item/${itemId}`, { method: "POST" });
      await this.viewItemLog(itemId);
      if (this.selectedTopic) await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async runItemFull(itemId) {
      await fetch(`/api/content_hub/run_item_full/${itemId}`, { method: "POST" });
      await this.viewItemLog(itemId);
      if (this.selectedTopic) await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async stopItem(itemId) {
      await fetch(`/api/content_hub/stop_item/${itemId}`, { method: "POST" });
      await this.viewItemLog(itemId);
      if (this.selectedTopic) await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async resetItem(itemId) {
      if (!confirm("Reset campaign này để chạy lại từ đầu?")) return;
      const response = await fetch(`/api/content_hub/reset_item/${itemId}`, { method: "POST" });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        this.notice = { type: "error", text: out.error || "Không reset được campaign." };
        return;
      }
      this.notice = { type: "ok", text: "Đã reset campaign, có thể bấm Chạy để chạy lại từ đầu." };
      await this.viewItemLog(itemId);
      if (this.selectedTopic) await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async runTopic(topicId) {
      const response = await fetch(`/api/content_hub/run_topic/${topicId}`, { method: "POST" });
      const out = await response.json().catch(() => ({}));
      if (!response.ok || out.error) {
        this.notice = { type: "error", text: out.error || "Không chạy được topic." };
      } else {
        this.notice = { type: "ok", text: `Topic: tổng ${out.total || 0} item, bật ${out.enabled || 0}, đã xếp hàng ${out.queued || 0}, đang chạy ${out.skipped_running || 0}, đã chờ sẵn ${out.skipped_queued || 0}, đang tắt ${out.skipped_disabled || 0}.` };
      }
      if (this.selectedTopic) await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async stopAllInTopic() {
      if (!this.selectedTopic) return;
      for (const item of this.items || []) {
        await fetch(`/api/content_hub/stop_item/${item.id}`, { method: "POST" });
      }
      this.notice = { type: "ok", text: `Đã dừng toàn bộ ${this.items.length} campaign trong topic.` };
      await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async resetErrorsInTopic() {
      if (!this.selectedTopic) return;
      const errors = (this.items || []).filter((item) => String(item?.status || "") === "Lỗi");
      for (const item of errors) {
        await fetch(`/api/content_hub/reset_item/${item.id}`, { method: "POST" });
      }
      this.notice = { type: "ok", text: `Đã reset ${errors.length} campaign lỗi trong topic.` };
      await this.selectTopic(this.selectedTopic);
      await this.refreshLight();
    },

    async viewItemLog(itemId) {
      this.logItemId = Number(itemId || 0);
      if (!this.logItemId) {
        this.itemLogs = [];
        return;
      }
      this.showCampaignLogs = true;
      const response = await fetch(`/api/content_hub/events/${this.logItemId}?limit=80`, { cache: "no-store" });
      this.itemLogs = response.ok ? await response.json() : [];
    },

    campaignStats() {
      const total = Array.isArray(this.items) ? this.items.length : 0;
      const done = (this.items || []).filter((item) => String(item?.status || "") === "Đã gửi Telegram").length;
      const remaining = Math.max(0, total - done);
      return { total, done, remaining };
    },
  };
};
