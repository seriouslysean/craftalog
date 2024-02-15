import { items } from './items.js';

// TODO: Maybe add a type key (block vs item) and some helper functions to infer icon instead of
// adding it direct to the object

export const itemDetails = {
  [items.arrow]: {
    id: 'arrow',
    name: 'Arrow',
    icon: ['/textures/items/arrow.png'],
  },
  [items.charcoal]: {
    id: 'charcoal',
    name: 'Charcoal',
    icon: ['/textures/items/charcoal.png'],
  },
  [items.coal]: {
    id: 'coal',
    name: 'Coal',
    icon: ['/textures/items/coal.png'],
  },
  [items.feather]: {
    id: 'feather',
    name: 'Feather',
    icon: ['/textures/items/feather.png'],
  },
  [items.flint]: {
    id: 'flint',
    name: 'Flint',
    icon: ['/textures/items/flint.png'],
  },
  [items.melon]: {
    id: 'melon',
    name: 'Melon Slice',
    icon: ['/textures/items/melon.png'],
  },
  [items.melon_seeds]: {
    id: 'melon_seeds',
    name: 'Melon Seeds',
    icon: ['/textures/items/seeds_melon.png'],
  },
  [items.log_acacia]: {
    id: 'log_acacia',
    name: 'Acacia Log',
    icon: ['/textures/blocks/log_acacia_top.png', '/textures/blocks/log_acacia.png'],
  },
  [items.log_birch]: {
    id: 'log_birch',
    name: 'Birch Log',
    icon: ['/textures/blocks/log_birch_top.png', '/textures/blocks/log_birch.png'],
  },
  [items.log_big_oak]: {
    id: 'log_big_oak',
    name: 'Big Oak Log',
    icon: ['/textures/blocks/log_big_oak_top.png', '/textures/blocks/log_big_oak.png'],
  },
  [items.log_cherry]: {
    id: 'log_cherry',
    name: 'Cherry Log',
    icon: ['/textures/blocks/cherry_log_top.png', '/textures/blocks/cherry_log_side.png'],
  },
  [items.log_jungle]: {
    id: 'log_jungle',
    name: 'Jungle Log',
    icon: ['/textures/blocks/log_jungle_top.png', '/textures/blocks/log_jungle.png'],
  },
  [items.log_mangrove]: {
    id: 'log_mangrove',
    name: 'Mangrove Log',
    icon: ['/textures/blocks/log_mangrove_top.png', '/textures/blocks/log_mangrove_side.png'],
  },
  [items.log_oak]: {
    id: 'log_oak',
    name: 'Oak Log',
    icon: ['/textures/blocks/log_oak_top.png', '/textures/blocks/log_oak.png'],
  },
  [items.log_spruce]: {
    id: 'log_spruce',
    name: 'Spruce Log',
    icon: ['/textures/blocks/log_spruce_top.png', '/textures/blocks/log_spruce.png'],
  },
  // There are actually 2 distinct textures for the melon block
  // Ideally we create a way to show a psuedo 3d block from items that show up
  // that way in the crafting table, something like this and then we can either
  // generate an image from this json structure, or show it in css as 3 parts
  //            / top texture \
  //    | side texture | side texture |
  [items.melon_block]: {
    id: 'melon_block',
    name: 'Melon',
    icon: ['/textures/blocks/melon_top.png', '/textures/blocks/melon_side.png'],
  },
  [items.planks]: {
    id: 'planks',
    name: 'Planks',
    icon: ['/textures/blocks/planks_acacia.png', '/textures/blocks/planks_acacia.png'],
  },
  [items.stick]: {
    id: 'stick',
    name: 'Stick',
    icon: ['/textures/items/stick.png'],
  },
  [items.torch]: {
    id: 'torch',
    name: 'Torch',
    icon: ['/textures/blocks/torch_on.png'],
  },
  [items.warped_stem]: {
    id: 'warped_stem',
    name: 'Warped Stem',
    icon: ['/textures/blocks/warped_stem_top.png', '/textures/blocks/warped_stem_side.png'],
  },
};
