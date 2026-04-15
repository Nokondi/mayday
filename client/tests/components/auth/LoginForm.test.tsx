import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from '../../../src/components/auth/LoginForm.js';

function renderForm(overrides: Partial<Parameters<typeof LoginForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <LoginForm onSubmit={onSubmit} isSubmitting={false} {...overrides} />,
  );
  return { onSubmit, ...utils };
}

describe('LoginForm', () => {
  it('renders email, password, and submit controls', () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
  });

  it('uses the appropriate input types for email and password', () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/password/i)).toHaveAttribute('type', 'password');
  });

  it('shows the error prop when provided', () => {
    renderForm({ error: 'Invalid credentials' });
    expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
  });

  it('does not render an error banner when no error prop is given', () => {
    renderForm();
    expect(screen.queryByText(/invalid|error/i)).not.toBeInTheDocument();
  });

  it('disables the submit button and changes its label while submitting', () => {
    renderForm({ isSubmitting: true });
    const button = screen.getByRole('button', { name: /logging in/i });
    expect(button).toBeDisabled();
  });

  it('calls onSubmit with form data when inputs are valid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.type(screen.getByLabelText(/password/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      { email: 'test@example.com', password: 'hunter2' },
      expect.anything(),
    );
  });

  it('does not call onSubmit when email is invalid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/password/i), 'hunter2');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    // Give react-hook-form + zod async validation time to settle.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when password is empty', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/email/i), 'test@example.com');
    await user.click(screen.getByRole('button', { name: /log in/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
