<template>
  <div>
    <label class="label-text" :class="{ required }">{{ label }}</label>
    <input :value="modelValue" type="datetime-local" class="input-field"
      @input="emit('update:modelValue', $event.target.value)" />
    <!-- 快捷按钮 (仅失效时间显示) -->
    <div v-if="showShortcuts" class="flex flex-wrap gap-2 mt-2">
      <button v-for="s in shortcuts" :key="s.label" class="btn-secondary !py-1.5 !px-3 !min-h-[36px] text-xs"
        @click="s.action">
        {{ s.label }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { usePrintStore } from '../stores/print.js'

const props = defineProps({
  modelValue: String,
  label: { type: String, default: '时间' },
  required: { type: Boolean, default: false },
  showShortcuts: { type: Boolean, default: false }
})

const emit = defineEmits(['update:modelValue'])
const store = usePrintStore()

const shortcuts = [
  { label: '+7天', action: () => store.setExpireTime(7) },
  { label: '+14天', action: () => store.setExpireTime(14) },
  { label: '+180天', action: () => store.setExpireTime(180) },
  { label: '+3个月', action: () => store.setExpireTimeMonths(3) }
]
</script>
