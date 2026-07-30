// New finding, 2026-07-30 (pilot-readiness + exception-handling pass): no
// process.on('unhandledRejection'/'uncaughtException') handler existed
// anywhere in apps/server/src. Node's default behavior on an unhandled
// rejection is to crash the whole process -- and this codebase dispatches
// several background fire-and-forget calls per live room (agent/
// roomAgent.js), so one room's rejected disconnect could otherwise take
// down every other live room and the API along with it, not just that one
// room. Built as a factory, same shape as shutdown.js, so the handlers
// themselves are directly testable without registering process.on() in a
// test run.
import { describe, it, expect, vi } from 'vitest';
import { createProcessSafetyNet } from '../src/processSafetyNet.js';

describe('createProcessSafetyNet', () => {
  describe('onUnhandledRejection', () => {
    it('logs structured (JSON-parseable) context and does not shut down', () => {
      const logger = { error: vi.fn() };
      const shutdown = vi.fn();
      const { onUnhandledRejection } = createProcessSafetyNet({ logger, shutdown });

      onUnhandledRejection(new Error('room disconnect failed'));

      expect(logger.error).toHaveBeenCalledTimes(1);
      const logged = JSON.parse(logger.error.mock.calls[0][0]);
      expect(logged.kind).toBe('unhandledRejection');
      expect(logged.message).toBe('room disconnect failed');
      expect(logged.stack).toEqual(expect.any(String));
      // A rejected promise from one isolated background dispatch must not
      // take the whole process (every other live room) down with it.
      expect(shutdown).not.toHaveBeenCalled();
    });

    it('handles a non-Error rejection reason without throwing', () => {
      const logger = { error: vi.fn() };
      const { onUnhandledRejection } = createProcessSafetyNet({ logger });

      expect(() => onUnhandledRejection('a plain string rejection')).not.toThrow();

      const logged = JSON.parse(logger.error.mock.calls[0][0]);
      expect(logged.message).toBe('a plain string rejection');
    });
  });

  describe('onUncaughtException', () => {
    it('logs structured context and triggers the existing graceful shutdown', async () => {
      const logger = { error: vi.fn() };
      const shutdown = vi.fn().mockResolvedValue(undefined);
      const { onUncaughtException } = createProcessSafetyNet({ logger, shutdown });

      await onUncaughtException(new Error('unknown state'));

      const logged = JSON.parse(logger.error.mock.calls[0][0]);
      expect(logged.kind).toBe('uncaughtException');
      expect(logged.message).toBe('unknown state');
      // A sync exception can leave in-memory state (activeRooms, Express
      // internals) genuinely unknown -- reuse the existing graceful
      // shutdown so any live rooms still get a clean disconnect, rather
      // than continuing to serve traffic on unknown state.
      expect(shutdown).toHaveBeenCalledWith('uncaughtException');
    });

    it('falls back to a bare exit when no shutdown function is provided', async () => {
      const logger = { error: vi.fn() };
      const exit = vi.fn();
      const { onUncaughtException } = createProcessSafetyNet({ logger, exit });

      await onUncaughtException(new Error('unknown state'));

      expect(exit).toHaveBeenCalledWith(1);
    });
  });
});
