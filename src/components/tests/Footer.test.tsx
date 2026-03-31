import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Footer from '../Footer';

describe('<Footer />', () => {
  it('renders CreatorHub text', () => {
    render(<Footer />);
    expect(screen.getByText(/CreatorHub/i)).toBeInTheDocument();
  });
});
