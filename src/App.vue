<script setup lang="ts">
import { RouterView } from 'vue-router';
import SiteHeader from './components/SiteHeader.vue';
import SiteFooter from './components/SiteFooter.vue';
</script>

<template>
  <div class="wrapper">
    <SiteHeader class="header" />

    <main class="main">
      <RouterView />
    </main>

    <SiteFooter class="footer" />
  </div>
</template>

<style scoped>
/*
Specific layout styles, but no design
*/
.wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header,
.main,
.footer {
  margin: 0 auto;
  padding: 0 1em;
  max-width: 800px;
  width: 100%;
}

.footer {
  margin-top: auto;
}
</style>
