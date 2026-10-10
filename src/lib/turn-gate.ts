export type Ticket = { id: number; controller: AbortController };

// 统一管理轮次与取消信号；即使上游忽略取消，旧结果也不能更新当前状态。
export class TurnGate {
  private sequence = 0;
  private ticket?: Ticket;
  private cleanups = new Set<() => void>();

  begin(): Ticket {
    // 新轮创建前先让旧轮失效，并同步停止旧轮音频、录音和请求。
    this.invalidate();
    this.ticket = { id: this.sequence, controller: new AbortController() };
    return this.ticket;
  }
  isCurrent(ticket: Ticket) {
    return this.ticket === ticket && !ticket.controller.signal.aborted;
  }
  register(ticket: Ticket, cleanup: () => void) {
    if (!this.isCurrent(ticket)) { cleanup(); return () => {}; }
    this.cleanups.add(cleanup);
    return () => { this.cleanups.delete(cleanup); };
  }
  invalidate() {
    // 先更新轮次，再触发清理，避免清理回调把旧轮结果重新发布。
    ++this.sequence;
    this.ticket?.controller.abort();
    this.ticket = undefined;
    for (const cleanup of this.cleanups) cleanup();
    this.cleanups.clear();
  }
}
