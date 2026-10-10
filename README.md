# 雨隙 · 雨夜咖啡馆

**在线演示：[点击体验雨隙咖啡馆](https://xiujiegmail.github.io/rain-cafe/)**

**源码仓库：[xiujieGmail/rain-cafe](https://github.com/xiujieGmail/rain-cafe)**

在线演示默认提供 Mock 对话与角色演出；在「体验设置 → 自定义 AI 服务」填写自己的 OpenAI 兼容服务后，可在线体验真实 LLM、STT 和 TTS。也支持本地服务端配置。

一个移动端优先的互动场景 MVP。暴雨过后的夜晚，你在即将打烊的咖啡馆遇到 Mira，一位 26 岁的旅行摄影师。她在等人，你可以用文字或语音与她交流，也可以在她说话时开始新输入，打断当前回复。

主界面以原创角色和咖啡馆场景为主体，对话记录可折叠回看。默认本地演示的文字和模拟输入无需 API 密钥；内含中文预录语音、48 帧角色图集、剧情照片、结构化演出与故障模拟。

## MVP 范围与真实模型接入状态

当前版本定位为 AI 角色互动的工程验证 MVP，重点展示「输入 → 回复 → 语音播放 → 字幕与角色演出 → 打断与恢复」的交互闭环。演示模式通过可重复的剧情回复、预录中文语音和可控故障，便于评审直接验证轮次取消、迟到结果拦截、状态切换和媒体降级，无需准备第三方账号或密钥。

**2026-10-10 已配置硅基流动，并通过本地真实 STT → LLM → TTS 与上下文追问的 HTTP 验证。** 自动检查使用合成中文语音调用真实服务；随后用户确认实际麦克风采集、完整语音对话、上下文追问和说话中打断均正常。手机实机与最终 3–5 分钟录屏仍待完成。演示模式继续使用剧情规则与预录音频；「模拟语音输入」不代表实际语音识别。详见 [真实服务验收记录](docs/ACCEPTANCE.md)。

公开预览使用免费的 GitHub Pages，不运行动态 API。默认使用 Mock；访客启用自定义服务时，由浏览器直接调用其填写的 OpenAI 兼容地址。服务须允许浏览器 CORS，且线上地址使用 HTTPS。项目不提供公共代理；本地完整后端与 .env.local 模式继续保留。

| 能力 | 当前状态 |
| --- | --- |
| 文字及模拟输入、预录语音、角色演出、打断恢复 | 已实现并自动验证，可在线体验 |
| 实际录音、上传识别、真实模型回复与语音合成 | 本地真实服务链路已实测，用户确认麦克风对话与打断正常 |
| 长期记忆、RAG、Agent 工具调用、ComfyUI | 当前 MVP 未实现 |

PDF 交付清单、可提交材料与尚缺的录屏见 [交付说明](docs/DELIVERY.md)。当前作品展示本地真实语音闭环与场景交互，生产部署能力需后续验证。

## 一条命令启动

前提：Node.js 22.13+（22 系列）或 24+、npm。首次安装依赖需要访问 npm；安装完成后，Mock 的文字与模拟输入没有运行时外部服务依赖；实际麦克风输入需要语音识别服务。无需安装 Python、数据库、Docker 或 macOS 音频工具。

在项目目录执行：

```bash
./start.sh
```

脚本在缺少 node_modules 时执行 npm ci，然后启动开发服务。打开 **http://localhost:3000**。也可手动执行 npm ci 和 npm run dev。端口 3000 需可用；可用 `PORT=3011 ./start.sh` 指定其他端口。

生产构建与启动：

```bash
npm run build
npm start
```

不要同时让开发与生产服务占用同一端口。手机浏览页面可以使用本机局域网地址，但手机麦克风需要 HTTPS；localhost 是开发例外。单纯局域网 HTTP 浏览不等于具备麦克风授权条件。

## 两种模式

### 本地演示（默认）

- 文字输入通过真实服务端 /api/respond，由规则生成当前剧情回复和演出指令。
- 角色语音使用项目内 WAV，与每条 Mock 台词对应。
- 点击麦克风开始录音，再次点击结束；录音自动上传 `/api/transcribe`，真实识别出的文字直接提交 `/api/respond`，随后播放角色预录回复并显示字幕。无需选择模拟转写。
- 实际录音需要服务端 STT 配置。未配置或识别失败时明确报错，允许重新录制或使用文字，不会用固定文字冒充识别结果。
- 上传文件仅在请求内存中转发，不写入服务器磁盘；识别服务的数据保留政策由其提供商决定。
- 没有麦克风也可以点击「模拟语音输入」。该入口立即打断角色、进入倾听，再选择转写内容继续。
- 本地模式的语义理解是关键词与剧情节点规则，不应把它描述为自由生成的大模型对话。

建议体验：你在等谁？ → 我可以陪你。 → 看看你的照片？ → 你等的是谁？ → 雨停了，我们出去走走吧。

### 本地服务端配置

复制 .env.example 为 .env.local，填入服务端 OPENAI_API_KEY，重启服务。在右上角「体验设置」切换到「真实服务」。未配置时选项禁用。

| 变量 | 默认值 | 用途 |
| --- | --- | --- |
| OPENAI_API_KEY | 空 | 服务端密钥，不进入客户端 |
| OPENAI_BASE_URL | https://api.openai.com/v1 | OpenAI 兼容服务地址 |
| LLM_MODEL | gpt-4o-mini | JSON 角色回复和演出指令 |
| STT_MODEL | whisper-1 | 录音转写，语言 zh |
| STT_API_KEY | 回退到 OPENAI_API_KEY | 可独立配置语音识别密钥 |
| STT_BASE_URL | 回退到 OPENAI_BASE_URL | 可独立配置语音识别服务地址 |
| TTS_API_KEY | 回退到 OPENAI_API_KEY | 独立语音合成密钥 |
| TTS_BASE_URL | 回退到 OPENAI_BASE_URL | 独立语音合成地址 |
| TTS_MODEL | tts-1 | 语音合成 |
| TTS_VOICE | nova | 合成声音 |

端点分别为 chat/completions、audio/transcriptions、audio/speech。第三方兼容服务必须支持所选模型、JSON 输出和音频端点，不能假设一个文本兼容地址同时兼容语音。

只给演示模式接入实际语音输入时，复制 `.env.example` 为 `.env.local`，填写 `STT_API_KEY`、`STT_BASE_URL` 和 `STT_MODEL`，重启服务即可；无需设置 LLM/TTS 密钥，也无需切换模式。服务必须支持 OpenAI 兼容的 `audio/transcriptions` multipart 接口和 JSON `{ text }` 响应。

本地已使用用户配置的服务端密钥验证真实外部调用，密钥未提交至仓库。两种模式下的麦克风录音均会发往所配置的语音识别服务；真实模式还会发送对话到模型服务，页面设置中已说明。

### 硅基流动配置

本地 `.env.local` 已配置硅基流动，用户已填写 `OPENAI_API_KEY` 并完成真实调用验证。该变量是现有代码使用的通用服务端密钥名称，可以填写硅基流动的 Key。不要将 `.env.local` 提交至仓库。

其他机器使用时，复制 `.env.example` 为 `.env.local`，按以下配置填写：

```dotenv
OPENAI_API_KEY=填写硅基流动的API_Key
OPENAI_BASE_URL=https://api.siliconflow.cn/v1
LLM_MODEL=Pro/Qwen/Qwen2.5-7B-Instruct
STT_MODEL=FunAudioLLM/SenseVoiceSmall
STT_API_KEY=
STT_BASE_URL=
TTS_MODEL=FunAudioLLM/CosyVoice2-0.5B
TTS_VOICE=FunAudioLLM/CosyVoice2-0.5B:claire
```

填写后重启本地服务：开发模式执行 `npm run dev`；生产模式执行 `npm run build` 后 `npm start`。不要让两个服务同时占用 3000 端口。打开 http://localhost:3000，在「体验设置」切换到「真实服务」。先用文字验证 LLM 与 TTS，再录音验证 STT 和完整对话链路。

当前优先使用低价 Pro 对话模型：免费 `XingChenAGI/Xing4.0-29B` 与 `Qwen/Qwen2.5-7B-Instruct` 测试中出现过 25 秒超时，后者也成功返回过有效回复。Pro 模型已通过角色协议与上下文追问验证，单次成功不保证长期稳定。STT 使用免费 SenseVoiceSmall；TTS 使用按量收费的 CosyVoice2 预置音色，无需声音克隆。模型、额度、价格以账号控制台为准；测试延迟与范围见 [真实服务验收记录](docs/ACCEPTANCE.md)。

## 在线自定义服务（不限定硅基流动）

1. 打开在线演示，点击右上角体验设置，展开「自定义 AI 服务」。
2. 填写 `OPENAI_API_KEY`、`OPENAI_BASE_URL`（API 根路径，如 `https://api.openai.com/v1`）和 LLM 模型。
3. 填写 STT 模型、TTS 模型及音色。两者可各自填写地址与密钥；留空地址/密钥时分别复用通用配置，因此可以组合三个不同平台。
4. 点击「应用并切换真实对话」，先文字对话验证 LLM/TTS，再使用麦克风验证 STT。清除配置会停止当前轮并恢复 Mock，保留已有对话记录。

接口协议分别是 `chat/completions`（角色 JSON）、`audio/transcriptions`（multipart，返回 `{ text }`）和 `audio/speech`（返回 audio/* 二进制）。不支持 JSON response_format 的模型可取消「请求 JSON 模式」，但仍需输出角色 JSON。DeepSeek 等文本平台可用于 LLM；没有音频接口的平台不能直接充当 STT/TTS，需要填写其他音频服务。Azure 等不同路径/鉴权协议需要兼容网关，并非所有平台都可直接使用。

自带密钥只在当前页内存中，不写入 localStorage/sessionStorage、日志或项目后端，刷新即清除。密钥、录音和对话直接发送到访客选择的服务，请使用可信地址及限额密钥。线上服务地址须 HTTPS（本机调试允许 localhost HTTP），不能含 URL 凭据、查询参数或片段；服务需允许页面来源的 CORS 和 Authorization/Content-Type 请求头。跨域受阻会显示明确提示，项目不会绕过平台限制或自动转发到其他服务器。

## 系统结构

```text
React 场景界面
  ├─ 文字输入 / MediaRecorder 录音
  ├─ InteractionEngine：对话流程、上下文、表演生命周期
  ├─ TurnGate：轮次、AbortController、清理
  ├─ Zustand：画面状态、剧情、字幕与有界事件记录
  └─ Canvas：原创序列帧、呼吸、眨眼、说话口型切换

Next.js Route Handlers（Node.js runtime）
  ├─ /api/config：是否配置真实服务，不返回密钥
  ├─ /api/respond：验证输入，Mock 或 LLM，校验演出协议
  ├─ /api/transcribe：multipart 录音 → STT
  └─ /api/speech：有效文本 → TTS → 音频二进制
```

| 文件 / 目录 | 职责 |
| --- | --- |
| src/components/cafe-experience.tsx | 输入、录音、设置和状态呈现 |
| src/components/scene-stage.tsx | 背景、环境变化、照片和媒体降级 |
| src/components/character-canvas.tsx | 48 帧角色图集播放 |
| src/lib/interaction.ts | 文字到语音的主流程与上下文提交 |
| src/lib/turn-gate.ts | 有效轮次与取消 |
| src/lib/browser-services.ts | 浏览器录音、播放和 API 访问 |
| src/lib/protocol.ts | Zod 输入及演出协议 |
| src/lib/server.ts | 服务端 Provider、超时与错误转换 |
| src/lib/mock.ts | 有上下文的本地剧情规则和台词 |
| src/stores/scene-store.ts | 可视状态与最多 40 条事件记录 |
| scripts/ | 启动辅助、素材生成与 HTTP smoke |
| tests/ | 取消、恢复、播放与录音生命周期测试 |

在当前字幕式对话区域向上滚动，回看最近 100 条用户/角色消息；默认跟随最新回复，翻阅历史时保留阅读位置，点击「回到最新消息」恢复跟随，显示时间、进行中、完成、打断或失败状态。记录仅留在本页内存，刷新或重新开始清空。展示记录与模型上下文分开保存；最近最多 14 条上下文消息随请求发送；剧情节点保存在同一页面状态中。刷新或重启故事会清空。服务端不持久化会话，不需要数据库。

## 语音交互与打断

选择点击开始/结束录音，未采用自动 VAD。原因是便于在 72 小时范围内明确控制移动端权限、录音边界、误触发与打断。录音最长 45 秒，使用浏览器支持的 WebM/MP4/Ogg 采集，完成后解码为单声道 16kHz PCM WAV 上传；请求文件限制 8MB。体验设置提供输入设备选择、实时音量和最近一次录音回放，回放只保存在浏览器内存。极短录音和完全数字静音在本地提示重录，低音量仍允许上传识别。请求回声消除、降噪和自动增益，具体能力取决于浏览器与设备。

```text
待机 → 开始录音 → 倾听 → 结束录音 → STT → 思考
     → LLM 结构化回复 → TTS → 实际播放 → 说话 → 待机

说话 / 思考 → 开始新的语音或文字输入
            → 旧轮失效 + 停声 + 清空字幕和旧媒体
            → 新轮倾听或思考
```

每轮单调递增 turnId。新输入先使旧轮失效，再触发 AbortController。播放注册在同一取消信号上，收到取消时立即 pause、移除音源、注销 playing/ended/error 回调。旧轮的字幕、表演与照片在新轮开始时清理。

网络返回、TTS 完成、播放开始、播放结束、录音转写和演出发布均检查有效轮次。即使 Provider 不接受取消，旧响应也无法重新播放或覆盖当前画面。播放和表演不依赖独立的未跟踪定时器。

已完整完成的角色回复才加入对话上下文；被打断的回复记录为「未完整播放」，不会把整段回复当成用户已听完。暂不逐字追踪实际听到的内容。

字幕在播放开始（或音频降级）后以打字机方式逐字显示，旧轮取消会卸载并清理计时器；减少动态效果的系统设置下直接显示完整字幕。模型仍一次性返回全文，此效果不是模型 token 流式输出，也不与音频字词时间戳对齐。口型是播放状态驱动的帧切换，不是音素或真实音频振幅对齐。

## 角色与场景协议

```json
{
  "turnId": 12,
  "text": "这是我在海边拍的最后一张照片。",
  "emotion": "wistful",
  "story": "photo",
  "events": [
    { "on": "speech_start", "type": "action", "name": "show_camera" },
    { "on": "speech_start", "type": "media", "name": "travel_photo" }
  ],
  "elapsedMs": 700
}
```

- 表情：calm 平静、guarded 警惕、warm 微笑、wistful 怀念。眉眼和嘴形在图集中有区别。
- 动作：look_window 望向窗外、show_camera 举相机；idle 为基础姿势。
- 环境：warm_light 增加暖光、rain_clears 停雨并改变背景亮度与镜头尺度。
- 媒体：travel_photo 展示预制海边车站插画，属于当前回复，不是运行时生成图片。
- 事件触发：speech_start / speech_end；只允许有效轮次发布。

模型不能直接指定任意媒体地址。Zod 校验字段、资源枚举与事件类型匹配；非法指令且文本仍可用时，保留文本，回退平静表情并移除事件。没有可用文本则请求失败。

所选多模态能力是**序列帧角色动画**，不是视频或生成式媒体。图集共 4 表情 × 3 姿势 × 2 嘴形 × 2 眼形 = 48 帧，以 Canvas 播放，附带轻微呼吸。媒体照片是演出中的额外视觉事件。

## 失败反馈与恢复

| 故障 | 行为 |
| --- | --- |
| 麦克风拒绝 / 不可用 | 显示提示，保留文字和模拟输入 |
| 录音错误 / 空音频 / STT 失败 | 释放麦克风，返回可操作状态，允许重新录制 |
| 网络失败 / 模型超时 | 保留输入摘要，显示重试入口 |
| 语音加载失败 / 播放被浏览器拦截 | 保留有效字幕与表演，提示语音降级 |
| 照片失败 | 不显示破图，保留角色并显示媒体反馈 |
| 角色图集失败 | 显示静态 Mira，并明确标注动画降级 |
| 快速输入或旧响应迟到 | 仅当前轮次可提交状态 |

外部请求服务端超时 25 秒、客户端 API 超时 30 秒；音频加载 12 秒、播放最多 90 秒。取消会清理音频定时器；正常录音完成、取消和失败会释放设备轨道。

右上角设置可模拟「下一轮」模型超时、音频失败、照片失败、旧回复延迟 7 秒。只有 Mock 模式有效，提交后自动清除。照片失败需配合照片主题；提示明确标示「演示」，不冒充真实服务故障。

## 技术选择与取舍

- Next.js 单项目同时承载页面与 API，减少多进程启动配置；首版 HTTP 链路，不依赖 WebSocket。
- STT → LLM → TTS 更容易绑定结构化表演和调试取消；代价是响应延迟高于端到端实时语音。
- 序列帧、背景和照片全部本地，减少生成服务的时延与角色一致性问题；表现力暂时偏插画。
- 演出使用播放生命周期触发，避免台词和场景脱节；首版没有复杂时间线。
- 客户端会话降低持久化负担，刷新会丢失对话；没有账号、后台、支付或多角色。
- Tailwind v4 已接入；场景主要使用语义 CSS，便于控制复杂响应式构图。

## 第三方服务与素材来源

- 真实模式可选 OpenAI 或兼容服务；Mock 的文字与模拟输入不调用它们，实际录音会调用 STT。
- Next.js、React、TypeScript、Zustand、Zod、Tailwind CSS、Vitest、Sharp：依赖版本见 package-lock.json。
- Lucide 图标：lucide-react，ISC 许可。
- Mira、咖啡馆、海边车站：本项目 AI 辅助编写的原创 SVG，脚本 scripts/generate-assets.mjs；无第三方角色图或网络图片。
- 本地中文声音：macOS 系统 Tingting 语音生成，由 say 和 afconvert 导出为 WAV；生成脚本 scripts/generate-audio.mjs。运行项目不需要这些工具。
- 字体：系统中文字体与系统衬线字体，不请求在线字体。

重新生成图集：npm run assets。重新生成中文 WAV：npm run audio（仅 macOS，需要 Tingting 声音）。素材已经包含在项目中，正常启动无需生成。

## 验证与当前限制

```bash
npm run check   # TypeScript + ESLint + Vitest
npm run smoke   # 已启动服务的 HTTP 闭环检查
npm run build   # 生产构建
```

自动验证、用户反馈与未验收项见 [验收记录](docs/ACCEPTANCE.md)。

已知限制：

1. 本地真实 STT/LLM/TTS 与上下文追问已实测，用户确认实际麦克风、对话和打断正常；识别延迟有波动，长时间稳定性未做专项测试。
2. 桌面 Chromium 与手机尺寸模拟已验证，未进行真实 iOS/Android 设备测试，权限、自动播放和编码兼容性需实机确认。
3. 两种模式的实际录音均上传并自动识别；未配置 STT 时只能使用文字或明确标识的模拟输入。
4. 打字机字幕、状态驱动口型，无 token 流式输出、自动 VAD、流式音频、音素口型或断线会话恢复。
5. 会话只存在页面内存；刷新清空。图片没有运行时生成。
6. 极小窗口或手机键盘弹出时可能需要滚动；复杂长回复不保证字幕逐字对齐。
7. GitHub Pages 默认 Mock；自带密钥可直连允许 CORS 的兼容服务，服务端密钥模式需本地后端；最终 3–5 分钟人工录屏尚未完成，建议流程见 docs/DEMO.md。
8. 尚未针对公开部署加入身份校验、调用配额和持久化。这些不影响本地 Mock 体验。

投入记录：本地 MVP 首次开发与自动验收约 1 小时（2026-10-10，AI 工具执行的墙钟时间，非人工连续编码工时）；后续视觉调整、服务接入与录音联调另计，未单独计时，不能把首次约 1 小时视为完整项目总工时；收题时间和最终提交截止时间由实际收题记录确认。

## 如果继续开发两周

第一周：优化已接入的真实语音延迟；覆盖 iOS/Android；完善上下文的打断片段记录；引入流式 TTS、句级字幕、阶段延迟观测和会话恢复。

第二周：优化角色原画和动作过渡；增加音频驱动口型；尝试自动 VAD 并处理附和与回声；在需要时增加受控缓存、服务限额与持久化。优先修复实测问题，再增加演出类型。

## 动漫视觉版本

当前界面采用原创动漫矢量插画风：成年 Mira、蓝色雨夜与暖色咖啡馆。角色、背景和旅途插画均在 `scripts/generate-assets.mjs` 中可编辑，`npm run assets` 可重新生成全部素材。角色图集仍为 48 帧，保留情绪、望窗、举相机、眨眼与说话嘴形。可直接打开在线演示查看当前视觉版本。

## GitHub 免费在线预览

仓库：[xiujieGmail/rain-cafe](https://github.com/xiujieGmail/rain-cafe)

在线演示：[https://xiujiegmail.github.io/rain-cafe/](https://xiujiegmail.github.io/rain-cafe/)

GitHub Pages 只托管静态文件，无项目后端。默认 Mock 支持预录音频、演出与故障注入；启用自定义 AI 服务后，浏览器使用访客填写的地址直连 LLM/STT/TTS。未配置时实际录音会明确提示需要服务，不会伪造转写。自带密钥不随静态构建发布。

`npm run build:preview` 在 `.preview-build/` 内单独生成导出，不包含 API 路由和环境密钥文件，不影响本地完整项目。配置 GitHub CLI HTTPS 登录后，执行 `npm run deploy:preview` 完成检查、构建与发布到 `gh-pages` 产物分支；源码保存在 `main`。GitHub Pages 使用分支发布，源码推送后需再次执行部署命令更新预览。生成目录为 `.preview-build/out`，部署基础路径为 `/rain-cafe`。

关键代码已使用中文 `//` 注释说明轮次失效、资源释放、录音上传、协议校验、播放同步和静态预览边界。

## 项目工程规范

后续开发必须遵守 [工程规范 skill](.agents/skills/rain-cafe-engineering/SKILL.md)，入口见 [AGENTS.md](AGENTS.md)。规范覆盖中文 `//` 注释、类型安全、轮次取消、资源清理、密钥与验收证据。`npm run check` 已加入 ESLint 与中文注释检查；CSS 和 Shell 使用各自合法的中文注释语法。
