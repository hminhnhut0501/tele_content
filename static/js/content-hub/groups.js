window.createContentHubGroups = function () {
  return {
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
  };
};
