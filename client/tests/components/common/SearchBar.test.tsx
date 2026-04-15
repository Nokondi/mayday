import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../../src/components/common/SearchBar.js';

describe('SearchBar', () => {
  it('renders a search landmark containing a text input', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    const search = screen.getByRole('search');
    expect(search).toBeInTheDocument();
    const input = screen.getByRole('textbox');
    expect(search).toContainElement(input);
    expect(input).toHaveAttribute('type', 'text');
  });

  it('uses the default placeholder when none is provided', () => {
    render(<SearchBar value="" onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('applies a custom placeholder and uses it as the aria-label', () => {
    render(<SearchBar value="" onChange={() => {}} placeholder="Search posts" />);
    const input = screen.getByPlaceholderText('Search posts');
    expect(input).toHaveAttribute('aria-label', 'Search posts');
  });

  it('reflects the controlled value in the input', () => {
    render(<SearchBar value="food" onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toHaveValue('food');
  });

  it('calls onChange with each character the user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} />);

    await user.type(screen.getByRole('textbox'), 'abc');

    // As a controlled input with a static value="", each keystroke reports
    // the typed character (not the accumulated string).
    expect(onChange).toHaveBeenCalledTimes(3);
    expect(onChange).toHaveBeenNthCalledWith(1, 'a');
    expect(onChange).toHaveBeenNthCalledWith(2, 'b');
    expect(onChange).toHaveBeenNthCalledWith(3, 'c');
  });

  it('calls onChange with an empty string when the user clears the input', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SearchBar value="food" onChange={onChange} />);

    await user.clear(screen.getByRole('textbox'));

    expect(onChange).toHaveBeenCalledWith('');
  });
});
