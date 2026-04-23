# 数据脚本治理说明

`backend/scripts/` 中包含历史数据导入、迁移、修复、审计和补全脚本。当前规则是：正式任务优先通过 `backend/package.json` 中的 npm scripts 执行；未登记脚本默认视为历史或维护脚本，不作为日常入口。

## 官方入口

这些命令目前由 `backend/package.json` 暴露，优先使用它们：

```bash
npm run db:ensure-indexes
npm run migrate:redlist-alert-user-state
npm run migrate:chinese-names
npm run migrate:frontend-fields
npm run migrate:iplant-enrichment
npm run import:wcvp
npm run import:iucn
npm run import:wdpa
npm run data:import -- --target=protected_areas --file=./data.csv --dry-run
npm run data:import:wgsrpd-map -- --dry-run
npm run data:import:wgsrpd-map
npm run build:wgsrpd:level3
npm run wcvp:sync:plants-fields
npm run taxonomy:repair-chain
npm run taxonomy:migrate-subphylum
npm run migrate:schema:2026-03
npm run fetch:chinese-names
npm run wcvp:complete
npm run wcvp:chinese:coverage
npm run images:standardize:common
npm run iplant:enrich
```

## WCVP 规则

WCVP 是大型基础数据源，通常只需要在初始化或重大数据重建时导入。

当前官方入口：

```bash
npm run import:wcvp
```

历史变体：

- `import-wcvp-fast.js`
- `import-wcvp-simplified.js`

这些历史变体不应作为默认入口。除非明确知道差异和风险，否则不要直接运行。

## 数据维护与批量导入工具

轻量级维护导入入口：

```bash
npm run data:import -- --target=protected_areas --file=./data-source/protected-areas-patch.csv --dry-run
npm run data:import -- --target=protected_areas --file=./data-source/protected-areas-patch.csv
npm run data:import -- --target=threatened_species --file=./data-source/iucn-patch.json
```

支持格式：

- JSON：数组，或包含 `data` / `rows` 数组的对象。
- CSV：首行为字段名，字段名应与目标数据表字段一致。

当前支持目标：

- `plants`：以 `id` 作为 upsert 键。
- `threatened_species`：以 `scientific_name` 作为 upsert 键。
- `protected_areas`：以 `site_id` 作为 upsert 键。

该工具面向少量修正、补充和毕业设计演示场景，不替代 WCVP、IUCN、WDPA 等大型正式导入脚本。

## 脚本分类

建议按用途理解现有脚本：

- `import-*`：外部数据导入，例如 WCVP、IUCN、WDPA。
- `migrate-*`：数据库结构或字段迁移。
- `fill-*`、`enrich-*`、`populate-*`：数据补全和富化。
- `repair-*`、`cleanup-*`、`dedupe-*`：修复、清理和去重。
- `audit-*`、`check-*`、`compare-*`：审计、检查和对比报告。
- `tmp-*`、`debug-*`、`ddd.txt`：临时或调试文件，后续可归档或删除。

## 新增脚本要求

新增脚本必须满足至少一项：

- 在 `backend/package.json` 的 `scripts` 中暴露为正式命令。
- 在本文件登记用途、输入、输出、是否可重复执行、是否支持 dry-run。
- 放入未来的 `archive/` 目录，并明确只是一次性历史脚本。

建议每个长期脚本都支持：

- `--dry-run`：只预览，不写库。
- `--limit` 或 `--batch`：限制处理规模。
- 明确日志输出。
- 可重复执行或清楚声明不可重复执行。

## 当前暂不移动脚本

第一阶段只建立索引和规则，不批量删除或移动脚本。后续可以再把临时脚本和旧导入变体迁入 `backend/scripts/archive/`。
