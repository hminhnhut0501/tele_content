window.createContentHubLifecycle = function () {
  return {
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
  };
};
