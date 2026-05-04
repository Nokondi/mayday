import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterForm } from '../../../src/components/auth/RegisterForm.js';

function renderForm(overrides: Partial<Parameters<typeof RegisterForm>[0]> = {}) {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <RegisterForm onSubmit={onSubmit} isSubmitting={false} {...overrides} />,
  );
  return { onSubmit, ...utils };
}

describe('RegisterForm', () => {
  it('renders name, email, password, and submit controls', () => {
    renderForm();
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('uses appropriate input types for email and password', () => {
    renderForm();
    expect(screen.getByLabelText(/email/i)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password');
  });

  it('shows the error prop when provided', () => {
    renderForm({ error: 'Email already in use' });
    expect(screen.getByText('Email already in use')).toBeInTheDocument();
  });

  it('does not render an error banner when no error prop is given', () => {
    renderForm();
    expect(screen.queryByText(/already in use|error/i)).not.toBeInTheDocument();
  });

  it('disables the submit button and changes its label while submitting', () => {
    renderForm({ isSubmitting: true });
    const button = screen.getByRole('button', { name: /creating account/i });
    expect(button).toBeDisabled();
  });

  it('calls onSubmit with form data when inputs are valid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      { name: 'Alice', email: 'alice@example.com', password: 'hunter2hunter2' },
      expect.anything(),
    );
  });

  it('does not call onSubmit when the name is empty', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when email is invalid', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'not-an-email');
    await user.type(screen.getByLabelText(/^password$/i), 'hunter2hunter2');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not call onSubmit when password is shorter than 8 characters', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderForm();

    await user.type(screen.getByLabelText(/name/i), 'Alice');
    await user.type(screen.getByLabelText(/email/i), 'alice@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'short');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
