<script setup lang="js">
import { computed, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';

import { recipes as recipesRaw } from '@/data/recipes.js';
import { formatCraftingTable } from '@/utils/item-utils.js';

const route = useRoute();
const recipe = ref('');

watch(
  () => route.query.recipe,
  (newRecipe) => {
    recipe.value = newRecipe;
  },
  { immediate: true },
);

const recipes = computed(() => {
  return Object.keys(recipesRaw);
});

const craftingTableCells = computed(() => {
  return formatCraftingTable(recipe.value);
});
</script>

<template>
  <div class="home">
    <h1>Crafting Grid</h1>
    <h2>Current Recipe: {{ recipe ?? 'none' }}</h2>

    <div class="crafting-table">
      <div class="crafting-table__cell" v-for="(cell, index) in craftingTableCells" :key="index">
        <img v-if="cell" :src="cell.icon" :alt="cell.name" />
      </div>
    </div>

    <template v-if="recipes.length">
      <h2>Recipe List</h2>
      <ul>
        <li v-for="recipe in recipes" :key="recipe">
          <RouterLink :to="{ query: { recipe: recipe } }">
            {{ recipe }}
          </RouterLink>
        </li>
      </ul>
    </template>
  </div>
</template>

<style scoped>
.crafting-table {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  width: 100%;
  height: 0;
  padding-bottom: 100%;
  position: relative;
}

.crafting-table__cell {
  border: 1px solid #000;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1 / 1;
  position: relative;
}
</style>
