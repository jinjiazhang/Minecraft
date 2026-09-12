# 验证记录 · 2026-09-12

- TypeScript 基岩版 Script API 2.1.0 / UI 2.0.0 类型检查通过。
- 12项 Node 测试通过：方块ID、生成范围与fill上限、播种/浇水/成熟/出货、雨天/换季、种子购买、重复收获、防重复奖励、年份与养殖、触屏事件接线、多人睡眠、无人在线暂停与1020格农地分片存储。
- 真实 BDS 1.26.45.1：初次生成曾遇到 `dirt_path`、`bricks` 不是基岩版ID，部署回滚有效；已分别替换为 `grass_path`、`brick_block`，并补充官方 `@minecraft/vanilla-data` ID验证和加载前预检。
- 独立世界成功生成，日志 `VALLEY_READY buildings=10 crops=7`。
- 真实运行时烟测 `VALLEY_SMOKE_PASS tools=8 crops=7 markers=17`：物品创建、作物/耕地方块状态、农舍地板、地点与村民数量。
- 稳定运行时约300MiB，服务 active，NRestarts=0；原 `helsinki-official` 目录保留。

没有实际Minecraft客户端/iPad会话，未验证最终画面、原生触屏按钮显示或真人钓鱼手感。场景与原作的相似程度尚未经过视觉验收，不能把服务端烟测等同于完整游玩验收。

## 1.0.1

17项测试通过，新增部分出货/取回/拒绝过期数量、作物HUD、农舍外旧睡眠票、钓鱼按住状态、体力耗尽提示。14个菜单图标路径已通过Mojang官方资源HEAD检查（全部200）。TypeScript检查通过；触屏最终显示仍需iPad客户端验收。

## 1.0.2

18项测试和类型检查通过：新增顶部title状态与底部actionbar提示分离测试，包括钓鱼期间持续刷新体力。资源包JSON可解析，使用Mojang官方hud_title_text工厂及全局文本绑定。真实iPad布局尚未视觉验收。

## 1.0.3 顶部状态栏显示修复

用户反馈顶部未显示。对照Mojang原生标题标签发现缺少 text: #text，虽然绑定了数据但没有绘制文本。已增加text和localize配置，以及标签文本绑定与行为包/资源包版本一致性测试。此前服务器烟测未覆盖客户端绘制，这次修复仍需真实客户端确认最终效果。

## 1.1.0 挖矿

30项测试通过，覆盖不同材料硬度和价值、容量/体力/层级阻拦、连续敲击与松手、重复领取保护、装备与矿包持久化、回收与转存、矿室范围和方块ID、地下矿区不会触发农场跌落传送。真实BDS输出 VALLEY_MINE_READY rooms=4 nodes=24，以及 VALLEY_SMOKE_PASS tools=8 crops=7 markers=17 mineNodes=24。服务active，内存约305MiB。尚无实际客户端矿洞游玩验收。
