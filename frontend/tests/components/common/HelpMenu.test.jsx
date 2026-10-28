import { render, screen } from '@testing-library/react';
import HelpMenu from '../../../src/components/common/HelpMenu';

describe('HelpMenu', () => {
  it.each([undefined, null, '', '   ', 'blank', ' BLANK '])(
    'does not render for absent help text (%s)',
    (text) => {
      const { container } = render(<HelpMenu text={text} />);
      expect(container.firstChild).toBeNull();
    },
  );

  it('renders provided help text', () => {
    render(<HelpMenu text="Helpful context" />);
    expect(screen.getByText('Helpful context')).toBeInTheDocument();
  });
});
