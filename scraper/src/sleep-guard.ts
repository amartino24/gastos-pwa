/**
 * On battery, macOS ignores caffeinate during a scheduled (dark) wake and sleeps
 * again after ~7 s. With a narrow sudoers rule (see README) we can disable sleep
 * for the duration of a run and always restore it afterwards.
 *
 * Every call is `sudo -n` (non-interactive): without the rule it just fails quietly.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const PMSET = '/usr/bin/pmset';

async function setDisableSleep(on: boolean): Promise<boolean> {
  try {
    await run('sudo', ['-n', PMSET, 'disablesleep', on ? '1' : '0']);
    return true;
  } catch {
    return false;
  }
}

/** Disables system sleep until `release()`; also restores it if the process is killed. */
export async function holdSleep(): Promise<{ active: boolean; release: () => Promise<void> }> {
  const active = await setDisableSleep(true);
  if (!active) return { active, release: async () => {} };

  const restore = () => setDisableSleep(false);
  const onSignal = (sig: NodeJS.Signals) => {
    void restore().finally(() => process.exit(sig === 'SIGINT' ? 130 : 143));
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  return {
    active,
    release: async () => {
      process.off('SIGINT', onSignal);
      process.off('SIGTERM', onSignal);
      await restore();
    },
  };
}

/** Safety net used by the watcher when no run is active. */
export function restoreSleep(): Promise<boolean> {
  return setDisableSleep(false);
}
