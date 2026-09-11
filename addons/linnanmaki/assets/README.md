# 地图源数据

`mesh/` 保存四块 L16 和 64 块 L18 OBJ、MTL、JPEG，以及源 metadata.xml（共约 23.4 MB），让全新克隆可离线重建两个版本的地图。

来源：City of Helsinki, Helsinki 3D Mesh 2017。
许可：Creative Commons Attribution 4.0（CC BY 4.0）。

- 官方说明：https://www.hel.fi/en/decision-making/information-on-helsinki/maps-and-geospatial-data/helsinki-3d
- 许可：https://creativecommons.org/licenses/by/4.0/
- 原 ZIP：https://3d.hel.ninja/data/mesh/Helsinki3D-MESH_2017_OBJ_2km-250m_ZIP/Helsinki3D_2017_OBJ_674496x2.zip
- 获取日期：2026-09-11；下载主机证书已过期，本次公开数据下载显式关闭该连接证书校验。ZIP 解压通过 CRC 校验。

这里的模型及纹理字节未修改；选择性提取自官方 ZIP。`checksums.json` 记录本次获取的 SHA-256（不是发布方提供的签名）。`.gitattributes` 禁止 Git 改写这些文件的换行，以便跨电脑校验。

两个版本均裁剪到 500×500 米，世界距离保持 1:1。旧版采样成 1 米立方体并映射至 16 种原版方块；细节版使用半米子方块几何和 128 色自定义资源包。输出不是官方产品或完整可玩乐园，详见上一级 README 和包内 ATTRIBUTION.txt。
