/**
 * Pulls profile stats from GitHub's official GraphQL API and writes data/stats.json.
 * Needs GH_TOKEN. The default Actions token sees public activity; add a PROFILE_TOKEN secret
 * (fine-grained or classic with read:user) if you also want private contributions counted.
 */
import { writeFileSync } from "node:fs";
import { PROFILE } from "./tokens.ts";

const token = process.env.GH_TOKEN;
if (!token) throw new Error("GH_TOKEN is not set");

const query = `
query($login: String!) {
  user(login: $login) {
    followers { totalCount }
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100) {
      totalCount
      nodes {
        stargazerCount
        languages(first: 8, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
    contributionsCollection {
      totalCommitContributions
      totalPullRequestContributions
      totalIssueContributions
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
  }
}`;

const res = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query, variables: { login: PROFILE.login } }),
});
if (!res.ok) throw new Error(`GitHub API ${res.status}: ${await res.text()}`);
const json = (await res.json()) as any;
if (json.errors) throw new Error(JSON.stringify(json.errors));
const u = json.data.user;
const cc = u.contributionsCollection;

const days: { date: string; count: number }[] = cc.contributionCalendar.weeks
  .flatMap((w: any) => w.contributionDays)
  .map((d: any) => ({ date: d.date, count: d.contributionCount }));

// Streaks: the current one may still be alive if today has no contributions yet.
let longest = 0;
let run = 0;
for (const d of days) {
  run = d.count > 0 ? run + 1 : 0;
  longest = Math.max(longest, run);
}
let current = 0;
for (let i = days.length - 1; i >= 0; i--) {
  if (days[i].count > 0) current++;
  else if (i === days.length - 1) continue;
  else break;
}

const bytes = new Map<string, number>();
let stars = 0;
for (const r of u.repositories.nodes) {
  stars += r.stargazerCount;
  for (const e of r.languages.edges) bytes.set(e.node.name, (bytes.get(e.node.name) ?? 0) + e.size);
}
const total = [...bytes.values()].reduce((a, b) => a + b, 0) || 1;
const langs = [...bytes.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 6)
  .map(([name, b]) => ({ name, pct: (b / total) * 100 }));

const stats = {
  updated: new Date().toISOString().slice(0, 10),
  commits: cc.totalCommitContributions,
  prs: cc.totalPullRequestContributions,
  issues: cc.totalIssueContributions,
  repos: u.repositories.totalCount,
  stars,
  followers: u.followers.totalCount,
  total: cc.contributionCalendar.totalContributions,
  streak: { current, longest },
  langs,
  days,
};
writeFileSync(new URL("../data/stats.json", import.meta.url), JSON.stringify(stats, null, 2) + "\n");
console.log("stats.json written");
