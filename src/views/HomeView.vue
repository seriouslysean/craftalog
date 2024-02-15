<script setup>
import { computed, ref, watch } from 'vue';
import { useRoute, RouterLink } from 'vue-router';

import { recipes as recipesRaw } from '@/data/item-recipes';
import { getCraftingTableState, getResultItemDetails } from '@/utils/item-utils';

import ItemIcon from '@/components/ItemIcon.vue';

const route = useRoute();
const recipe = ref('');

watch(
  () => route.query.recipe,
  (newRecipe) => {
    recipe.value = newRecipe;
  },
  { immediate: true},
);

const recipes = computed(() => {
  return Object.keys(recipesRaw);
});

const craftingTableState = computed(() => getCraftingTableState(recipe.value));
const resultItemDetails = computed(() => getResultItemDetails(recipe.value));

const items = computed(() => craftingTableState.value);
const result = computed(() => resultItemDetails.value);
</script>

<template>
  <div class="home">
    <h1>Crafting Grid</h1>
    <h2>Current Recipe: {{ recipe ?? 'none' }}</h2>

    <div class="crafting">
      <div class="crafting__table">
        <div class="crafting__cell" v-for="(cell, index) in items" :key="index">
          <ItemIcon v-if="cell" :item="cell" />
        </div>
      </div>
      <div class="crafting__table crafting__table--result">
        <div class="crafting__cell">
          <!--
          This usage of ItemIcon requires a key to properly update the component
          when the result changes. Need to look in to how to fix the code to properly
          mutate the data so Vue is aware of the changes. Until then, this works :(
          -->
          <ItemIcon :item="result" :key="recipe" />
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

.crafting__cell {
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

.crafting__icon {
  image-rendering: pixelated;
  width: 100%;
  height: auto;
}
</style>
