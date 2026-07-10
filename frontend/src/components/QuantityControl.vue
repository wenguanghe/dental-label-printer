<template>
  <div class="flex items-center gap-1">
    <button class="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-200 active:bg-gray-300 text-lg font-bold"
      @click="emit('change', -1)" :disabled="quantity <= 1">−</button>
    <input :value="quantity" type="number" min="1" max="99"
      class="w-12 h-10 text-center border border-gray-300 rounded-lg text-base font-medium"
      @input="onInput" />
    <button class="w-10 h-10 flex items-center justify-center rounded-lg bg-blue-100 active:bg-blue-200 text-lg font-bold text-blue-700"
      @click="emit('change', 1)">+</button>
  </div>
</template>

<script setup>
const props = defineProps({ quantity: { type: Number, default: 1 } })
const emit = defineEmits(['change', 'update:quantity'])

function onInput(e) {
  const val = parseInt(e.target.value) || 1
  if (val > 0 && val <= 99) {
    emit('update:quantity', val)
  }
}
</script>
