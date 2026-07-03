window.createContentHubCampaigns = function () {
  return {
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

    openCreateForm() {
      this.resetItemForm();
      this.itemForm.target_link = this.resolveTopicTargetLink() || this.itemForm.target_link;
      this.formOpen = true;
      this.targetReadonly = true;
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
  };
};
