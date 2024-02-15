<script setup>
import { computed, defineProps, onMounted } from 'vue';

const { item } = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

const hasIcon = computed(() => {
    if (!item) {
        console.warn('No item provided');
        return false;
    }
    return typeof item?.icon === 'object';
});

const isBlock = computed(() => {
    return item?.icon?.length === 2;
});

onMounted(() => {
  console.log('ItemIcon item:', item);
});
</script>

<template>
  <div
    v-if="hasIcon"
    :class="{
        'item-icon--block': isBlock,
    }"
    class="item-icon"
  >
    <ul v-if="isBlock" class="block" :title="item.name">
      <li
        :style="{
          backgroundImage: `url(${item.icon[0]})`,
        }"
        class="top"
      />
      <li
        :style="{
          backgroundImage: `url(${item.icon[1]})`,
        }"
        class="left"
      />
      <li
        :style="{
          backgroundImage: `url(${item.icon[1]})`,
        }"
        class="right"
      />
    </ul>
    <img
      v-else
      class="icon"
      :src="item.icon"
      :alt="item.name"
      :title="item.name"
    />
  </div>
</template>

<style scoped>
.item-icon {
  width: 100%;
  position: relative;
  aspect-ratio: 1/1;
  image-rendering: pixelated;
}

.item-icon--block {
    max-width: 60%;
}

.icon {
  width: 100%;
  height: auto;
}

.block {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100%;
  transform-style: preserve-3d;
  transform: rotateX(-35deg) rotateY(-45deg);
}

.block .top,
.block .left,
.block .right {
  background: #fff none no-repeat center / cover;
  width: 100%;
  height: 100%;
  position: absolute;
  display: flex;
}

.left {
  background: green;
  transform: rotateY(-90deg) translateX(50%) rotateY(90deg);
}

.right {
  background: red;
  transform: translateX(50%) rotateY(90deg);
}

.top {
  background: blue;
  transform: translateY(-50%) rotateX(90deg);
}
</style>
