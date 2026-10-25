# 发版手册

两条路，二选一。

---

## 路线 A：手动发布（今天就能用）

```bash
npm test
npm publish --ignore-scripts --otp=123456   # 换成 authenticator 里的实时 6 位码
```

- 要 TOTP（6 位码）；2FA 是 passkey 的话走不了这条。
- 2027-01 之前，勾了 *Bypass 2FA* 的 granular token 也还能直接发布，但那是死路，别投资。
- 长期手动发版也可以，只是每次要敲码。

---

## 路线 B：GitHub Actions + trusted publishing（零 token）

### 阶段 1（一次性）：先手动把首版发上去

npm **不支持用 OIDC 发第一个版本**（`npm/cli#8544` 仍 open）：

> "it's not possible to publish the initial version of a package using OIDC, it needs to be published manually or using a token."

所以 1.2.0 必须走路线 A 发一次。发完确认：

```bash
npm view chargrid-arcade version      # 1.2.0
```

### 阶段 2：推到 GitHub

仓库地址必须和 `package.json` 的 `repository.url` 一致。本项目填写的是
`https://github.com/zhenye/webGame`，**如果你的用户名或仓库名不同，先改过来**：

```bash
npm pkg set repository.type=git
npm pkg set repository.url=git+https://github.com/<你的用户名>/<仓库名>.git
npm pkg set homepage=https://github.com/<你的用户名>/<仓库名>#readme
npm pkg set bugs.url=https://github.com/<你的用户名>/<仓库名>/issues
```

然后建仓库并推（本目录已是 git 仓库、已提交过首个 commit）：

```bash
# 在 GitHub 上新建空仓库（不要勾 README / .gitignore），然后：
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

### 阶段 3：配置 Trusted Publisher

npmjs.com → 你的包 → **Settings** → **Trusted Publisher** → 选 **GitHub Actions**：

| 字段 | 填什么 |
| --- | --- |
| Organization or user | `zhenye`（GitHub 用户名，不是 npm 用户名） |
| Repository | `webGame` |
| Workflow filename | `publish.yml`（只写文件名，含 `.yml`，**区分大小写**） |
| Environment name | 留空 |
| Allowed actions | 默认只允许 `npm stage publish`；**要允许 `npm publish` 就得勾上**（见下） |

⚠️ 两个坑：

1. 新建的配置**必须在 2 天内完成一次成功发布**才生效绑定，否则过期作废、要删掉重建。所以配完立刻发下一个版本。
2. 2026-09 之后创建的配置**默认只允许 stage publish**。如果你不想用暂存流程，务必在 Allowed actions 里把 **`npm publish`** 也勾上，否则 CI 会以 403 失败。

### 阶段 4：验证 CI 能发

```bash
npm version patch        # 1.2.1，会顺带打 tag
git push && git push --tags
```

Actions 里应看到 `publish` 跑通，且包页面出现 **Provenance**（公开仓库 + 公开包自动生成，不用加 `--provenance`）。

成功后建议加固：包 → Settings → **Publishing access** → 选
**"Require two-factor authentication and disallow tokens"**，把 token 通道彻底关掉，只留 OIDC。

---

## 日常发版（配置好之后）

```bash
npm test                 # 本地先过一遍
npm version patch        # 或 minor / major
git push && git push --tags
```

- tag 必须是 `v1.2.1` 这种形式，且与 `package.json` 的 version 一致——workflow 里有一步硬校验，不一致直接失败。
- `prepublishOnly` 会在 CI 里再跑一遍 `npm test`（workflow 里已经显式跑过一次，双保险）。

## 排错

| 现象 | 原因 |
| --- | --- |
| `ENEEDAUTH` / `Unable to authenticate` | workflow 文件名没对上（含 `.yml`、大小写）、仓库名不符，或缺 `id-token: write` |
| `403 ... two-factor authentication or granular access token` | 包的 Publishing access 还要求 token/2FA，但 Trusted Publisher 没匹配上；或 Allowed actions 里没勾 `npm publish` |
| `npm ci` 报 `requires package-lock.json` | 本项目零依赖、无 lockfile，不要用 `npm ci`，直接 `npm test` |
| 配置看起来对但一直失败 | `repository.url` 与仓库不一致（fork 的仓库最容易中招） |
| 自托管 runner 失败 | trusted publishing 目前只支持 GitHub-hosted runner |
| 配置突然不可用 | 建好后 2 天内没有成功发布，配置已过期，删掉重建 |
