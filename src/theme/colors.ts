export const C = {
  ink: "#15182A",
  lcdBg: "#1C2335",
  panel: "#28324A",
  panelHi: "#3A4A6B",
  line: "#5C6E92",
  text: "#E6F1F7",
  textDim: "#90A2B6",
  accent: "#3FA7F6",
  green: "#36D17A",
  gold: "#FFC833",
  purple: "#B36BE6",
  red: "#FF5A78",
  teal: "#28E5D0",
  orange: "#FF914D",
  shell: "#2A3340",
  shellHi: "#46566B",
} as const;

export type ColorToken = keyof typeof C;
