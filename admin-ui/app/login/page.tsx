"use client";

import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    document.cookie = "tele_content_auth=1; path=/; max-age=86400; samesite=lax";
    router.push(next);
  };

  return (
    <Card sx={{ width: "min(420px, 100%)" }}>
      <CardContent sx={{ p: 3 }}>
        <Stack component="form" gap={2} onSubmit={onSubmit}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 900, letterSpacing: "-0.04em" }}>
              Sign in
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Màn login riêng cho UI MUI.
            </Typography>
          </Box>
          <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button variant="contained" fullWidth type="submit">
            Đăng nhập
          </Button>
          <Button component={Link} href="/" variant="text">
            Về dashboard
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, background: "linear-gradient(180deg, #eef2f7 0%, #dde4ed 100%)" }}>
      <Suspense fallback={<Card sx={{ width: "min(420px, 100%)", minHeight: 240 }} />}>
        <LoginForm />
      </Suspense>
    </Box>
  );
}
