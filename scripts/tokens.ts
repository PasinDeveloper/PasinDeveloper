/**
 * Design tokens, copied from the portfolio (src/app/globals.css).
 * When the portfolio's look changes, edit this one file and rebuild.
 */
export type ThemeName = "dark" | "light";

export interface Tokens {
  paper: string;
  mount: string;
  text: string;
  muted: number; // opacity of text used for secondary copy
  line: number; // opacity of text used for hairlines
  accent: string; // the seal's cinnabar
  brass: [string, string, string];
}

export const TOKENS: Record<ThemeName, Tokens> = {
  dark: {
    paper: "#18202f",
    mount: "#0d1119",
    text: "#eadfc2",
    muted: 0.62,
    line: 0.3,
    accent: "#d0393f",
    brass: ["#e2c27a", "#8a6a2c", "#c9a55e"],
  },
  light: {
    paper: "#efe5cf",
    mount: "#8d7752",
    text: "#1f1b16",
    muted: 0.62,
    line: 0.34,
    accent: "#a3141c",
    brass: ["#e2c27a", "#8a6a2c", "#c9a55e"],
  },
};

export const PROFILE = {
  login: "PasinDeveloper",
  name: "Pasin Developer",
  fullName: "Pasindu Hasanga",
  sinhala: "පසිඳු හසංග",
  zhName: "帕森度",
  seal: "帕",
  tagline: "Full Stack Ninja",
  portfolio: "https://www.pasindev.ninja",
  linkedin: "https://linkedin.com/in/pasindeveloper",
} as const;

export const STACK: { group: string; items: string[] }[] = [
  { group: "Front end", items: ["Next.js", "React", "TypeScript", "Tailwind CSS", "Motion", "Three.js"] },
  { group: "Back end", items: ["NestJS", "Node.js", "Express", "Laravel", "PHP"] },
  { group: "Data", items: ["PostgreSQL", "Prisma", "MongoDB", "MySQL", "Appwrite"] },
  { group: "Craft", items: ["Figma", "Git", "Yarn", "pnpm", "Bun", "WordPress"] },
];
