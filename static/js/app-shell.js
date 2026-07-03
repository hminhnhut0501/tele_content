window.appShell = function () {
  return {
    activeView: "dashboard",
    appStatus: {
      ok: true,
      db_mode: "sqlite",
      database_url_set: false,
      string_session: false,
      tg_api_id_set: false,
      tg_api_hash_set: false,
      render_external_url: "",
      storage: { groups: 0, topics: 0, items: 0, events: 0 },
    },
    viewMeta: {
      dashboard: {
        title: "Dashboard",
        description: "Tong quan trang thai app, do san sang deploy va lo trinh nang cap cua tool.",
      },
      workspace: {
        title: "Workspace",
        description: "Khu van hanh chinh de quan ly group, topic, campaign con, queue va lich auto-run.",
      },
      settings: {
        title: "Settings",
        description: "Kiem tra cau hinh Telegram, database, Render va cac buoc de chay ben hon.",
      },
    },
    get wizardSteps() {
      return [
        {
          id: "telegram",
          order: 1,
          title: "Telegram",
          ready: Boolean(this.appStatus.tg_api_id_set && this.appStatus.tg_api_hash_set && this.appStatus.string_session),
          description: "Cần TG_API_ID, TG_API_HASH và TG_STRING_SESSION để client Telegram chạy bền.",
          action: this.appStatus.tg_api_id_set && this.appStatus.tg_api_hash_set && this.appStatus.string_session ? "Kiểm tra lại" : "Mở Settings",
        },
        {
          id: "database",
          order: 2,
          title: "Database",
          ready: Boolean(this.appStatus.database_url_set),
          description: "Khuyên dùng Supabase/Postgres để dữ liệu không mất sau restart Render free.",
          action: this.appStatus.database_url_set ? "Xem cấu hình" : "Cấu hình DB",
        },
        {
          id: "group",
          order: 3,
          title: "First group",
          ready: Number(this.appStatus.storage?.groups || 0) > 0,
          description: "Tạo group đầu tiên để gom source, target, topic và lịch auto-run vào cùng workspace.",
          action: Number(this.appStatus.storage?.groups || 0) > 0 ? "Mở Workspace" : "Tạo Group",
        },
        {
          id: "campaign",
          order: 4,
          title: "First campaign",
          ready: Number(this.appStatus.storage?.items || 0) > 0,
          description: "Sau khi có topic, thêm campaign đầu tiên để test repost flow trước khi bật auto.",
          action: Number(this.appStatus.storage?.items || 0) > 0 ? "Mở Campaign" : "Tạo Campaign",
        },
      ];
    },
    get wizardSummary() {
      const steps = this.wizardSteps;
      return {
        done: steps.filter((step) => step.ready).length,
        total: steps.length,
      };
    },
    init() {
      this.refreshStatus();
      this.statusTimer = setInterval(() => this.refreshStatus(true), 15000);
    },
    go(view) {
      this.activeView = view;
    },
    runWizardStep(stepId) {
      if (stepId === "telegram" || stepId === "database") {
        this.go("settings");
        return;
      }
      this.go("workspace");
      window.dispatchEvent(new CustomEvent("contenthub:wizard-intent", { detail: { step: stepId } }));
    },
    async refreshStatus(silent = false) {
      try {
        const response = await fetch("/api/app/status", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`status_http_${response.status}`);
        }
        this.appStatus = await response.json();
      } catch (error) {
        if (!silent) {
          console.error("APP_STATUS_FAIL", error);
        }
      }
    },
  };
};
