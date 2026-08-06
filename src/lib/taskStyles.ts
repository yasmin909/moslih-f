import type { TaskType } from '../lib/types';
import { TASK_TYPE_META } from '../lib/types';

/** Returns inline style objects for a task type badge */
export function taskTypeStyle(type: TaskType) {
  const meta = TASK_TYPE_META[type];
  return {
    color: `var(${meta.colorVar})`,
    background: `var(${meta.colorVar}-bg)`,
    borderColor: `var(${meta.colorVar}-bd)`,
  };
}

/** Returns just the color */
export function taskTypeColor(type: TaskType) {
  const meta = TASK_TYPE_META[type];
  return `var(${meta.colorVar})`;
}
