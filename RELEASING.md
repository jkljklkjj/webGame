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

## 附 A：2FA 只在 approve / reject 上失败（其他都正常）

症状：能登录 npmjs.com、能发布、能改包设置，但 `npm stage approve` / `npm stage reject` 无论怎么输 6 位码都过不去（`npm stage list` / `view` 正常）。

这不是账号被锁，只是**暂存发布（staged publishing）这条路径的 2FA 校验坏了**。影响面很小：

| 受影响 | 不受影响 |
| --- | --- |
| 批准/拒绝暂存版本 | 直接 `npm publish`（用 token） |
| 清理暂存区残留 | 登录、改包设置、配 Trusted Publisher |
| | 删除 token、OIDC/CI 发布 |

处理办法：

1. **暂存区残留不用管。** `include-staged=false` 是默认值，暂存版本不会被 `npm install` 解析到，也不会顶掉 `latest`。别人也 approve 不了（唯一的 maintainer 就是你自己）。它只是台账上一条记录，等 bug 修好再 reject 即可。
2. **发版不要走 `npm stage publish`。** 用直接发布：`npm publish --ignore-scripts --otp=<码>` 或 CI + Trusted Publisher（OIDC 在发布时不需要任何 OTP）。
3. **Trusted Publisher 照常配**：npmjs.com → 包 → Settings → Trusted Publisher，`Allowed actions` 里勾上 `npm publish`（不勾的话 CI 只能 stage，又会撞回同一个坏掉的 2FA）。
4. 想确认是不是同一个 bug：`npm stage view <stage-id>` 能看，`approve` 报错 → 就是这条路径的问题，与账号整体 2FA 无关。

---

## 附 B：2FA 完全过不去（连网页登录都进不了）

到这一步才有可能需要走恢复流程。入口：https://www.npmjs.com/login → 输密码 →
**Two-Factor Authentication** 页面 → 点 **"Use a recovery code or request a reset"**。

**有恢复码**（开 2FA 时给的 `npm-recovery-codes.txt`）：

1. 输入一个没用过的恢复码登录
2. 立刻去 Account → Two-Factor Authentication → **Modify 2FA** → 添加新的认证器
3. 等 **72 小时**安全冻结自动到期（2026-09 起对所有账号生效，不可提前解除）

冻结期内允许：登录、浏览/安装包、改密码、**添加新的 2FA 方法**。禁止：发布、创建 token、改包设置、改 maintainer。

**没有恢复码**：

1. 同一链接 → 底部 **"Try recovering your account"** → **"Start Account Recovery"**
2. 用注册邮箱收 OTP 验证
3. 工单 **How can we help?** 选 **Reset my two-factor authentication (2FA)**
4. 点 **"Connect to GitHub"** 关联 `github.com/jkljklkjj`（`package.json` 的 `repository.url` 指向它，是最硬的所有权证据）
5. 提交：https://www.npmjs.com/support?inquire=account

工单里一并写：包名、最新版本与发布时间、maintainer 邮箱、GitHub 仓库地址。

---

## 附 C：免费兜底安装通道

npm 上没有可用新版本时，用户可以直连 GitHub 仓库安装（已实测）：

```bash
npm i github:jkljklkjj/webGame
```

CDN 可走 GitHub 分支：`https://cdn.jsdelivr.net/gh/jkljklkjj/webGame@main/dist/terminal-arcade.js`（未实测连通性）。

冻结期内（无法发版时）的纪律：**不要为 README、文档、注释这类非功能改动发版**，攒改动等 CI 通路可用后一次性发；文档改进只走 GitHub。
