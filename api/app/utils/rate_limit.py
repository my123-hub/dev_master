# -*- coding: utf-8 -*-
"""
【模块功能】轻量内存限流器（滑动窗口，按 IP）
——替代 slowapi（0.1.10 与新版 Starlette 不兼容，限流静默失效）。
需求场景（PRD NFR-11 / BR-02）：
  - 前台留资提交：5 次/分钟/IP
  - 登录失败：10 次/分钟/IP
说明：单进程内存实现，生产多副本场景可替换为 Redis 实现（接口不变，见类内注释）。
"""
import threading
import time
from collections import defaultdict, deque


class MemoryRateLimiter:
    """【类说明】滑动窗口限流器：
    - 以 (key) 为维度记录命中时间戳，窗口内计数超限则拒绝；
    - 线程安全（多线程 Web 服务下计数准确）；
    - 单进程内存：生产多实例部署时建议改为 Redis（保持 check 接口不变）。
    """

    def __init__(self) -> None:
        # key → 最近命中时间戳队列（deque 保持有序，便于滑动窗口淘汰）
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()

    def check(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        """【函数说明】检查并记录一次访问：
        - key：限流维度（如 login:127.0.0.1、lead:127.0.0.1）
        - limit：窗口内允许的最大次数
        - window_seconds：窗口时长（秒），默认 60 秒
        返回 True 表示允许本次请求；False 表示超限（调用方据此返回 42900）。
        """
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            # 淘汰窗口之外的旧记录（滑动窗口核心：只保留最近 window_seconds 内的命中）
            while q and q[0] <= now - window_seconds:
                q.popleft()
            # 超限：拒绝本次请求（不记录，保持计数不变）
            if len(q) >= limit:
                return False
            q.append(now)
            return True


# 全局单例：全项目共用一个限流器实例（内存计数统一）
rate_limiter = MemoryRateLimiter()
