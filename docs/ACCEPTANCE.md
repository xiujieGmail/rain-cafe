# 验收记录

日期：2026-10-10。在线演示：https://xiujiegmail.github.io/rain-cafe/ 。源码：https://github.com/xiujieGmail/rain-cafe 。

## 自动验证

- TypeScript、ESLint 与 Vitest；单元测试覆盖轮次取消、失败恢复、录音清理、音频静音判断及 PCM WAV 编码。
- Next.js 生产构建保留 config/respond/transcribe/speech API；HTTP smoke 验证剧情、上下文、语音、照片事件、超时、校验和无密钥行为。
- 本地测试上游验证音频 multipart 转发与语音端点，不冒充真实识别。
- 真实硅基流动链路使用合成中文音频验证 STT、Pro/Qwen/Qwen2.5-7B-Instruct 回复、CosyVoice2 语音二进制与上下文追问。免费 LLM 曾出现 25 秒超时；STT 延迟有波动。
- Chromium 自动验证说话 → 新输入打断 → 倾听 → 新回复、照片演出、环境变化与故障降级；桌面和手机尺寸属于模拟窗口。
- 录音自动验证：静音提示且不调用 STT，有效录音转换为 16kHz 单声道 WAV 后完成真实识别、回复和播放，结束释放设备轨道。
- 静态导出不含动态 API 或私有环境；Pages 的 Mock 对话不请求后端，资源使用 /rain-cafe 前缀。

本次提交前的命令、结果与测试数量见下方最终复查；上述历史自动验证不等同于实机人工验收。

## 用户报告的人工验收

用户在本地确认实际麦克风能够接收音频，并对完整 STT → LLM → TTS 与照片事件、上下文追问、播放中开始新录音后旧音频停止且下一轮正常回复，反馈“以上都正常”。记录来源为本次对话，未附独立录像。

## 尚未完成

- 3–5 分钟最终录屏：按用户本次范围留待用户制作，流程见 DEMO.md。
- iOS/Android 真机权限、编码、自动播放与键盘布局验证。
- 长时间连续对话与外部服务稳定性专项测试。

公开 Pages 是静态 Mock；不能用它验收真实 STT/LLM/TTS。PDF 允许公开演示或明确本地启动，因此真实模式采用 README 中的本地启动方案交付。

## 本次提交前复查

- npm run check：TypeScript、ESLint 10（含中文注释规则）、4 个文件共 24 项 Vitest 测试通过。
- npm run build：生产构建通过，四个后端 API 保留。
- npm run smoke:voice：本地测试上游的音频转发、独立 STT 配置、转写到 Mock 回复/语音、上游繁忙、空转写 422、异常协议 502 均通过。
- 不复制 .env.local 的独立临时副本执行 PORT=3011 ./start.sh，自动 npm ci 并成功启动；HTTP smoke 验证无密钥 Mock、剧情/上下文、WAV、照片、故障与输入校验通过。首次安装约 3 秒、服务就绪约 0.2 秒，仅为本机缓存/网络环境的观察值，不保证其他网络 15 分钟内安装。
- skill-creator 校验通过；中文注释规则探针确认 URL 字符串不误判、中文行注释允许、英文说明与块说明拒绝。
- 无密钥副本 Chromium 验证照片回复进入 speaking，点击模拟语音立即进入 listening；设置中真实服务禁用、麦克风选择与故障选项可见，无页面错误。
- 最新本地生产服务已重启，HTTP smoke 通过；静态导出 37 个文件扫描未发现环境文件或当前服务密钥，部署产物推送到 gh-pages。
