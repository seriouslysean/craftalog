import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import SiteFooter from '../SiteFooter.vue'

describe('SiteFooter', () => {
  it('renders properly', () => {
    const wrapper = mount(SiteFooter)
    expect(wrapper.text()).toContain('Footer')
  })
})
