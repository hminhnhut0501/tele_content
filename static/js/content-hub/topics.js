window.createContentHubTopics = function () {
  return {
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
  };
};
