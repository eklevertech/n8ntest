'use client';

import { useTransition } from 'react';
import { clockIn, clockOut } from '@/server/attendance';

export function TimeClock({ hasOpen }: { hasOpen: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="card flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold">Time clock</h2>
        <p className="text-sm text-gray-500">
          {hasOpen ? 'Tienes un punch abierto.' : 'No tienes punch abierto.'}
        </p>
      </div>
      <div className="flex gap-2">
        <button
          className="btn-primary"
          disabled={pending || hasOpen}
          onClick={() => start(() => clockIn().then(() => undefined))}
        >
          Entrada
        </button>
        <button
          className="btn-secondary"
          disabled={pending || !hasOpen}
          onClick={() => start(() => clockOut().then(() => undefined))}
        >
          Salida
        </button>
      </div>
    </div>
  );
}
