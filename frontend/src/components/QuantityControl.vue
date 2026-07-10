<template>
  <el-input-number
    :model-value="quantity"
    :min="1"
    :max="99"
    size="small"
    controls-position="right"
    @update:model-value="(val) => emit('update:quantity', val)"
    @change="(val) => emit('change', val - quantity)"
  />
</template>

<script setup>
const props = defineProps({ quantity: { type: Number, default: 1 } })
const emit = defineEmits(['change', 'update:quantity'])
</script>
