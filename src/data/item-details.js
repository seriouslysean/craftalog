import { items } from './items.js';

// TODO: Maybe add a type key (block vs item) and some helper functions to infer icon instead of
// adding it direct to the object

export const itemDetails = {
  [items.arrow]: {
    id: 'arrow',
    name: 'Arrow',
    icon: '/textures/items/arrow.png',
  },
  [items.charcoal]: {
    id: 'charcoal',
    name: 'Charcoal',
    icon: '/textures/items/charcoal.png',
  },
  [items.coal]: {
    id: 'coal',
    name: 'Coal',
    icon: '/textures/items/coal.png',
  },
  [items.feather]: {
    id: 'feather',
    name: 'Feather',
    icon: '/textures/items/feather.png',
  },
  [items.flint]: {
    id: 'flint',
    name: 'Flint',
    icon: '/textures/items/flint.png',
  },
  // Melon slice
  [items.melon]: {
    id: 'melon',
    name: 'Melon Slice',
    icon: '/textures/items/melon.png',
  },
  [items.melon_seeds]: {
    id: 'melon_seeds',
    name: 'Melon Seeds',
    icon: '/textures/items/seeds_melon.png',
  },
  [items.melon_block]: {
    id: 'melon_block',
    name: 'Melon',
    // There are actually 2 distinct textures for the melon block
    // Ideally we create a way to show a psuedo 3d block from items that show up
    // that way in the crafting table, something like this and then we can either
    // generate an image from this json structure, or show it in css as 3 parts
    //            / top texture \
    //    | side texture | side texture |
    icon: '/textures/blocks/melon_side.png',
  },
  [items.stick]: {
    id: 'stick',
    name: 'Stick',
    icon: '/textures/items/stick.png',
  },
  [items.torch]: {
    id: 'torch',
    name: 'Torch',
    icon: '/textures/blocks/torch_on.png',
  },
};
