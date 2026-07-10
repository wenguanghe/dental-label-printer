<template>
  <el-form-item :label="label" :required="required">
    <el-date-picker
      :model-value="modelValue"
      type="datetime"
      placeholder="选择日期时间"
      format="YYYY-MM-DD HH:mm"
      value-format="YYYY-MM-DDTHH:mm"
      style="width: 100%;"
      @update:model-value="(val) => emit('update:modelValue', val)"
    />
    <div v-if="showShortcuts" style="display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap;">
      <el-button v-for="s in shortcuts" :key="s.label" size="small" @click="s.action">
        {{ s.label }}
      </el-button>
    </div>
  </el-form-item>
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
