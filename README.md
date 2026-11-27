# 天赋潜能测试

娱乐向自我探索 · 你的隐藏天赋是什么

线上地址：<https://zengpenghui420-glitch.github.io/talent-potential/>

用手机浏览器打开。首页输入小红书「我的订单」里的订单号后开始：每个订单号可以测 3 次。18 道原创中文日常情景题，五级自评（完全不像我 → 非常像我），六项天赋潜能各 3 题：语言表达、逻辑拆解、人际共感、创意联想、秩序推进、内省觉察。结果给出潜能指数、等级、主导隐藏天赋、副天赋、六维雷达、特征表现和发挥建议。

本测试为娱乐向自我探索，题目为原创日常情景，非正式心理测量、非职业测评、非诊断。潜能指数只是偏好线索的娱乐分档，不代表能力高低或职业适合度。

## 订单号

订单号在页面里做格式检查。格式通过就进入测验。页面不为订单号请求 `*.vercel.app`，也不读写 Mantle 的 `orders/`。

| 项 | 值 |
|---|---|
| 格式 | 只接受 `P` + 18 位。重复块和逐位 ±1 的序列在页面上拒绝，19 位也不接受 |
| 通过 | 立刻解锁并开始。没有绑定、没有限流、没有服务器次数 |
| 显示 | 第一次开始记 1 次，提示「验证成功，还可以测 2 次」。再测一次再记 1 次 |
| 不记 | 刷新、继续这一次、查看上次结果、刷新结果都不改显示次数 |
| 记满之后 | 仍然可以进入，提示「验证成功」 |
| 存放 | 本机 `localStorage` 键 `talent_potential_order_uses`，按订单号分开记 |

## 已发出的验证码

已发出的 `TP` 码仍走页面里原来的 Mantle 集合 `tp/`（先读再 `increment`），不改成 `/redeem`。剩余次数是集合里的真实次数。同一标签页里，已经扣过的码在刷新或「再测一次」时不会再次扣次；关掉页面后重新进入会再核销。造码方式不变。卖家说明见 [CODES.md](CODES.md)。

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
