"use client";

import { Box, Button, Card, Chip, Stack, Typography } from "@mui/material";
import { LayoutDashboard, Settings2 } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

type MetricTone = "blue" | "cyan" | "emerald" | "amber";
function MetricIcon({ tone, Icon }: { tone: MetricTone; Icon: ComponentType<{ size?: number }> }) {
  const palette = {
    blue: "linear-gradient(135deg, #2f80ff, #5b8cff)",
    cyan: "linear-gradient(135deg, #19c5e8, #2fd3d3)",
    emerald: "linear-gradient(135deg, #15b56b, #2dd4bf)",
    amber: "linear-gradient(135deg, #f59e0b, #f97316)",
  }[tone];
  return (
    <Box className="metric-icon" sx={{ background: palette }}>
      <Icon size={22} />
    </Box>
  );
}

export function SectionCard({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Card className="panel-card">
      <Box sx={{ p: 2 }}>
        <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={2} sx={{ mb: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, letterSpacing: "-0.03em" }}>
              {title}
            </Typography>
            {subtitle ? <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography> : null}
          </Box>
          {action}
        </Stack>
        {children}
      </Box>
    </Card>
  );
}

export function DashboardPanels({
  appStatus,
  metrics,
  onGoWorkspace,
  onGoSettings,
}: {
  appStatus: { database_url_set?: boolean; string_session?: boolean };
  metrics: ReadonlyArray<{ label: string; value: string; note: string; tone: MetricTone; icon: ComponentType<{ size?: number }> }>;
  onGoWorkspace: () => void;
  onGoSettings: () => void;
}) {
  return (
    <Stack gap={1.5}>
      <Box className="metric-grid">
        {metrics.map((metric) => (
          <Card key={metric.label} className="metric-card">
            <Stack direction="row" alignItems="start" justifyContent="space-between" gap={2}>
              <Stack gap={1.1}>
                <Stack direction="row" alignItems="center" gap={1}>
                  <MetricIcon tone={metric.tone} Icon={metric.icon} />
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.15 }}>{metric.label}</Typography>
                </Stack>
                <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.05em", lineHeight: 1 }}>
                  {metric.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {metric.note}
                </Typography>
              </Stack>
            </Stack>
          </Card>
        ))}
      </Box>
      <Box className="panel-grid">
        <SectionCard title="Setup Wizard" subtitle="Telegram → DB → first group → first campaign" action={<Chip label="2 / 4 BƯỚC XONG" color="warning" variant="outlined" className="soft-chip" />}>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5 }}>
            {[
              { label: "Telegram", state: "OK" },
              { label: "Database", state: "OK" },
              { label: "First Group", state: "TODO" },
              { label: "First Campaign", state: "TODO" },
            ].map((item) => (
              <Card key={item.label} variant="outlined" sx={{ p: 1.5, borderRadius: 3, bgcolor: "#f8fafc" }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography sx={{ fontWeight: 800, textTransform: "uppercase", fontSize: 12 }}>{item.label}</Typography>
                  <Chip label={item.state} size="small" color={item.state === "OK" ? "success" : "warning"} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
                  {item.label === "Telegram"
                    ? "Cần TG_API_ID, TG_API_HASH và TG_STRING_SESSION để client Telegram chạy bền."
                    : item.label === "Database"
                      ? "Khuyên dùng Supabase/Postgres để dữ liệu không mất sau restart Render free."
                      : item.label === "First Group"
                        ? "Tạo group đầu tiên để gom source, target, topic và lịch auto-run vào cùng workspace."
                        : "Sau khi có topic, thêm campaign đầu tiên để test repost flow trước khi bật auto."}
                </Typography>
              </Card>
            ))}
          </Box>
        </SectionCard>

        <SectionCard title="Operational Readiness" subtitle="App đã sẵn sàng chạy như một tool riêng chưa?">
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.25 }}>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 800 }}>Storage backend</Typography>
              <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900 }}>
                {appStatus.database_url_set ? "Supabase / Postgres" : "SQLite local/runtime"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Dùng DB bền thay vì SQLite local để tránh mất data khi Render free restart.
              </Typography>
            </Card>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 800 }}>Telegram auth</Typography>
              <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900, color: appStatus.string_session ? "#16a34a" : "#b54708" }}>
                {appStatus.string_session ? "TG_STRING_SESSION đã sẵn" : "Thiếu TG_STRING_SESSION"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Ưu tiên string session để không phụ thuộc file session local.
              </Typography>
            </Card>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 800 }}>Render wake strategy</Typography>
              <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900 }}>
                Cron ping + /healthz
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Giữ service tỉnh bằng ping ngoài mỗi 10-14 phút khi dùng free tier.
              </Typography>
            </Card>
            <Card variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 800 }}>UI architecture</Typography>
              <Typography variant="h6" sx={{ mt: 0.5, fontWeight: 900 }}>
                Dashboard / Workspace / Settings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Tách rõ tổng quan, vận hành nội dung và cấu hình deploy.
              </Typography>
            </Card>
          </Box>
        </SectionCard>
      </Box>

      <Box className="panel-grid">
        <SectionCard title="Lộ trình nâng cấp tiếp theo" subtitle="Upgrade Path">
          <Stack gap={1.25}>
            {[
              { n: 1, title: "Chạy ổn trên Render free", copy: "Giữ worker nhẹ, ping /healthz, và chuyển dần sang Supabase để bỏ rủi ro mất DB." },
              { n: 2, title: "Chuẩn hoá Settings", copy: "Thêm kiểm tra env, string session, DB mode và chẩn đoán deploy ngay trong UI." },
              { n: 3, title: "Đẩy dần sang tool productized", copy: "Tách component, thêm setup wizard, health probes và task rails rõ hơn." },
            ].map((step) => (
              <Box key={step.n} sx={{ display: "flex", gap: 1.25, p: 1.25, border: "1px solid rgba(148,163,184,0.18)", borderRadius: 3 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: "999px", bgcolor: "#dbeafe", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>
                  {step.n}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 800 }}>{step.title}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {step.copy}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Stack>
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Nhấn để mở màn tiếp theo">
          <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
            <Button variant="contained" fullWidth startIcon={<LayoutDashboard size={16} />} onClick={onGoWorkspace}>
              Mở Workspace
            </Button>
            <Button variant="outlined" fullWidth startIcon={<Settings2 size={16} />} onClick={onGoSettings}>
              Đi tới Settings
            </Button>
          </Stack>
        </SectionCard>
      </Box>
    </Stack>
  );
}
