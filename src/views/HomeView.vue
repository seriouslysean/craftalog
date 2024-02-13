<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';

import { recipes as recipesRaw } from '@/data/item-recipes';
import { getCraftingDataByRecipe } from '@/utils/item-utils';

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

const craftingData = computed(() => {
  return getCraftingDataByRecipe(recipe.value);
});
</script>

<template>
  <div class="home">
    <h1>Crafting Grid</h1>
    <h2>Current Recipe: {{ recipe ?? 'none' }}</h2>

    <div class="crafting">
      <div class="crafting__table">
        <div class="crafting__cell" v-for="(cell, index) in craftingData.items" :key="index">
          <img v-if="cell" :src="cell.icon" :alt="cell.name" />
        </div>
      </div>
      <div class="crafting__table crafting__table--result">
        <div class="crafting__cell">
          <img v-if="craftingData.result" :src="craftingData.result.icon" :alt="craftingData.result.name" />
        </div>
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
.crafting {
  display: flex;
  gap: 1em;
  background-color: var(--color-gray-light);
  padding: 1em;
  height: 100%;
}

.crafting__table {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1em;
  width: 70%;
  position: relative;
}

.crafting__table--result {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 30%;
}

.crafting__table--result .crafting__cell {
  width: 80%;
}

.crafting__cell {
  background-color: var(--color-gray);
  box-shadow: 0.5em 0.5em 0 0 rgba(0,0,0,0.5) inset,
    -0.5em  -0.5em 0 0 rgba(255, 255, 255, .75) inset;
  display: flex;
  justify-content: center;
  align-items: center;
  aspect-ratio: 1 / 1;
  position: relative;
  padding: 1em;
}

.crafting__cell img {
  image-rendering: pixelated;
  width: 100%;
  height: auto;
}
</style>
