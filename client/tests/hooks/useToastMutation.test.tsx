import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import { useToastMutation } from '../../src/hooks/useToastMutation.js';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useToastMutation', () => {
  it('shows success toast and runs user onSuccess on success', async () => {
    const onSuccess = vi.fn();
    const { result } = renderHook(
      () =>
        useToastMutation({
          mutationFn: async (n: number) => n * 2,
          successMessage: 'done',
          onSuccess,
        }),
      { wrapper },
    );

    await act(async () => { await result.current.mutateAsync(3); });

    expect(toast.success).toHaveBeenCalledWith('done');
    expect(onSuccess.mock.calls[0]?.[0]).toBe(6);
    expect(onSuccess.mock.calls[0]?.[1]).toBe(3);
  });

  it('shows error toast and runs user onError on rejection', async () => {
    const onError = vi.fn();
    const err = new Error('boom');
    const { result } = renderHook(
      () =>
        useToastMutation<unknown, Error, void>({
          mutationFn: async () => { throw err; },
          errorMessage: 'oh no',
          onError,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('oh no');
    });
    expect(onError).toHaveBeenCalled();
    expect(onError.mock.calls[0]?.[0]).toBe(err);
  });

  it('supports a function for successMessage', async () => {
    const { result } = renderHook(
      () =>
        useToastMutation({
          mutationFn: async (name: string) => `hi ${name}`,
          successMessage: (data) => `got: ${data}`,
        }),
      { wrapper },
    );

    await act(async () => { await result.current.mutateAsync('mark'); });

    expect(toast.success).toHaveBeenCalledWith('got: hi mark');
  });

  it('supports a function for errorMessage', async () => {
    const { result } = renderHook(
      () =>
        useToastMutation<unknown, Error, void>({
          mutationFn: async () => { throw new Error('inner'); },
          errorMessage: (e) => `failed: ${(e as Error).message}`,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('failed: inner');
    });
  });

  it('skips toast when message is omitted', async () => {
    const { result } = renderHook(
      () =>
        useToastMutation({
          mutationFn: async (n: number) => n,
        }),
      { wrapper },
    );

    await act(async () => { await result.current.mutateAsync(1); });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });
});
