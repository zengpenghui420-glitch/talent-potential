# 天赋潜能测试

娱乐向自我探索 · 你的隐藏天赋是什么

线上地址：<https://zengpenghui420-glitch.github.io/talent-potential/>

用手机浏览器打开。首页输入 `TP` 开头的 6 位验证码后开始。18 道原创中文日常情景题，五级自评（完全不像我 → 非常像我），六项天赋潜能各 3 题：语言表达、逻辑拆解、人际共感、创意联想、秩序推进、内省觉察。结果给出潜能指数、等级、主导隐藏天赋、副天赋、六维雷达、特征表现和发挥建议。

本测试为娱乐向自我探索，题目为原创日常情景，非正式心理测量、非职业测评、非诊断。潜能指数只是偏好线索的娱乐分档，不代表能力高低或职业适合度。

## 验证码

| 项 | 值 |
|---|---|
| 前缀 | `TP` + 4 位 |
| 字符表 | `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（不含 I、L、O、0、1） |
| 集合 | MantleDB `catquiz-zph420-codes` / `tp/` |
| 次数 | 每个码 3 次 |
| 重新测试 | 清掉本次解锁，再次核销，扣 1 次 |
| 查看上次结果 | 只读本地记录，不扣次 |
| 已解锁后再点开始 | 同一标签页里不重复扣次 |

其他测验的验证码不能用在这里。卖家说明见 [CODES.md](CODES.md)。

造码（在已配置 `MANTLE_KEY` 或 `MANTLE_CREDS` 的机器上）：

```bash
MANTLE_KEY=*** ./tools/mint.sh 5
# 或
MANTLE_CREDS=/path/to/mantle.json ./tools/mint.sh 5
```

不带参数时默认一次造 10 个。每个码写入 `tp/{验证码}`，`remaining` 与 `max` 都是 3。

## 本地预览

```bash
python3 -m http.server 8080
```

打开 <http://127.0.0.1:8080/> 。页面是单文件 `index.html`。

## GitHub Pages

仓库需保持 **Public**。Pages 从 `main` 分支的根目录 `/` 发布。

若尚未开启：仓库 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`，Folder: `/ (root)` → Save**。根目录有 `.nojekyll`，避免 Jekyll 改写页面。
