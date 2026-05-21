import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { SocialIconRow } from '../SocialIconRow';

describe('SocialIconRow', () => {
  it('renders nothing when no socials', () => {
    const { container } = render(<SocialIconRow socials={{}} color="#686A6C" />);
    expect(container.firstChild).toBeNull();
  });
  it('renders one link per present social key', () => {
    const { container } = render(
      <SocialIconRow socials={{ linkedin: 'a7xq8', github: 'ForceAI-KW' }} color="#686A6C" />
    );
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(2);
    expect(links[0].getAttribute('href')).toBe('https://linkedin.com/in/a7xq8');
    expect(links[1].getAttribute('href')).toBe('https://github.com/ForceAI-KW');
  });
  it('skips empty-string handles', () => {
    const { container } = render(
      <SocialIconRow socials={{ linkedin: '', github: 'ForceAI-KW' }} color="#686A6C" />
    );
    expect(container.querySelectorAll('a')).toHaveLength(1);
  });
});
