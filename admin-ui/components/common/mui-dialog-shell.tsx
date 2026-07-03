"use client";

import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export function MuiDialogShell({
  open,
  onClose,
  title,
  subtitle,
  children,
  actionLabel = "Lưu thay đổi",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  actionLabel?: string;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 4 } }}>
      <DialogTitle sx={{ pb: 1.25 }}>
        <Stack direction="row" alignItems="start" justifyContent="space-between" gap={2}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {title}
            </Typography>
            {subtitle ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            ) : null}
          </Box>
          <IconButton onClick={onClose} size="small">
            <X size={18} />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>{children}</DialogContent>
      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button variant="outlined" onClick={onClose}>
          Đóng
        </Button>
        <Button variant="contained">{actionLabel}</Button>
      </DialogActions>
    </Dialog>
  );
}
