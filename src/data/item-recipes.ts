import { items, itemGroups } from './items';

export interface Recipe {
  shaped: boolean;
  pattern: string[];
  key: Record<string, string[]>;
}

export const recipes: Record<string, Recipe> = {
  [items.arrow]: {
    shaped: true,
    pattern: ['X', '#', 'Y'],
    key: {
      '#': [items.stick],
      X: [items.flint],
      Y: [items.feather],
    },
  },
  [items.melon_block]: {
    shaped: true,
    pattern: ['MMM', 'MMM', 'MMM'],
    key: {
      M: [items.melon],
    },
  },
  [items.melon_seeds]: {
    shaped: false,
    pattern: ['M'],
    key: {
      M: [items.melon],
    },
  },
  [items.planks]: {
    shaped: true,
    pattern: ['#'],
    key: {
      '#': [...itemGroups.logs],
    },
  },
  [items.torch]: {
    shaped: true,
    pattern: ['X', '#'],
    key: {
      '#': [items.stick],
      X: [...itemGroups.coals],
    },
  },
};
