# 验证记录 · 2026-09-12

## 1.0.2 原生挖掘

- TypeScript检查及24项测试通过；新增原生破坏事件使用原坐标、取消默认掉落、背包满/保护区不破坏、液体操作不旁挖固体、各级digger速度递增测试。
- 服务器16:21:37返回`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=6`，部署`RUSH_DEPLOY_OK`，服务active。冒烟测试实际创建六级镐子并设置、读回冒险模式开采白名单。
- 初次验证发现BDS的getCanDestroy返回不带命名空间的名称（如rainbow_ore），且展开stone变体。前两次严格名称比对导致自动回退；按返回值规范化后验证通过，没有删除矿井数据。
- 原生长按/裂纹动画由客户端驱动；没有客户端会话，未声称实测iPad操作或最终挖掘时长。

- TypeScript检查通过（Script API 2.1.0 / UI 2.0.0）。
- 14项测试通过：材料硬度和价格、唯一彩虹矿石、连续矿脉、挖空位图、个人金币升级、唯一冠军、通道扩幅、大厅建造范围、HUD文本绑定、背包满时保护、兑换防重复、触屏松手、已挖方块防重复奖励、先完成后方矿层再开放前沿。
- 真实BDS 1.26.45.1加载了10种材料和6级镐子。六种彩虹矿石原生纹理路径HEAD检查全部返回200。
- 最初发现自定义方块ambient_occlusion必须为数值，已改为0；同时发现同名tickingarea反复移除/重建造成新区块未加载，已改用独立名称并保留最近3个区域。期间部署回退到原星露谷世界，未清理旧世界。
- 首次完整生成：`RUSH_READY segments=4`，`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=4`。
- 真实服务器连续扩展：`RUSH_EXTENSION_PASS segments=6`。
- 平滑重启后恢复：`RUSH_READY segments=6`，`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=6`。
- 服务active、NRestarts=0，内存约292MiB，低于800MiB服务限制。当前世界rainbow-rush，资源包强制启用；stardew-farm与helsinki-official世界仍保留。

没有真人Minecraft客户端或iPad自动化会话，未进行实际画面审美、完整寻矿通关或多人网络体验验收。服务端检查和模拟测试不能替代这些验证。

## 1.0.1 更新验证

- TypeScript检查及20项测试通过。新增显式图标绑定、有限动画、材质粒子引用、场景迁移范围、硬矿敲击反馈、扩幅音效限频、10种材料破碎声音和粒子、保护区不挥镐测试。
- 9个物品图标的Mojang贴图地址均返回HTTP 200。声音标识已对照Mojang当前sound_definitions.json核实。
- 2026-09-12服务器15:38:35：`RUSH_READY segments=6`、`RUSH_SMOKE_PASS materials=10 picks=6 entrances=3 segments=6`、部署返回`RUSH_DEPLOY_OK`。
- 冒烟检查包含场景迁移版本及矿口半砖实物；服务active，NRestarts=0，内存306446336字节。原矿井数据库保留。
- 未进行客户端渲染/声音实测，尤其第一人称/iPad挥镐幅度仍需实际客户端验收。服务器启动成功不代表客户端动画与粒子外观已验收。
