<script setup>
import { RouterLink } from 'vue-router';
</script>

<template>
  <header>
    <p>Craftalog</p>

    <nav class="nav">
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
.nav ul,
.nav ul li {
  display: inline-block;
}

.nav ul li {
  margin-right: 0.5em;
}
</style>
