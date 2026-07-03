"use client";

import { Box, Button, Card, CardContent, Chip, Divider, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function SettingsPanels() {
  const router = useRouter();
  const statusTiles = [
    ["Database", "Supabase / Postgres"],
    ["Telegram", "TG string session"],
    ["Deploy", "Render free ready"],
  ] as const;
  return (
    <Box className="content-shell" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
            Settings
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Layout cấu hình tách riêng theo style prive_bot, ưu tiên rõ trạng thái và thao tác nhanh.
          </Typography>
        </Box>
        <Stack direction="row" gap={1}>
          <Chip label="MUI Route" variant="outlined" className="soft-chip" />
          <Button component={Link} href="/" variant="contained">
            Về Dashboard
          </Button>
          <Button variant="outlined" onClick={() => { document.cookie = "tele_content_auth=; path=/; max-age=0"; router.push("/login"); }}>
            Logout
          </Button>
        </Stack>
      </Stack>
      <Box className="panel-grid" sx={{ gridTemplateColumns: "1.1fr 0.9fr", alignItems: "start" }}>
        <Card className="panel-card">
          <CardContent sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2} sx={{ mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontWeight: 800 }}>Runtime settings</Typography>
                <Typography variant="body2" color="text.secondary">
                  Các secret chính và kết nối nền.
                </Typography>
              </Box>
              <Chip label="Protected" size="small" variant="outlined" color="primary" />
            </Stack>
            <Divider sx={{ mb: 1.5 }} />
            <Stack gap={1.25}>
              <TextField label="TG_API_ID" />
              <TextField label="TG_API_HASH" />
              <TextField label="TG_STRING_SESSION" multiline minRows={4} />
              <TextField label="DATABASE_URL" multiline minRows={3} />
              <Button variant="contained">Lưu cấu hình</Button>
            </Stack>
          </CardContent>
        </Card>
        <Stack gap={1.5}>
          <Card className="panel-card">
            <CardContent sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Status tiles</Typography>
              <Stack gap={1}>
                {statusTiles.map(([label, value]) => (
                  <Box key={label} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.25, borderRadius: 3, border: "1px solid rgba(148,163,184,0.16)", bgcolor: "#f8fafc" }}>
                    <Typography sx={{ fontWeight: 700 }}>{label}</Typography>
                    <Typography sx={{ fontWeight: 800, color: "#334155" }}>{value}</Typography>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
          <Card className="panel-card">
            <CardContent sx={{ p: 2 }}>
              <Typography sx={{ fontWeight: 800, mb: 1 }}>Deploy checklist</Typography>
              <Stack gap={1}>
                {[
                  ["TG_API_ID + TG_API_HASH", true],
                  ["TG_STRING_SESSION", true],
                  ["DATABASE_URL", true],
                  ["/healthz on Render", false],
                ].map(([label, ok]) => (
                  <Box key={String(label)} sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 1.1, borderRadius: 3, border: "1px solid rgba(148,163,184,0.16)" }}>
                    <Typography sx={{ fontWeight: 700 }}>{label as string}</Typography>
                    <Chip label={ok ? "OK" : "Manual"} size="small" color={ok ? "success" : "warning"} variant="outlined" />
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
}
