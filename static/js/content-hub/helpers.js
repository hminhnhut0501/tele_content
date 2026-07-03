window.createContentHubHelpers = function () {
  return {
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

    campaignStats() {
      const total = Array.isArray(this.items) ? this.items.length : 0;
      const done = (this.items || []).filter((item) => String(item?.status || "") === "Đã gửi Telegram").length;
      const remaining = Math.max(0, total - done);
      return { total, done, remaining };
    },
  };
};
