<template>
  <div class="home">
    <h1>Crafting Grid</h1>

    <div class="crafting-table">
      <div
        class="crafting-table__cell"
        v-for="n in 9"
        :key="n"
      ></div>
    </div>

    <h2>Recipe List</h2>
    <ul>
      <li><a href="#">Recipe #1</a></li>
      <li><a href="#">Recipe #2</a></li>
      <li><a href="#">Recipe #3</a></li>
    </ul>
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
