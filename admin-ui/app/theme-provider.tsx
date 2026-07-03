"use client";

import { createTheme, ThemeProvider as MuiThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#2f80ff",
    },
    secondary: {
      main: "#11c8f0",
    },
    background: {
      default: "#eef2f7",
      paper: "#ffffff",
    },
    text: {
      primary: "#101828",
      secondary: "#667085",
    },
  },
  shape: {
    borderRadius: 16,
  },
  typography: {
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontWeight: 800, letterSpacing: "-0.04em" },
    h5: { fontWeight: 800, letterSpacing: "-0.03em" },
    h6: { fontWeight: 800, letterSpacing: "-0.02em" },
    button: { textTransform: "none", fontWeight: 700 },
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(148, 163, 184, 0.18)",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.06)",
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
  },
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <MuiThemeProvider theme={theme}>{children}</MuiThemeProvider>;
}
