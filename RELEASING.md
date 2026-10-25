# 发版手册

仓库：`https://github.com/jkljklkjj/webGame`
包名：`chargrid-arcade`（npm 上 `terminal-arcade` 已被他人占用）

---

## 0. 先搞清楚 OTP 是什么

**OTP = One-Time Password，一次性密码**，这里特指 TOTP 的 **6 位数字**。

- **不能随便写。** 服务器用「你的共享密钥 + 当前时间」独立算出一个值来比对，错一位就是失败（表现为 `EOTP`，或直接 `403 ... Two-factor authentication ... required`）。
- **从哪来**：当初在 npmjs.com 开启 2FA 时，页面给过一个二维码/密钥串，你用 Google Authenticator、Microsoft Authenticator、1Password、Authy、Bitwarden 这类 App 扫进去。之后 App 里 `npmjs.com` 那一条会每 30 秒刷新一次 6 位数字，**发版时读当前显示的那个**。
- **30 秒过期，且一码只能用一次**。所以顺序很重要：先 `npm test`，测试跑完再打开 App 读数，立刻执行 publish。
- **30 秒不够用怎么办**：`npm publish` 会自动跑 `prepublishOnly`（约 10 秒），容易吃掉窗口 —— 先手动 `npm test`，再用 `--ignore-scripts` 发布（下面第 1 步就是这么写的）。

### 你没有这个 App 条目怎么办

去 https://www.npmjs.com/settings/~/profile 看 **Two-factor authentication** 那一栏：

| 状态 | 含义 | 能发版吗 |
| --- | --- | --- |
| `Authenticator app`（TOTP） | 有 6 位码 | ✅ 走本文档 |
| `Security key` / passkey | **根本没有 6 位码** | ❌ `--otp` 无解，只能走「bypass 2FA token（2027-01 前有效）」或等 CI |
| 未开启 | 那 403 是别的原因 | 先查 `npm profile get` 的 `two-factor auth` |

---

## 1. 手动发第一个版本（必须做，绕不过）

npm **不支持用 OIDC 发首版**（`npm/cli#8544` 仍是 open 状态）：

> "it's not possible to publish the initial version of a package using OIDC, it needs to be published manually or using a token."

包在 npm 上存在之后，才能配置 Trusted Publisher。

```cmd
cd /d D:\lora\webGame
npm login                                  :: 走仓库里的 .npmrc → registry.npmjs.org
npm test                                   :: 先跑完，避免 OTP 过期
npm publish --ignore-scripts --otp=834170   :: 换成 App 里此刻的 6 位码，不是占位符
```

验收：

```cmd
npm view chargrid-arcade version           :: 应输出 1.2.0
```

## 2. 推到 GitHub

仓库地址已写进 `package.json`（`repository.url = git+https://github.com/jkljklkjj/webGame.git`），
**Trusted publishing 校验的就是这个字段**，别改错。本目录已是 git 仓库（`main` 分支、已提交）：

```cmd
git remote add origin https://github.com/jkljklkjj/webGame.git
git push -u origin main
```

## 3. 配置 Trusted Publisher

npmjs.com → `chargrid-arcade` → **Settings** → **Trusted Publisher** → 选 **GitHub Actions**：

| 字段 | 填什么 |
| --- | --- |
| Organization or user | `jkljklkjj` |
| Repository | `webGame` |
| Workflow filename | `publish.yml`（只写文件名，含 `.yml`，**区分大小写**） |
| Environment name | 留空 |
| Allowed actions | ⚠️ **必须勾上 `npm publish`** |

两个坑：

1. **Allowed actions 默认不含 `npm publish`。** 2026-09 之后新建的配置默认只允许 `npm stage publish`，不勾就永远 403。
2. **配置建好后 2 天内必须有一次成功发布**，否则配置过期作废，只能删掉重建。所以配完马上做第 4 步。

## 4. 用 CI 发一个版本验证

```cmd
npm version patch          :: 1.2.0 → 1.2.1，顺带打 tag v1.2.1
git push && git push --tags
```

- tag 必须是 `v1.2.1` 这种形式，且与 `package.json` 的 `version` 一致（workflow 里有硬校验，不一致直接失败）。
- Actions 跑通后，包页面会出现 **Provenance** 徽章（公开仓库 + 公开包自动生成，不需要 `--provenance`）。
- 成功后加固：包 → Settings → **Publishing access** → 选 **"Require two-factor authentication and disallow tokens"**，把 token 通道彻底关掉，只留 OIDC。

---

## 日常发版（配置好之后）

```bash
npm test
npm version patch          # 或 minor / major
git push && git push --tags
```

全程不碰 token、不碰 OTP。

---

## 排错

| 现象 | 原因 |
| --- | --- |
| `403 ... Two-factor authentication or granular access token`（本地） | `--otp` 没带，或填了占位符/过期码 → 见第 0 节 |
| `EOTP`：Incorrect or expired OTP | 码错了或超过 30 秒，重新读一次 |
| CI 报 `ENEEDAUTH` / `Unable to authenticate` | workflow 文件名没对上（含 `.yml`、大小写）、仓库名不符，或漏了 `id-token: write` |
| CI 报 `403`，本地却正常 | Trusted Publisher 的 Allowed actions 没勾 `npm publish`；或 `repository.url` 与仓库不一致 |
| `npm ci` 报 `requires package-lock.json` | 本项目零依赖、无 lockfile，不要用 `npm ci`，直接 `npm test` |
| 配置突然不可用 | 建好后 2 天内没有成功发布，配置已过期，删掉重建 |
| 自托管 runner 失败 | trusted publishing 目前只支持 GitHub-hosted runner |

---

## 附：2FA 失联（网页端和手机端都过不去）怎么办

结论：**不要重新注册账号**。包所有权无法在没有 2FA 的情况下转移，新账号只会让你彻底丢掉 `chargrid-arcade`。

入口统一在登录页：https://www.npmjs.com/login → 输密码 → 到 **Two-Factor Authentication** 页面 → 点
**"Use a recovery code or request a reset"**。

### 路线 A：还有恢复码（开 2FA 时给的 `npm-recovery-codes.txt`）

1. 输入一个没用过的恢复码，登录
2. **立刻**去 Account → Two-Factor Authentication → **Modify 2FA** → 添加新的认证器（TOTP）
3. 等 **72 小时**安全冻结自动到期

冻结期内（2026-09 起对所有账号生效，不可提前解除）：

| 允许 | 禁止 |
| --- | --- |
| 登录、浏览/下载/安装包、改密码、**添加新的 2FA 方法** | 发布/取消发布、创建 token、改包设置、改 maintainer、改组织成员、改 2FA 方法本身 |

### 路线 B：恢复码也没了

1. 同一链接 → 底部 **"Try recovering your account"** → **"Start Account Recovery"**
2. 用注册邮箱收 OTP 验证（`2998568539@qq.com`）
3. **How can we help?** 选 **Reset my two-factor authentication (2FA)**
4. 点 **"Connect to GitHub"** 关联 `github.com/jkljklkjj`——`package.json` 的 `repository.url` 指向这个仓库，是最硬的所有权证据
5. 提交：https://www.npmjs.com/support?inquire=account

工单里一并写：包名、`1.2.1` 发布时间、maintainer 邮箱、GitHub 仓库地址。

### 冻结期间的现实约束

- **无法撤销已泄露的 token**：手上的 bypass token 是唯一写入通道，离线备份（密码管理器），不要再贴到任何聊天或提交进仓库。
- **无法配置 Trusted Publisher**：CI 发布路线要等解冻。
- **建议定期核对** `npm view chargrid-arcade versions`：出现你没发过的版本 = token 被滥用，立即走支持渠道报安全事件。
- **时间窗口**：2027-01 起 bypass-2FA token 不能直接发布（只剩 stage），恢复必须在此前完成。
- 暂存区里的旧版本（如 `1.2.0` staged）在解冻前无法 reject，但 `include-staged=false`，消费者装不到，不紧急。

---

## 附：账号冻结期作战计划（2FA 短期无法修复时）

前提：账号被锁数月，且 2027-01 起 bypass-2FA token 将失去直接发布能力。两者叠加 = 冻结期到 1 月中旬为止。

### 冻结期内唯一还能做的事

| 能做 | 不能做 |
| --- | --- |
| 用**现有** bypass token 直接 `npm publish` | 建新 token、吊销旧 token |
| 改 GitHub 仓库、README、文档、代码 | 配 Trusted Publisher、改包设置 |
| 让用户从 GitHub 安装（见下） | reject/approve 暂存版本、unpublish、deprecate |

### 必须保住的东西

**现有 bypass token = 唯一写入通道。** 存进密码管理器并留一份离线备份。丢了就再也发不了版（建新 token 需要 2FA）。不要再把它贴进任何对话、日志、仓库或 CI 配置。

### 工单里要追加的三个诉求

客服能在服务端吊销 token，本地 CLI 做不到：

1. 重置 2FA
2. **吊销该账号全部 access token**，说明其中一个已在第三方对话中泄露，给前 8 位字符帮助定位
3. 确认最近一个版本之后没有未授权发布

### 免费兜底通道（已验证可用）

```bash
npm i github:jkljklkjj/webGame          # 实测装到 1.2.1，文件齐全
```

npm 上没有新版本时，用户可以直连 GitHub 仓库安装。CDN 也可走 GitHub 分支：
`https://cdn.jsdelivr.net/gh/jkljklkjj/webGame@main/dist/terminal-arcade.js`（未实测连通性）。

### 发版纪律

- **不要**为 README、文档、注释等非功能改动发版——每发一次都在消耗一个撤不掉的凭据。
- 攒改动，等两件事之一：2FA 恢复（走 CI，零 token）或攒出实质内容后发一个 `1.3.0` 作为冻结前最终版。
- 冻结期内的文档改进只走 GitHub，不进 npm。

### 每周监控

```bash
npm view chargrid-arcade versions
```

出现未发布的版本号 = token 被滥用。应急顺序：GitHub README 顶部加警告（不需要 npm 权限）→ 工单报安全事件。

### 解冻后立刻做的 6 件事

1. `npm stage reject <staged 1.2.0 的 stage-id>`（`npm stage list` 取 id）
2. 配 Trusted Publisher：`jkljklkjj` / `webGame` / `publish.yml`，**Allowed actions 勾上 `npm publish`**
3. `npm version patch && git push --follow-tags`，验证 CI 能发（配置 2 天内必须首发成功）
4. 吊销所有旧 token（尤其是泄露过的那个）
5. 包的 Settings → Publishing access → **Require two-factor authentication and disallow tokens**
6. 确认浏览器里 2FA 换成可用设备 + 重新生成一组恢复码并妥善保存
