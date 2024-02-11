<script setup lang="ts">
import { RouterLink } from 'vue-router';
</script>

<template>
  <header class="site-header">
    <p>Header</p>

    <nav class="site-header__nav">
      <ul>
        <li>
          <RouterLink to="/">Home</RouterLink>
        </li>
        <li>
          <RouterLink to="/about">About</RouterLink>
        </li>
      </ul>
    </nav>
  </header>
</template>

<style scoped>
.site-header__nav ul,
.site-header__nav ul li {
  display: inline-block;
}

.site-header__nav ul li {
  margin-right: .5em;
}
</style>
