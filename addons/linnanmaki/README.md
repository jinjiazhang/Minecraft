# Linnanmäki · 真实比例底图

已选定 Linnanmäki，上海迪士尼方案作为历史参考保留。

## 当前交付

### 当前线上：官方 Helsinki3D+ 基岩版世界

2026-09-12 更新：启用 `official/pack` 管理包，进服和重生进入 Linnanmäki 中心附近（X=-6940，Z=-6585），高度按实际地表自动确定，不铺平台、不修改官方建筑。管理员可用 `/lintsi:visit` 返回；`/lintsi:reset` 后由同一管理员在 30 秒内执行 `/lintsi:confirm`，恢复整份官方存档，清除所有玩家和建筑改动，服务器短暂断开后重新连接。

重置源固定保存于 `/opt/bedrock/official-source/Helsinki3D_MC_bedrock.zip`，每次先校验 SHA-256 与 ZIP CRC、解压到独立目录，再正常停服并切换；启动和园区出生点就绪失败时恢复原活动目录。不创建持久备份。恢复后自动装入管理包，出生点和重置命令仍可用。旧的 `wipe-watch.service` 已禁用，改由 `helsinki-reset-watch.service` 接收精确的脚本日志请求，玩家聊天不能触发。安装入口 `official/install.sh`，需先上传 `official/` 到服务器 `/tmp/helsinki-official/admin`。

坐标核验：按官方生成工具的旋转与中心偏移推导，Minecraft X=6668000−N+125，Z=25490000−E+125；与已有 2017 源网格的 3019 个有效地表点匹配，校正高度偏移 +11 米后高度残差中位数为 0 米（8 米采样，不能视作逐块精度承诺）。命令权限、同玩家确认、超时、重复请求、ZIP 校验、目录穿越及聊天伪造拒绝均有测试；尚未由真人客户端执行破坏性重置。

2026-09-11 已按用户要求从官方服务器直接下载并切换到现成的全市基岩版地图。当前活动世界为 `/opt/bedrock/worlds/helsinki-official`，旧转换包已停用（日志 `Pack Stack - None`），不要求下载自定义资源包。没有额外复制备份旧存档；原 `world` 目录未作为活动世界加载。

下载源：https://3d.hel.ninja/data/minecraft_Helsinki/Helsinki3D_MC_bedrock.zip 。ZIP 为 1,069,797,706 字节，CRC 检查通过；SHA-256 和 TLS 例外记录在 `assets/official-bedrock-source.json`。包内文件日期为 2021 年，不能把下载目录的 2025 年时间当作测绘年份。原始存档版本为 1.14，当前 BDS 1.26.45.1 已成功加载。

初次部署保留的官方出生点为 `-5007,13,-6758`，现已由上述管理包改为园区出生点。尚未做真人客户端视觉验收。以下 0.2 / 0.1 是此前自制底图，当前不再部署。

复现部署：服务器创建 `/tmp/helsinki-official`，将官方 ZIP 下载为该目录的 `official.zip`；运行 `tools/prepare_official.py` 校验并解压，再以 root 运行 `deploy-official.sh`。默认应验证 HTTPS 证书；本次因官方证书过期，仅此公开下载使用 curl `-k`。部署脚本要求目标世界目录不存在，不会覆盖一个已安装的官方世界。大型官方存档不提交 Git，Git 保存来源、校验和部署流程。

### 0.2 半米细节版

当前改进版使用 64 块 L18 网格，世界距离仍然是 **1 方块格=1 米**；在每个格子内用自定义几何表达 0.5 米子方块，避免把整座乐园放大。颜色由 16 种原版材质改为从扫描采样得到的 128 种自定义颜色；同一位置的多个采样先平均，再按 Lab 色差匹配，修复旧版最后一个三角面覆盖颜色的问题。贴图采样采用双线性插值，材质关闭额外方向变暗，减少扫描阴影被再次加深。

- 约 660,037 个世界方块；其中 653,613 个使用非完整立方体形状。
- 同一批源颜色上的平均 CIE76 色差：16 色 10.50，128 色 2.81，降低约 73%。此指标不等于与现实建筑涂料的色差；原始航拍阴影仍存在。
- 资源包必须随行为包启用；服务器设为进服要求下载资源包。
- 新区域 X/Z=22000～22499，观景台 22200,191,22200，使用独立进度 `lintsi:detail_v2_tile`。旧区域 X/Z=20000～20499 保留。
- 输出 `output/detail/Linnanmaki-Detail.mcaddon`，包含行为包和资源包。
- `output/detail/color-comparison.png` 是颜色映射对比；`geometry-comparison.png` 是同一 L18 裁剪区域的离线几何对比，均非游戏实机截图。
- 子方块使用占用区域的外包围盒作为碰撞体；并非每个半米小格都有独立碰撞。当前主要用于飞行参观。

```powershell
python -m pip install -r addons/linnanmaki/requirements.txt
python addons/linnanmaki/tools/build_detail.py
python addons/linnanmaki/tools/preview_detail.py
python addons/linnanmaki/tests/detail.py
node addons/linnanmaki/tests/importer.cjs
```

新版构建从 `assets/mesh/*/*L18*.obj` 读取，原始资料随代码保存在仓库中。修改网格后缓存自动失效。`tools/detail_materials.py` 定义半米形状和资源包；最多 32,768 种状态组合，低于 65,536 的自定义方块状态上限。

### 0.1 初始样片（保留作对照）

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

细节版使用 `deploy-detail.sh <stage>`，stage 需为 `/tmp/lintsi-update.*`，内含 `detail.mcaddon`。该流程正常保存停服，备份当前世界和配置，再启用 BP/RP 0.2，保留世界并在新坐标生成。部署后应检查日志、方块状态、资源包启用与内存；它不是自动的全流程运行时验收工具。初次上线备份：`/opt/bedrock/backups/lintsi-before-detail-20260911-210939`。

服务端日志前缀 `[LINNANMAKI]`；`BUILD_COMPLETE 256/256` 表示结构放置已完成。控制台 `scriptevent lintsi:status check` 查询状态，`scriptevent lintsi:resume check` 继续生成。

2026-09-11 细节版实服验收：256/256 生成完成；正常控制台 `stop` 保存并重启后，三个分散位置的自定义方块（包含形状和颜色状态）、新版观景台玻璃及旧版扫描方块共五项 `testforblock` 全部成功，状态为 `256/256 running=false`。服务器版本 1.26.45.1。生成时临时将内存限制提升到 1 GiB，峰值约 781 MiB；保存重启后恢复 800 MiB 限制，空服约 426 MiB。玩家登录/重生逻辑通过模拟事件测试，尚未进行真人客户端画面与性能验收。

日常关服优先通过 `/opt/bedrock/cmd.sh stop` 等待 `Quit correctly`，再启动服务，确保最新进度保存；强制结束进程可能回退到最近的自动保存点，生成器会续建。

生成区使用每块不同的 tickingarea 名称，放置后移除；实服发现连续复用同名 tickingarea 会导致后续区域未加载，现已修正。观景台保持单独的加载区。

## 复现

### 在另一台电脑继续开发

需要 Git、Python 3.10+ 和 Node.js。当前部署对应本目录；4 块 L16 和 64 块 L18 原始模型及贴图已保存在 `assets/mesh/`，正常构建无需重新下载官方数据。

```powershell
git clone https://github.com/jinjiazhang/Minecraft.git
cd Minecraft
python -m venv .venv
# Windows 使用 .venv\Scripts\python；macOS/Linux 使用 .venv/bin/python
.venv\Scripts\python -m pip install -r addons/linnanmaki/requirements.txt
.venv\Scripts\python addons/linnanmaki/tools/build_detail.py
node addons/linnanmaki/tests/importer.cjs
```

上方命令构建当前细节版；`build_sample.py` 仅用于旧版对照包。生成目录不提交；不要直接编辑其中的文件。

- 进服、传送和生成逻辑：`pack/scripts/main.js`。
- 比例转换、结构生成：`tools/build_detail.py`；半米形状与颜色材质：`tools/detail_materials.py`。
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
- 转换：细节版 Minecraft X=E−25496500+22000，Y=H+64，Z=6675250−N+22000；不缩放，轮廓采样至半米网格。旧版 X/Z 偏移为 20000。
- 四个源分区为 `674496d2`、`674496d4`、`675496c1`、`675496c3`，细节版使用其 64 块 L18 网格，旧版使用 L16；半米表达网格不是测绘精度承诺，不能套用官网“20 厘米”整体模型说明。
- **高程待核验**：ZIP 元数据写 `EPSG:3879+5773`，网页写 N2000。本次保留源高程和相对高度，未声称绝对海拔已校准。
- 细节版贴图颜色映射至 128 种自定义颜色，旧版使用 16 种原版方块；航拍阴影仍会表现为深色。扫描表面不是实心地形，不能直接视作室内或可通行空间。
- 网格拍摄于 2017 年，不包含后续新建或改建的全部设施。轨道细杆、遮挡、树冠与扫描伪影都需要逐项检查和手工修复。

## 检查结果与剩余工作

已独立用 nbtlib 按小端 NBT 读取全部 256 个结构文件，核对尺寸、两层索引长度、材质范围与总方块数；俯视采样覆盖率 100%（这不等于全园细节完整率）。导入脚本有暂停续建、区块超时及放置失败恢复测试。

下一阶段：真人客户端视觉与操作验收；核对园区边界与设施目录；提高必要区域的网格层级；修复道路和建筑；对有足够参考的设施逐项构建可乘坐路线。尚未取得全园室内和精确轨道数据，不能把未知路线用猜测值冒充测绘结果。
