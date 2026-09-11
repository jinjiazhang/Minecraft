# Linnanmäki · 真实比例底图

已选定 Linnanmäki，上海迪士尼方案作为历史参考保留。

## 当前交付

基于赫尔辛基官方 2017 年三维扫描的 **500×500 米室外表面样片**，1 方块对应 1 米。约 577,534 个表面方块，256 个结构分块。它是地图制作底图，**不是完整精细复刻，也尚无可乘坐设施**。

按用户明确要求部署至 `jinjiazh.com:19132`，删除旧活动存档并创建新的平坦世界，只启用本包。服务器加载世界时自动续建底图，玩家登录和重生自动进入高空玻璃观景台，使用创造模式飞行参观。

- `output/Linnanmaki-Survey-Sample.mcpack`：基岩版行为包。
- `output/preview.png`：原始纹理采样的俯视图，非游戏截图。
- `output/report.json`：转换坐标、源文件哈希、范围和统计。
- `data/archive-index.json`：远程 2.17 GB ZIP 的完整目录；仅按 HTTP Range 下载所需文件。

## 使用样片

1. 在基岩版导入 mcpack，新建一个平坦创造测试世界，启用该行为包和作弊。
2. 世界加载后自动生成底图，写入主世界 X/Z=20000～20499，原始扫描高度加 64。请勿在这片坐标已有建筑的世界启用本包。
3. 生成约需数分钟；管理员可用 `/lintsi:stop` 暂停、`/lintsi:build` 继续。
4. 登录和重生自动进入创造模式观景台，双击跳跃飞行参观；管理员也可用 `/lintsi:visit` 返回。

写入保留未采样的空位，不主动清除原世界地形。使用新建平坦世界避免天然地形遮挡。未加载区块或结构放置失败会停止并保留续建位置。没有进行真实客户端画面与操作验收。

## 服务端运维

`deploy-fresh.sh <stage>` **会删除 `/opt/bedrock/worlds/world`**，只用于明确授权的清档部署，不用于日常更新。更新脚本文件时只重启服务，保留新存档。部署需要上传 `bundle.zip` 和预先准备的平坦世界 `flat-level.dat`。

服务端日志前缀 `[LINNANMAKI]`；`BUILD_COMPLETE 256/256` 表示结构放置已完成。控制台 `scriptevent lintsi:status check` 查询状态，`scriptevent lintsi:resume check` 继续生成。

2026-09-11 实服验收：256/256 生成完成；三个分散位置的扫描方块、观景台玻璃及平坦世界空层共五项 `testforblock` 全部成功；公网 UDP 返回 `Linnanmäki;Creative`。正常控制台 `stop` 保存并重启后，状态仍为 `256/256 running=false`。服务器版本 1.26.45.1。玩家登录/重生逻辑通过模拟事件测试，尚未进行真人客户端画面验收。

日常关服优先通过 `/opt/bedrock/cmd.sh stop` 等待 `Quit correctly`，再启动服务，确保最新进度保存；强制结束进程可能回退到最近的自动保存点，生成器会续建。

生成区使用每块不同的 tickingarea 名称，放置后移除；实服发现连续复用同名 tickingarea 会导致后续区域未加载，现已修正。观景台保持单独的加载区。

## 复现

### 在另一台电脑继续开发

需要 Git、Python 3.10+ 和 Node.js。当前部署对应本目录；四块原始模型和贴图已保存在 `assets/mesh/`，正常构建无需重新下载官方数据。

```powershell
git clone https://github.com/jinjiazhang/Minecraft.git
cd Minecraft
python -m venv .venv
# Windows 使用 .venv\Scripts\python；macOS/Linux 使用 .venv/bin/python
.venv\Scripts\python -m pip install -r addons/linnanmaki/requirements.txt
.venv\Scripts\python addons/linnanmaki/tools/build_sample.py
node addons/linnanmaki/tests/importer.cjs
```

构建输出为 `addons/linnanmaki/output/Linnanmaki-Survey-Sample.mcpack`。生成目录不提交；不要直接编辑其中的文件。

- 进服、传送和生成逻辑：`pack/scripts/main.js`。
- 比例转换、方块材质、结构生成：`tools/build_sample.py`。
- 地图几何和纹理：`assets/mesh/`；建议先创建分支再编辑。
- 原始数据的来源和校验值：`assets/README.md`、`assets/checksums.json`。
- 在线世界继续保存在 `jinjiazh.com`；Git 不包含玩家背包或服务器世界数据库。游戏中手工建造的改动需要另行导出结构或保存世界，Git 提交不会自动捕获这些改动。

当前自动生成进度已达 256/256，修改结构后不能只覆盖服务器行为包就期待旧地图自动重建。后续应增加明确的地图版本迁移或指定区域更新流程；不要把清档脚本用于日常开发更新。

### 重新获取原始数据（可选）

```powershell
python -m pip install -r addons/linnanmaki/requirements.txt
python addons/linnanmaki/tools/source_mesh.py --out addons/linnanmaki/assets/mesh --match metadata.xml
python addons/linnanmaki/tools/source_mesh.py --out addons/linnanmaki/assets/mesh --regex 'Tile_\+03[34]_\+02[89]_L16'
python addons/linnanmaki/tools/build_sample.py
node addons/linnanmaki/tests/importer.cjs
```

2026-09-11 官方下载主机证书过期，正常 HTTPS 校验失败。本次针对这个无凭据公开下载使用 `--allow-expired-source-cert`，在来源目录中记录 `tls_verified: false`。默认仍校验证书。该例外不用于其他主机、认证或代码下载；ZIP CRC 只能检查传输损坏，不能替代来源认证。

## 数据与精度

- 来源：City of Helsinki，Helsinki 3D Mesh 2017，CC BY 4.0。
- 官方介绍：https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d
- 原始目录：https://3d.hel.ninja/data/mesh/Helsinki3D-MESH_2017_OBJ_2km-250m_ZIP/
- 官方下载器坐标算法参考：https://github.com/City-of-Helsinki/Helsinki3D-cityloader
- 原始局部原点：E=25490000，N=6668000，H=0。
- 裁剪范围：E=25496500～25497000，N=6674750～6675250（EPSG:3879 平面坐标），包含园区及部分周边，不是经过验收的产权边界。
- 转换：Minecraft X=E−25496500+20000，Y=H+64，Z=6675250−N+20000；方块取整，不缩放。
- 四个源分块为 `674496d2`、`674496d4`、`675496c1`、`675496c3`，采用 L16 简化层级；此层级和方块化结果不能套用官网“20 厘米”整体模型说明。
- **高程待核验**：ZIP 元数据写 `EPSG:3879+5773`，网页写 N2000。本次保留源高程和相对高度，未声称绝对海拔已校准。
- 贴图颜色映射至 16 种原版方块，阴影也可能被映射为深色。扫描表面不是实心地形，不能直接视作室内或可通行空间。
- 网格拍摄于 2017 年，不包含后续新建或改建的全部设施。轨道细杆、遮挡、树冠与扫描伪影都需要逐项检查和手工修复。

## 检查结果与剩余工作

已独立用 nbtlib 按小端 NBT 读取全部 256 个结构文件，核对尺寸、两层索引长度、材质范围与总方块数；俯视采样覆盖率 100%（这不等于全园细节完整率）。导入脚本有暂停续建、区块超时及放置失败恢复测试。

下一阶段：真人客户端视觉与操作验收；核对园区边界与设施目录；提高必要区域的网格层级；修复道路和建筑；对有足够参考的设施逐项构建可乘坐路线。尚未取得全园室内和精确轨道数据，不能把未知路线用猜测值冒充测绘结果。
