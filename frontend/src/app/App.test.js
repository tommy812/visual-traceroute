import { render, screen } from '@testing-library/react';
import AppWithErrorBoundary from './App';

test('renders landing page and CTA', () => {
  render(<AppWithErrorBoundary />);
  expect(screen.getByText(/Network Traceroute Visualization/i)).toBeInTheDocument();
  expect(screen.getByText(/Open Charts/i)).toBeInTheDocument();
});
