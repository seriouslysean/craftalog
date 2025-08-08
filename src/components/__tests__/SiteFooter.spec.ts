import { describe, it, expect } from 'vitest';

import { mount } from '@vue/test-utils';
import SiteFooter from '../SiteFooter.vue';

describe('SiteFooter', () => {
  it('renders footer content', () => {
    const wrapper = mount(SiteFooter);
    expect(wrapper.text()).toContain('Made with');
    expect(wrapper.text()).toContain('GitHub');
  });
});
