import {
  useMutation,
  type DefaultError,
  type UseMutationOptions,
  type UseMutationResult,
} from "@tanstack/react-query";
import { toast } from "sonner";

type ToastMessage<TArg> = string | ((arg: TArg) => string);

export type UseToastMutationOptions<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
> = UseMutationOptions<TData, TError, TVariables, TContext> & {
  /** Toast shown after successful mutation. Receives the mutation result. */
  successMessage?: ToastMessage<TData>;
  /** Toast shown when the mutation rejects. Receives the thrown error. */
  errorMessage?: ToastMessage<TError>;
};

export function useToastMutation<
  TData = unknown,
  TError = DefaultError,
  TVariables = void,
  TContext = unknown,
>(
  options: UseToastMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { successMessage, errorMessage, onSuccess, onError, ...rest } = options;

  return useMutation<TData, TError, TVariables, TContext>({
    ...rest,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (successMessage !== undefined) {
        const msg =
          typeof successMessage === "function"
            ? successMessage(data)
            : successMessage;
        toast.success(msg);
      }
      onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: (err, variables, onMutateResult, context) => {
      if (errorMessage !== undefined) {
        const msg =
          typeof errorMessage === "function" ? errorMessage(err) : errorMessage;
        toast.error(msg);
      }
      onError?.(err, variables, onMutateResult, context);
    },
  });
}
