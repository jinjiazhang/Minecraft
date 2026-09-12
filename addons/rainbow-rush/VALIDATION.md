# 验证记录 · 2026-09-12

- TypeScript检查通过（Script API 2.1.0 / UI 2.0.0）。
- 14项测试通过：材料硬度和价格、唯一彩虹矿石、连续矿脉、挖空位图、个人金币升级、唯一冠军、通道扩幅、大厅建造范围、HUD文本绑定、背包满时保护、兑换防重复、触屏松手、已挖方块防重复奖励、先完成后方矿层再开放前沿。
- 真实BDS 1.26.45.1加载了10种材料和6级镐子。六种彩虹矿石原生纹理路径HEAD检查全部返回200。
- 最初发现自定义方块ambient_occlusion必须为数值，已改为0；同时发现同名tickingarea反复移除/重建造成新区块未加载，已改用独立名称并保留最近3个区域。期间部署回退到原星露谷世界，未清理旧世界。
- 首次完整生成：`RUSH_READY segments=4`，`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=4`。
- 真实服务器连续扩展：`RUSH_EXTENSION_PASS segments=6`。
- 平滑重启后恢复：`RUSH_READY segments=6`，`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=6`。
- 服务active、NRestarts=0，内存约292MiB，低于800MiB服务限制。当前世界rainbow-rush，资源包强制启用；stardew-farm与helsinki-official世界仍保留。

没有真人Minecraft客户端或iPad自动化会话，未进行实际画面审美、完整寻矿通关或多人网络体验验收。服务端检查和模拟测试不能替代这些验证。
