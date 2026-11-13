// 将「八字命理分析」Skill 文件内嵌为 TS 模块，供 serverless 环境（Cloudflare Workers）
// 在运行时直接 import，避免依赖 node:fs。Skill 文件改动后运行 `npm run sync:skill` 重新生成。
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const files = [
  "SKILL.md",
  "references/wangshui-judgment.md",
  "references/yongshen-selection.md",
  "references/verification-questions.md"
];

const entries = [];
for (const file of files) {
  const content = readFileSync(join("八字命理分析", file), "utf8");
  entries.push(`  ${JSON.stringify(file)}: ${JSON.stringify(content)}`);
}

const output = `// 本文件由 scripts/sync-bazi-skill.mjs 自动生成，请勿手改。
// 源文件位置：八字命理分析/（改动后运行 npm run sync:skill 同步）。

export const baziSkillFiles: Record<string, string> = {
${entries.join(",\n")}
};
`;

writeFileSync(join("app", "lib", "baziSkillContent.ts"), output);
console.log(`已生成 app/lib/baziSkillContent.ts（${files.length} 个文件，共 ${entries.length} 条）`);
